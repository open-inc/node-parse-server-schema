// @ts-check
require("dotenv").config();

// @ts-ignore
import pkg from "../package.json";

import { Command } from "commander";
import { del, down, loadConfig, typescript, up } from "./index";

main().catch((error) => {
  console.error("Error: " + error.message);
  process.exit(1);
});

async function main() {
  const program = new Command();

  program.version(pkg.version);

  program.option("--configPath <path>", "Path to .js(on) config file");

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
      });
    });

  program
    .command("delete <schemaPath>")
    .option(
      "--prefix <prefix>",
      "Only classes with the given prefix will be deleted",
      ""
    )
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
    .action(async (typescriptPath, options) => {
      const cfg = await loadConfig(program.opts().configPath);

      await typescript(cfg, typescriptPath, options);
    });

  await program.parseAsync(process.argv);
}
