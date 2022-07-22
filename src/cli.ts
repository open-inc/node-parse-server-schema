// @ts-check
require("dotenv").config();

import { Command } from "commander";

import { loadConfig, up, down, typescript, del } from "./index";

main().catch((error) => {
  console.error("Error: " + error.message);
  process.exit(1);
});

async function main() {
  const program = new Command();

  program.option("--configPath <path>", "Path to .js(on) config file");

  program
    .command("down <schemaPath>")
    .option(
      "--prefix <prefix>",
      "Only classes with the given prefix will be pulled",
      ""
    )
    .description("Fetch the schema from Parse Server")
    .action(async (schemaPath, options) => {
      const cfg = await loadConfig(program.opts().configPath);

      await down(cfg, schemaPath, options);
    });

  program
    .command("up <schemaPath>")
    .option(
      "--prefix <prefix>",
      "Only classes with the given prefix will be pushed or removed",
      ""
    )
    .description("Upload the local schema to Parse Server")
    .action(async (schemaPath, options) => {
      const cfg = await loadConfig(program.opts().configPath);

      await up(cfg, schemaPath, options);
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
