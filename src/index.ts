import fs from "fs";
import path from "path";
import mkdirp from "mkdirp";

import {
  getLocalSchema,
  getRemoteSchema,
  createSchema,
  updateSchema,
  deleteSchema,
} from "./schema";

import { equals } from "./helper";
import { ConfigInterface } from "./types";

export async function loadConfig(configPath: string): Promise<ConfigInterface> {
  const {
    PARSE_SERVER_APPLICATION_ID,
    PARSE_SERVER_MASTER_KEY,
    PARSE_PUBLIC_SERVER_URL,
  } = process.env;

  if (
    PARSE_SERVER_APPLICATION_ID &&
    PARSE_SERVER_MASTER_KEY &&
    PARSE_PUBLIC_SERVER_URL
  ) {
    console.log("Using config from process.env");

    return {
      publicServerURL: PARSE_PUBLIC_SERVER_URL,
      appId: PARSE_SERVER_APPLICATION_ID,
      masterKey: PARSE_SERVER_MASTER_KEY,
    };
  }

  configPath = path.resolve(configPath || "config/parse-server.config.json");

  if (!fs.existsSync(configPath)) {
    console.error(`No config at '${configPath}'`);
    process.exit(1);
  }

  let config;

  if (configPath.endsWith(".js")) {
    config = require(configPath);
  }

  if (configPath.endsWith(".json")) {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
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

export async function up(cfg: ConfigInterface, schemaPath: string) {
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

      const clpChanged = !equals(
        local.classLevelPermissions,
        remote.classLevelPermissions
      );

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

      // delete schema request
      if (fieldsToDelete.length > 0 || clpChanged) {
        await updateSchema(cfg, {
          className: local.className,
          // @ts-ignore
          fields: Object.fromEntries(
            fieldsToDelete.map((field) => [field, { __op: "Delete" }])
          ),
          classLevelPermissions: local.classLevelPermissions,
        });
      }

      // create schema request
      if (fieldsToCreate.length > 0 || clpChanged) {
        await updateSchema(cfg, {
          className: local.className,
          fields: Object.fromEntries(
            fieldsToCreate.map((field) => [field, local.fields[field]])
          ),
          classLevelPermissions: local.classLevelPermissions,
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

export async function down(cfg: ConfigInterface, schemaPath: string) {
  const schema = await getRemoteSchema(cfg);

  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  if (localSchemaPath.endsWith(".json")) {
    await mkdirp(path.dirname(localSchemaPath));

    fs.writeFileSync(localSchemaPath, JSON.stringify(schema, null, 2) + "\n");
  } else {
    await mkdirp(localSchemaPath);

    for (const { className, fields, classLevelPermissions } of schema) {
      fs.writeFileSync(
        path.resolve(localSchemaPath, className + ".json"),
        JSON.stringify({ fields, classLevelPermissions }, null, 2) + "\n"
      );
    }
  }
}

export async function typescript(
  cfg: ConfigInterface,
  typescriptPath: string,
  options: {
    prefix: string;
    sdk: string;
  }
) {
  const schema = await getRemoteSchema(cfg);

  const sdk = options.sdk;

  const p = (className: string) => {
    if (options.prefix && className.startsWith(options.prefix)) {
      return className.replace(options.prefix, "");
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

    if (!sdk) {
      attributes.push("objectId: string;");
      attributes.push("createdAt: Date;");
      attributes.push("updatedAt: Date;");
    }

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

          if (sdk) {
            attributes.push(`${field}${r}: ${p(fieldAttributes.targetClass)};`);
          } else {
            // attributes.push(
            //   `${field}${r}: ${p(fieldAttributes.targetClass)}Attributes;`
            // );
            attributes.push(
              `${field}${r}: { __type: "Pointer", className: "${fieldAttributes.targetClass}", objectId: string};`
            );
          }
          break;

        case "Relation":
          dependencies.push(fieldAttributes.targetClass);
          attributes.push(
            `${field}${r}: Parse.Relation<${p(fieldAttributes.targetClass)}>;`
          );
          break;

        default:
          throw new Error(
            // @ts-ignore
            `Parse type '${fieldAttributes.type}' not implemented for typescript conversation.`
          );
      }
    }

    let file = "";

    if (sdk) {
      file += `import Parse from "parse";\n\n`;
    }

    if (sdk) {
      dependencies
        .filter((v) => v !== className)
        .filter((v, i, a) => a.indexOf(v) === i)
        .forEach((dep) => {
          file += `import { ${p(dep)}${
            sdk ? "" : "Attributes"
          } } from "./${dep}";\n`;
        });

      file += dependencies.length > 0 ? "\n" : "";
    }
    file += `export interface ${p(className)}Attributes {\n`;

    attributes.forEach((attr) => {
      file += `  ${attr}\n`;
    });

    file += "}\n";

    if (sdk) {
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
    }

    fs.writeFileSync(path.resolve(tsPath, className + ".ts"), file);
  }

  if (sdk) {
    fs.writeFileSync(
      path.resolve(tsPath, "index.ts"),
      schema
        .map((field) => field.className)
        .map((className) => `export { ${p(className)} } from "./${className}";`)
        .join("\n") + "\n"
    );
  } else {
    fs.writeFileSync(
      path.resolve(tsPath, "index.ts"),
      schema
        .map((field) => field.className)
        .map(
          (className) =>
            `export { ${p(className)}Attributes } from "./${className}";`
        )
        .join("\n") + "\n"
    );
  }
}
