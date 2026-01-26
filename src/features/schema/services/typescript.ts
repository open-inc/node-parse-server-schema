import fs from "fs";
import { mkdirp } from "mkdirp";
import path from "path";
import { TypescriptConversion } from "../classes/TypescriptConversion.js";
import {
  getRemoteSchema,
  resolveAndWriteFiles,
  runSchemaConversion,
  type SchemaInterface,
  type TypescriptConversionOptions,
} from "../index.js";

/**
 * Generates TypeScript definitions for the Parse Server schema.
 * @param cfg ConfigInterface with publicServerURL, appId and masterKey
 * @param typescriptPath The path to the output TypeScript folder.
 * @param options Options for the generation of the TypeScript definitions
 * @param options.prefix Only classes with the given prefix will be generated. The prefix will be removed from the class names in the local schema.
 * @param options.ignore Class(es) to ignore. You can use * at the end to ignore all classes that start with the given string.
 * @param options.sdk Whether to generate classes that extend Parse.Object. Default is true.
 * @param options.importParseStatement Custom import statement for Parse (e.g., 'import Parse from "parse/node.js"'). If empty, no import is added.
 * @param options.class Whether to create and register custom Parse.Object classes. Default is false.
 * @param options.isEsm Whether to generate ESM imports/exports. Default is false (CommonJS).
 */
export async function typescript(
  typescriptPath: string,
  options: TypescriptConversionOptions = {
    prefix: "",
    ignore: [],
    include: [],
    sdk: true,
    importParseStatement: "",
    class: false,
    isEsm: false,
  },
) {
  options.sdk ??= true;
  options.importParseStatement ??= "";
  options.class ??= false;

  let schema = await getRemoteSchema();

  // Get the full schema for include additions
  const fullSchema = [...schema];

  // Apply prefix filter to get base set
  if (options.prefix) {
    schema = schema.filter(
      (s) =>
        s.className.startsWith(options.prefix!) || s.className.startsWith("_"),
    );
  }

  // Apply include filter - ADD additional classes to the base set
  if (Array.isArray(options.include) && options.include.length > 0) {
    const includedClasses = new Set<string>();
    const wildcardPrefixes: string[] = [];

    // Track classes already in schema to avoid duplicates
    const existingClassNames = new Set(schema.map((s) => s.className));

    // Separate exact matches from wildcard patterns
    for (const include of options.include) {
      if (include.endsWith("*")) {
        wildcardPrefixes.push(include.slice(0, -1));
      } else {
        includedClasses.add(include);
      }
    }

    // Find additional classes to add from the full schema
    const additionalClasses = fullSchema.filter((s) => {
      // Skip if already in schema
      if (existingClassNames.has(s.className)) {
        return false;
      }

      // Check exact matches
      if (includedClasses.has(s.className)) {
        return true;
      }
      // Check wildcard patterns
      return wildcardPrefixes.some((prefix) => s.className.startsWith(prefix));
    });

    // Add the additional classes to schema
    schema = [...schema, ...additionalClasses];
  }

  // Apply ignore filter (works on the full schema or the included results)
  if (Array.isArray(options.ignore) && options.ignore.length > 0) {
    for (let ignore of options.ignore) {
      if (ignore.endsWith("*")) {
        // Wildcard at end: ignore classes that START with prefix
        const prefix = ignore.slice(0, -1);
        schema = schema.filter((s) => !s.className.startsWith(prefix));
      } else if (ignore.startsWith("*")) {
        // Wildcard at start: ignore classes that END with suffix
        const suffix = ignore.slice(1);
        schema = schema.filter((s) => !s.className.endsWith(suffix));
      } else {
        // Exact match
        schema = schema.filter((s) => s.className !== ignore);
      }
    }
  }

  const tsPath = typescriptPath
    ? path.resolve(typescriptPath)
    : path.resolve(".", "schema", "typescript");

  await mkdirp(tsPath);

  const processedClasses = new Set<string>();
  const allFetchedSchema: SchemaInterface[] = [];
  const conversions = new Map();

  for await (const { className, fields } of schema) {
    await runSchemaConversion(
      className,
      options,
      schema,
      fields,
      tsPath,
      processedClasses,
      allFetchedSchema,
      conversions,
    );
  }

  // Resolve dependencies and write all files
  const allSchemaForResolution = [...schema, ...allFetchedSchema];
  resolveAndWriteFiles(
    conversions,
    allSchemaForResolution,
    tsPath,
    options.verbose,
  );

  // Write the index.ts file that exports all classes using Handlebars template
  console.log("📄 Creating index.ts file...");
  // Include both original schema and all fetched dependencies
  const allClassNames = [
    ...schema.map((s) => s.className),
    ...allFetchedSchema.map((s) => s.className),
  ];
  // Remove duplicates
  const uniqueClassNames = [...new Set(allClassNames)];

  const indexContent = TypescriptConversion.generateIndexFromTemplate(
    uniqueClassNames,
    options,
  );
  fs.writeFileSync(path.resolve(tsPath, "index.ts"), indexContent);

  // Beautify generated files (optional, requires prettier to be installed)
  try {
    const prettier = await import("prettier");
    console.log("🎨 Beautifying generated files with Prettier...");
    const prettierConfig = await prettier.resolveConfig("/");
    for await (const file of fs.readdirSync(tsPath)) {
      if (file.endsWith(".ts")) {
        const filePath = path.resolve(tsPath, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const formatted = await prettier.format(fileContent, {
          ...prettierConfig,
          filepath: filePath,
        });
        fs.writeFileSync(filePath, formatted, "utf-8");
      }
    }
  } catch (error) {
    console.warn(
      "⚠️ Prettier not found or failed to format files. Skipping beautification.",
    );
  }

  // Final summary
  console.log(`\n✅ TypeScript generation completed successfully!`);
  console.log(`   📊 Generated ${uniqueClassNames.length} TypeScript files`);
  console.log(`   📁 Output directory: ${tsPath}`);
  console.log(`   📄 Index file: index.ts with all exports`);
}
