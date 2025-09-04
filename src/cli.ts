import 'dotenv/config';

import pkg from "../package.json" with { type: "json" };

import { Command } from "commander";
import { loadConfig, printConfig } from './features/config/index.js';
import { del, down, typescript, up } from './features/schema/index.js';

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
      const cfg = await loadConfig(program.opts().configPath);

      printConfig(cfg);
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
    .action(async (schemaPath, options) => {
      const cfg = await loadConfig(program.opts().configPath, {
        operation: "down",
      });

      await down(cfg, schemaPath, options);
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
    .action(async (schemaPath, options) => {
      const cfg = await loadConfig(program.opts().configPath, {
        operation: "up",
      });

      await up(cfg, schemaPath, {
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
    .action(async (schemaPath, options) => {
      const cfg = await loadConfig(program.opts().configPath);

      await del(cfg, schemaPath, options);
    });

  program
    .command("typescript <typescriptPath>")
    .description("Transform the local schema to Typescript definitions")
    .option("--prefix <prefix>", "Prefix will be stripped from class names", "")
    .option("--ignore <ignore...>", "Class(es) to ignore", "")
    .option("--no-class", "Don't create and register custom Parse.Object")
    .option("--no-sdk", "Don't use Parse JS SDK, just TS without dependencies")
    .option("--global-sdk", "Use a global Parse JS SDK", false)
    .option("--is-esm", "Use ES module imports in generated files.", false)
    .option("--custom-class-field-types-config <path>", "Path to .json config file for custom class field types")
    .action(async (typescriptPath, options) => {
      const cfg = await loadConfig(program.opts().configPath);

      await typescript(cfg, typescriptPath, options);
    });

  await program.parseAsync(process.argv);
}
