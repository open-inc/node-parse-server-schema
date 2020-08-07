const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");

const { program } = require("commander");

const {
  getLocalSchema,
  getRemoteSchema,
  createSchema,
  updateSchema,
  deleteSchema,
} = require("./schema");

const { equals } = require("./helper");

async function main() {
  program.option("--configPath <path>", "Path to .js(on) config file");

  program
    .command("down <schemaPath>")
    .description("Fetch the schema from Parse Server")
    .action(async (schemaPath) => {
      const cfg = await loadConfig(program);

      await down({ program, cfg, schemaPath });
    });

  program
    .command("up <schemaPath>")
    .description("Upload the local schema to Parse Server")
    .action(async (schemaPath) => {
      const cfg = await loadConfig(program);

      await up({ program, cfg, schemaPath });
    });

  program
    .command("typescript [typescriptPath]")
    .description("Transform the local schema to Typescript definitions")
    .option("--prefix [prefix]", "Prefix will be stripped from class names", "")
    .action(async (typescriptPath, options) => {
      const cfg = await loadConfig(program);

      await typescript({ program, options, cfg, typescriptPath });
    });

  await program.parseAsync(process.argv);
}

async function loadConfig(program) {
  const configPath = path.resolve(
    program.configPath || "config/parse-server.config.json"
  );

  if (!fs.existsSync(configPath)) {
    console.error(`No config at '${configPath}'`);
    process.exit(1);
  }

  let config;

  if (configPath.endsWith(".js")) {
    config = require(configPath);
  }

  if (configPath.endsWith(".json")) {
    config = JSON.parse(fs.readFileSync(configPath));
  }

  if (!config) {
    console.error(`Invalid config file type`);
    process.exit(1);
  }

  if (!config.publicServerURL) {
    console.error(`Invalid config: Missing key 'publicServerURL'.`);
    process.exit(1);
  }

  if (!config.appId) {
    console.error(`Invalid config: Missing key 'appId'.`);
    process.exit(1);
  }

  if (!config.masterKey) {
    console.error(`Invalid config: Missing key 'masterKey'.`);
    process.exit(1);
  }

  return config;
}

async function up({ program, cfg, schemaPath }) {
  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  const localSchema = await getLocalSchema(localSchemaPath);
  const remoteSchema = await getRemoteSchema(cfg);

  // update + create
  for (const local of localSchema) {
    const remote = remoteSchema.find((s) => s.className === local.className);

    // update an existing schema
    if (remote && !equals(local, remote)) {
      console.log("update", local.className);

      const fieldsToCreate = [];
      const fieldsToDelete = [];
      const clpToCreate = [];
      const clpToDelete = [];

      // search for fields that are diffrent
      for (const field of Object.keys(local.fields)) {
        if (
          remote.fields[field] &&
          !equals(local.fields[field], remote.fields[field])
        ) {
          fieldsToDelete.push(field);
          fieldsToCreate.push(field);
        }

        if (!remote.fields[field]) {
          fieldsToCreate.push(field);
        }
      }

      for (const field of Object.keys(remote.fields)) {
        if (!local.fields[field]) {
          fieldsToDelete.push(field);
        }
      }

      // search for clp that are different
      for (const clp of Object.keys(local.classLevelPermissions)) {
        if (
          remote.classLevelPermissions[clp] &&
          !equals(
            local.classLevelPermissions[clp],
            remote.classLevelPermissions[clp]
          )
        ) {
          clpToDelete.push(clp);
          clpToCreate.push(clp);
        }

        if (!remote.classLevelPermissions[clp]) {
          clpToCreate.push(clp);
        }
      }

      for (const clp of Object.keys(remote.classLevelPermissions)) {
        if (!local.classLevelPermissions[clp]) {
          clpToDelete.push(clp);
        }
      }

      // delete schema request
      if (fieldsToDelete.length > 0 || clpToDelete.length > 0) {
        await updateSchema(cfg, {
          className: local.className,
          fields: Object.fromEntries(
            fieldsToDelete.map((field) => [field, { __op: "Delete" }])
          ),
          classLevelPermissions: Object.fromEntries(
            clpToDelete.map((clp) => [clp, {}])
          ),
        });
      }

      // create schema request
      if (fieldsToCreate.length > 0 || clpToCreate.length > 0) {
        await updateSchema(cfg, {
          className: local.className,
          fields: Object.fromEntries(
            fieldsToCreate.map((field) => [field, local.fields[field]])
          ),
          classLevelPermissions: Object.fromEntries(
            clpToCreate.map((clp) => [clp, local.classLevelPermissions[clp]])
          ),
        });
      }
    }

    // create a missing schema
    if (!remote) {
      console.log("create", local.className);

      createSchema(cfg, local);
    }
  }

  // delete
  for (const remote of remoteSchema) {
    const local = localSchema.find((s) => s.className === remote.className);

    // delete a missing schema
    if (!local && !equals(local, remote)) {
      console.log("delete", remote.className);
      await deleteSchema(cfg, remote);
    }
  }
}

async function down({ program, cfg, schemaPath }) {
  const schema = await getRemoteSchema(cfg);

  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  if (localSchemaPath.endsWith(".json")) {
    await mkdirp(path.dirname(localSchemaPath));

    fs.writeFileSync(localSchemaPath, JSON.stringify(schema, null, 2));
  } else {
    await mkdirp(localSchemaPath);

    for (const { className, fields, classLevelPermissions } of schema) {
      fs.writeFileSync(
        path.resolve(localSchemaPath, className + ".json"),
        JSON.stringify({ fields, classLevelPermissions }, null, 2)
      );
    }
  }
}

async function typescript({ options, cfg, typescriptPath }) {
  const schema = await getRemoteSchema(cfg);

  const p = (className) => {
    if (options.prefix && className.startsWith(options.prefix)) {
      return className.replace("RideSharing", "");
    }

    return className;
  };

  const tsPath = typescriptPath
    ? path.resolve(typescriptPath)
    : path.resolve(".", "schema", "typescript");

  await mkdirp(tsPath);

  for (const { className, fields } of schema) {
    const dependencies = [];
    const attributes = [];

    for (const [field, fieldAttributes] of Object.entries(fields)) {
      const r = fieldAttributes.required ? "" : "?";

      switch (fieldAttributes.type) {
        case "String":
          attributes.push(`${field}${r}: string;`);
          break;

        case "Number":
          attributes.push(`${field}${r}: number;`);
          break;

        case "Boolean":
          attributes.push(`${field}${r}: boolean;`);
          break;

        case "Object":
          attributes.push(`${field}${r}: any;`);
          break;

        case "Date":
          attributes.push(`${field}${r}: Date;`);
          break;

        case "GeoPoint":
          attributes.push(`${field}${r}: Parse.GeoPoint;`);
          break;

        case "Polygon":
          attributes.push(`${field}${r}: Parse.Polygon;`);
          break;

        case "File":
          attributes.push(`${field}${r}: Parse.File;`);
          break;

        case "Array":
          attributes.push(`${field}${r}: any[];`);
          break;

        case "Pointer":
          dependencies.push(fieldAttributes.targetClass);
          attributes.push(`${field}${r}: ${p(fieldAttributes.targetClass)};`);
          break;

        case "Relation":
          dependencies.push(fieldAttributes.targetClass);
          attributes.push(
            `${field}${r}: Parse.Relation<${p(fieldAttributes.targetClass)}>;`
          );
          break;

        default:
          throw new Error(
            `Parse type '${fieldAttributes.type}' not implemented for typescript conversation.`
          );
      }
    }

    let file = `import Parse from "parse";\n\n`;

    dependencies
      .filter((v) => v !== className)
      .filter((v, i, a) => a.indexOf(v) === i)
      .forEach((dep) => {
        file += `import { ${p(dep)} } from "./${dep}";\n`;
      });

    file += dependencies.length > 0 ? "\n" : "";
    file += `export interface ${p(className)}Attributes {\n`;

    attributes.forEach((attr) => {
      file += `  ${attr}\n`;
    });

    file += "}\n";
    file += "\n";

    if (className === "_Session") {
      file += `export type ${className} = Parse.Session<${className}Attributes>;\n`;
    } else if (className === "_User") {
      file += `export type ${className} = Parse.User<${className}Attributes>;\n`;
    } else if (className === "_Role") {
      file += `export type ${className} = Parse.Role<${className}Attributes>;\n`;
    } else {
      file += `export class ${p(className)} extends Parse.Object<${p(
        className
      )}Attributes> {\n`;
      file += `  constructor(data: ${p(className)}Attributes) {\n`;
      file += `    super("${className}", data);\n`;
      file += `  }\n`;
      file += `}\n`;
      file += "\n";
      file += `Parse.Object.registerSubclass("${className}", ${p(
        className
      )});\n`;
    }

    fs.writeFileSync(path.resolve(tsPath, className + ".ts"), file);
  }

  fs.writeFileSync(
    path.resolve(tsPath, "index.ts"),
    schema
      .map((field) => field.className)
      .map((className) => `export { ${p(className)} } from "./${className}";`)
      .join("\n") + "\n"
  );
}

main().catch((error) => console.error("Error: " + error.message));
