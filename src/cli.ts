import 'dotenv/config';

import pkg from "../package.json" with { type: "json" };

// @ts-ignore
import { Command } from 'commander';
import { loadConfig, printConfig } from './features/config/index.js';
import { del, down, typescript, up, type TypescriptConversionOptions } from './features/schema/index.js';

main().catch((error) => {
  console.error("Error: " + error.message);
  process.exit(1);
});

async function main() {
  const program = new Command();

  program.version(pkg.version);

  program
    .option("--configPath <path>", "Path to .js(on) config file");

  program
    .command("config")
    .description("Returns the current configuration")
    .action(async () => {
      await loadConfig(program.opts().configPath);

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
    .action(async (schemaPath: string, options: { prefix?: string; ignore?: string[]; } | undefined) => {
      await loadConfig(program.opts().configPath, {
        operation: "down",
      });

      await down( schemaPath, options);
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
    .action(async (schemaPath: string, options: { prefix: any; ignore: any; safe: any; deleteNonEmptyClass: any; }) => {
      await loadConfig(program.opts().configPath, {
        operation: "up",
      });

      await up( schemaPath, {
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
    .action(async (schemaPath: string, options: { prefix?: string; deleteNonEmptyClass?: boolean; } | undefined) => {
      await loadConfig(program.opts().configPath);

      await del( schemaPath, options);
    });

  program
    .command("typescript <typescriptPath>")
    .description("Transform the local schema to Typescript definitions")
    .option("--prefix <prefix>", "Prefix will be stripped from class names", "")
    .option("--ignore <ignore...>", "Class(es) to ignore", "")
    .option("--include <include...>", "Class(es) to include (overrides --ignore)", "")
    .option("--no-class", "Don't create and register custom Parse.Object")
    .option("--no-sdk", "Don't use Parse JS SDK, just TS without dependencies")
    .option("--global-sdk", "Use a global Parse JS SDK", false)
    .option("--is-esm", "Use ES module imports in generated files.", false)
    .option("--resolve-referenced-classes", "Generate all referenced classes, even if they are not in the fetched schema.", false)
    .option("--custom-class-field-types-config <path>", "Path to .json config file for custom class field types")
    .option("--verbose", "Enable verbose logging including dependency graph", false)
    .action(async (typescriptPath: string, options: TypescriptConversionOptions | undefined) => {
       await loadConfig(program.opts().configPath);

      await typescript(typescriptPath, options);
    });

  await program.parseAsync(process.argv);
}
