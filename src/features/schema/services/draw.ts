import fs from "fs";
import Handlebars from "handlebars";
import { mkdirp } from "mkdirp";
import path from "path";
import { fileURLToPath } from "url";
import { getLocalSchema, type SchemaInterface } from "../index.js";
import type { DrawOptions, DrawRenderer } from "../types/DrawTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads the local schema (JSON or TypeScript files) and writes a UML class
 * diagram to disk. Supported output formats: mermaid (.mmd), markdown (.md),
 * html (.html).
 *
 * @param inputPath  Folder with .json files (from `down`) or .ts files (from `typescript`), or a single .json file.
 * @param options    Draw options
 */
export async function draw(inputPath: string, options: DrawOptions = {}) {
  const resolvedInput = path.resolve(inputPath);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Path does not exist: ${resolvedInput}`);
  }

  let schema = await loadSchema(resolvedInput);
  const originalClassNames = schema.map((s) => s.className);

  // Apply prefix filter
  if (options.prefix) {
    const prefix = options.prefix;
    schema = schema.filter((s) => s.className.startsWith(prefix));

    if (schema.length === 0) {
      const sample = originalClassNames.slice(0, 8).join(", ");
      const knownPrefixes = Array.from(
        new Set(
          originalClassNames
            .filter((name) => name.includes("_"))
            .map((name) => `${name.split("_")[0]}_`)
        )
      )
        .slice(0, 8)
        .join(", ");

      throw new Error(
        `No schema classes found for prefix "${prefix}". ` +
          `Example classes: ${sample || "(none)"}. ` +
          `Detected prefix groups: ${knownPrefixes || "(none)"}.`
      );
    }

    for (const s of schema) {
      s.className = s.className.replace(prefix, "");

      for (const field of Object.values(s.fields)) {
        if (
          (field.type === "Pointer" || field.type === "Relation") &&
          field.targetClass?.startsWith(prefix)
        ) {
          field.targetClass = field.targetClass.replace(prefix, "");
        }
      }
    }
  }

  // Apply ignore filter
  if (Array.isArray(options.ignore) && options.ignore.length > 0) {
    for (const ignore of options.ignore) {
      if (ignore.endsWith("*")) {
        const ignorePrefix = ignore.slice(0, -1);
        schema = schema.filter((s) => !s.className.startsWith(ignorePrefix));
      } else {
        schema = schema.filter((s) => s.className !== ignore);
      }
    }
  }

  if (schema.length === 0) {
    throw new Error("No schema classes found after applying filters.");
  }

  const format = options.format ?? "mermaid";
  const ext = format === "html" ? "html" : format === "markdown" ? "md" : "mmd";
  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve(".", `schema-diagram.${ext}`);

  await mkdirp(path.dirname(outputPath));

  const diagramContent = generateMermaid(
    schema,
    options.fontSize ?? 44,
    options.defaultRenderer ?? "elk"
  );

  let fileContent: string;
  if (format === "html") {
    fileContent = generateHtml(diagramContent);
  } else if (format === "markdown") {
    fileContent = generateMarkdown(diagramContent);
  } else {
    fileContent = diagramContent;
  }

  fs.writeFileSync(outputPath, fileContent, "utf-8");
  console.log(`Schema diagram written to: ${outputPath}`);
}

// ---------------------------------------------------------------------------
// Schema loading
// ---------------------------------------------------------------------------

async function loadSchema(resolvedPath: string): Promise<SchemaInterface[]> {
  const stat = fs.statSync(resolvedPath);

  if (stat.isFile()) {
    if (!resolvedPath.endsWith(".json")) {
      throw new Error("Input file must be a .json file.");
    }
    return getLocalSchema(resolvedPath);
  }

  const files = fs.readdirSync(resolvedPath);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const tsFiles = files.filter((f) => f.endsWith(".ts") && f !== "index.ts");

  if (jsonFiles.length > 0) {
    return getLocalSchema(resolvedPath);
  }

  if (tsFiles.length > 0) {
    return parseTypescriptDirectory(resolvedPath, tsFiles);
  }

  throw new Error("No .json or .ts schema files found in the directory.");
}

// ---------------------------------------------------------------------------
// TypeScript file parser (for output from `typescript` command)
// ---------------------------------------------------------------------------

function parseTypescriptDirectory(
  dir: string,
  files: string[]
): SchemaInterface[] {
  return files
    .map((f) => parseTypescriptFile(path.resolve(dir, f)))
    .filter((s): s is SchemaInterface => s !== null);
}

function parseTypescriptFile(filePath: string): SchemaInterface | null {
  const content = fs.readFileSync(filePath, "utf-8");

  // Extract the `export interface XxxAttributes { ... }` block
  const interfaceMatch = content.match(
    /export interface (\w+)Attributes\s*\{([\s\S]*?)\n\}/
  );
  if (!interfaceMatch) return null;

  const className = interfaceMatch[1];
  const fieldsContent = interfaceMatch[2];
  if (!className || !fieldsContent) return null;

  // Collect types that are imported from sibling files → these are Pointer targets
  const importedTypes = new Set<string>();
  const importPattern =
    /import(?:\s+type)?\s+\{\s*(\w+)(?:Attributes)?\s*\}\s+from\s+["'][^"']+["']/g;
  let m: RegExpExecArray | null;
  while ((m = importPattern.exec(content)) !== null) {
    if (m[1]) importedTypes.add(m[1]);
  }

  const fields: SchemaInterface["fields"] = {};

  const fieldPattern = /^\s+(\w+)(\?)?\s*:\s*(.+?);/gm;
  while ((m = fieldPattern.exec(fieldsContent)) !== null) {
    const fieldName = m[1];
    const typeStr = m[3];
    if (!fieldName || !typeStr) continue;

    const optional = !!m[2];
    const trimmedType = typeStr.trim();

    // Parse.Relation<OwnerClass, TargetClass> — second type arg is the target
    const relationMatch = trimmedType.match(/^Parse\.Relation<\w+,\s*(\w+)/);
    if (relationMatch?.[1]) {
      fields[fieldName] = {
        type: "Relation",
        targetClass: relationMatch[1],
        required: !optional,
      };
      continue;
    }

    // Pointer: type may be "SomeClass | undefined" — extract the class name
    // before any " |" and check against imported types
    const baseType = trimmedType.split(/\s*\|/)[0]?.trim() ?? trimmedType;
    if (importedTypes.has(baseType)) {
      fields[fieldName] = {
        type: "Pointer",
        targetClass: baseType,
        required: !optional,
      };
      continue;
    }

    // Primitive / built-in
    fields[fieldName] = {
      type: mapTsTypeToParse(trimmedType),
      required: !optional,
    } as SchemaInterface["fields"][string];
  }

  return {
    className,
    fields,
    classLevelPermissions: {} as SchemaInterface["classLevelPermissions"],
  };
}

function mapTsTypeToParse(tsType: string): string {
  const map: Record<string, string> = {
    string: "String",
    number: "Number",
    boolean: "Boolean",
    Date: "Date",
    "Parse.GeoPoint": "GeoPoint",
    "Parse.Polygon": "Polygon",
    "Parse.File": "File",
    "any[]": "Array",
    "Array<any>": "Array",
    "unknown[]": "Array",
    "Record<string, any>": "Object",
    object: "Object",
  };
  return map[tsType] ?? tsType;
}

// ---------------------------------------------------------------------------
// Mermaid diagram generator
// ---------------------------------------------------------------------------

/**
 * Returns a valid Mermaid node identifier for a Parse class name.
 * Parse allows names like `_User`, `_Role`, etc. which start with underscore.
 * Mermaid identifiers must start with a letter, so we prefix unsafe names.
 */
function toNodeId(className: string): string {
  // Replace all non-alphanumeric/underscore characters
  const safe = className.replace(/[^a-zA-Z0-9_]/g, "_");
  // If the identifier starts with _ or a digit, prefix with "C"
  return /^[^a-zA-Z]/.test(safe) ? `C${safe}` : safe;
}

function normalizeRenderer(renderer: string): DrawRenderer {
  if (
    renderer === "dagre-wrapper" ||
    renderer === "dagre-d3" ||
    renderer === "elk"
  ) {
    return renderer;
  }

  return "elk";
}

function generateMermaid(
  schema: SchemaInterface[],
  fontSize: number,
  defaultRenderer: DrawRenderer
): string {
  const renderer = normalizeRenderer(defaultRenderer);
  const sorted = [...schema].sort((a, b) =>
    a.className.localeCompare(b.className)
  );

  const knownClasses = new Set(schema.map((s) => s.className));
  const classLines: string[] = [];
  const relationLines: string[] = [];

  for (const cls of sorted) {
    const nodeId = toNodeId(cls.className);
    const displayName = nodeId !== cls.className ? `["${cls.className}"]` : "";

    classLines.push(`  class ${nodeId}${displayName} {`);
    classLines.push(`    <<Parse Object>>`);

    for (const [fieldName, field] of Object.entries(cls.fields)) {
      const req = field.required ? "" : "?";
      if (
        (field.type === "Pointer" || field.type === "Relation") &&
        field.targetClass
      ) {
        classLines.push(
          `    +${fieldName}${req}: ${field.type}<${field.targetClass}>`
        );
      } else {
        classLines.push(`    +${fieldName}${req}: ${field.type}`);
      }
    }

    classLines.push(`  }`);

    // Relationships
    for (const [fieldName, field] of Object.entries(cls.fields)) {
      if (field.type !== "Pointer" && field.type !== "Relation") continue;
      if (!field.targetClass) continue;

      const rawTarget = field.targetClass.replace("{{PREFIX}}", "");
      if (!knownClasses.has(rawTarget)) continue;

      const targetId = toNodeId(rawTarget);

      if (field.type === "Pointer") {
        relationLines.push(`  ${nodeId} --> ${targetId} : ${fieldName}`);
      } else {
        relationLines.push(
          `  ${nodeId} "0..*" --> "0..*" ${targetId} : ${fieldName}`
        );
      }
    }
  }

  const lines = [
    `%%{init: { 'theme': 'base', 'themeVariables': { 'fontSize': '${fontSize}px', 'fontFamily': 'Segoe UI, Arial, sans-serif', 'background': '#070b14', 'primaryColor': '#0f172a', 'primaryTextColor': '#e2e8f0', 'primaryBorderColor': '#334155', 'lineColor': '#38bdf8', 'secondaryColor': '#111827', 'tertiaryColor': '#1f2937' }, 'class': { 'defaultRenderer': '${renderer}', 'padding': 14, 'textHeight': 24 }, 'themeCSS': '.classTitleText, .label, .edgeLabel, .nodeLabel { font-size: ${fontSize}px !important; } .divider { stroke-width: 1.5px; }' }}%%`,
    "classDiagram",
    "  accTitle: Parse Server Schema",
    "  direction TB",
    ...classLines,
    ...relationLines,
    "",
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output format wrappers
// ---------------------------------------------------------------------------

function generateMarkdown(mermaidContent: string): string {
  return `# Parse Server Schema\n\n\`\`\`mermaid\n${mermaidContent}\`\`\`\n`;
}

let _htmlTemplate: HandlebarsTemplateDelegate | null = null;

function getHtmlTemplate(): HandlebarsTemplateDelegate {
  if (_htmlTemplate) return _htmlTemplate;

  const templatePath = path.resolve(__dirname, "../templates/draw-html.hbs");
  const source = fs.readFileSync(templatePath, "utf-8");
  _htmlTemplate = Handlebars.compile(source);
  return _htmlTemplate;
}

function generateHtml(mermaidContent: string): string {
  // Pass the diagram as a JSON string so the template can embed it safely
  // in a JS assignment without any manual escaping.
  const diagramJson = JSON.stringify(mermaidContent);
  return getHtmlTemplate()({ diagramJson });
}
