// @ts-check
require("dotenv").config();

import { program } from "commander";

import { loadConfig, up, down, typescript } from "./index";

main().catch((error) => {
  console.error("Error: " + error.message);
  process.exit(1);
});

async function main() {
  program.option("--configPath <path>", "Path to .js(on) config file");

  program
    .command("down <schemaPath>")
    .description("Fetch the schema from Parse Server")
    .action(async (schemaPath) => {
      const cfg = await loadConfig(program.configPath);

      await down(cfg, schemaPath);
    });

  program
    .command("up <schemaPath>")
    .description("Upload the local schema to Parse Server")
    .action(async (schemaPath) => {
      const cfg = await loadConfig(program.configPath);

      await up(cfg, schemaPath);
    });

  program
    .command("typescript [typescriptPath]")
    .description("Transform the local schema to Typescript definitions")
    .option("--prefix [prefix]", "Prefix will be stripped from class names", "")
    .option("--no-sdk", "Don't use Parse JS SDK, just TS without dependencies")
    .action(async (typescriptPath, options) => {
      const cfg = await loadConfig(program.configPath);

      await typescript(cfg, typescriptPath, options);
    });

  await program.parseAsync(process.argv);
}
