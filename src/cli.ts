import "dotenv/config";

import pkg from "../package.json" with { type: "json" };

import { Command } from "commander";
import { loadConfig, printConfig } from "./features/config/index.js";
import {
  del,
  down,
  draw,
  typescript,
  up,
  type CLI_DeleteType,
  type CLI_DownType,
  type CLI_DrawType,
  type CLI_UpType,
  type TypescriptConversionOptions,
} from "./features/schema/index.js";

main().catch((error) => {
  console.error("Error: " + error.message);
  process.exit(1);
});

async function main() {
  const program = new Command();

  program.version(pkg.version);

  program.option("--configPath <path>", "Path to .js(on) config file");

  program
    .command("config")
    .description("Returns the current configuration")
    .action(() => {
      loadConfig(program.opts().configPath);

      printConfig();
    });

  program
    .command("down <schemaPath>")
    .option(
      "--prefix <prefix>",
      "Only classes with the given prefix will be pulled",
      ""
    )
    .option("--ignore <ignore...>", "Class(es) to ignore", "")
    .description("Fetch the schema from Parse Server")
    .action(async (schemaPath: string, options: CLI_DownType | undefined) => {
      loadConfig(program.opts().configPath, {
        operation: "down",
      });

      await down(schemaPath, options);
    });

  program
    .command("up <schemaPath>")
    .option(
      "--prefix <prefix>",
      "Only classes with the given prefix will be pushed or removed",
      ""
    )
    .option("--ignore <ignore...>", "Class(es) to ignore", "")
    .option("--safe", "This will prevent destructive operations", "")
    .option("--deleteNonEmptyClass", "Delete non-empty classes", false)
    .description("Upload the local schema to Parse Server")
    .action(async (schemaPath: string, options: CLI_UpType) => {
      loadConfig(program.opts().configPath, {
        operation: "up",
      });

      await up(schemaPath, {
        prefix: options.prefix,
        ignore: options.ignore,
        deleteClasses: !options.safe,
        deleteFields: !options.safe,
        deleteNonEmptyClass: options.deleteNonEmptyClass,
      });
    });

  program
    .command("delete <schemaPath>")
    .option(
      "--prefix <prefix>",
      "Only classes with the given prefix will be deleted",
      ""
    )
    .option("--deleteNonEmptyClass", "Delete non-empty classes", false)
    .description("Delete the local schema from Parse Server")
    .action(async (schemaPath: string, options: CLI_DeleteType | undefined) => {
      loadConfig(program.opts().configPath);

      await del(schemaPath, options);
    });

  program
    .command("typescript <typescriptPath>")
    .description("Transform the local schema to Typescript definitions")
    .option("--prefix <prefix>", "Prefix will be stripped from class names", "")
    .option("--ignore <ignore...>", "Class(es) to ignore", "")
    .option(
      "--include <include...>",
      "Class(es) to include (overrides --ignore)",
      ""
    )
    .option("--no-class", "Don't create and register custom Parse.Object")
    .option("--no-sdk", "Don't use Parse JS SDK, just TS without dependencies")
    .option(
      "--import-parse-statement <statement>",
      "Custom import statement for Parse (e.g., 'import Parse from \"parse/node.js\"')",
      ""
    )
    .option("--is-esm", "Use ES module imports in generated files.", false)
    .option(
      "--resolve-referenced-classes",
      "Generate all referenced classes, even if they are not in the fetched schema.",
      false
    )
    .option(
      "--custom-class-field-types-config <path>",
      "Path to .json config file for custom class field types"
    )
    .option(
      "--verbose",
      "Enable verbose logging including dependency graph",
      false
    )
    .action(
      async (
        typescriptPath: string,
        options: TypescriptConversionOptions | undefined
      ) => {
        loadConfig(program.opts().configPath);

        await typescript(typescriptPath, options);
      }
    );

  program
    .command("draw <inputPath>")
    .description(
      "Generate a UML class diagram from a local schema folder. " +
        "Accepts a folder with .json files (output of `down`) or " +
        ".ts files (output of `typescript`), or a single .json file."
    )
    .option(
      "--output <path>",
      "Output file path (default: schema-diagram.mmd / .md / .html)"
    )
    .option(
      "--format <format>",
      "Output format: mermaid | markdown | html (default: mermaid)",
      "mermaid"
    )
    .option(
      "--prefix <prefix>",
      "Only include classes with the given prefix",
      ""
    )
    .option(
      "--font-size <px>",
      "Mermaid font size in pixels for the generated diagram",
      "44"
    )
    .option(
      "--default-renderer <renderer>",
      "Class diagram layout engine: dagre-wrapper | dagre-d3 | elk",
      "elk"
    )
    .option("--ignore <ignore...>", "Class(es) to ignore")
    .action(async (inputPath: string, options: CLI_DrawType) => {
      await draw(inputPath, {
        output: options.output,
        format: options.format,
        prefix: options.prefix || undefined,
        ignore: options.ignore,
        fontSize: Number.parseInt(String(options.fontSize ?? "44"), 10),
        defaultRenderer: options.defaultRenderer,
      });
    });

  await program.parseAsync(process.argv);
}
