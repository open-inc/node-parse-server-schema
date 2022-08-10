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
import { ConfigInterface, SchemaInterface } from "./types";

export async function loadConfig(
  configPath?: string
): Promise<ConfigInterface> {
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
    console.log("[@openinc/parse-server-schema] Using config from process.env");

    return {
      publicServerURL: PARSE_PUBLIC_SERVER_URL,
      appId: PARSE_SERVER_APPLICATION_ID,
      masterKey: PARSE_SERVER_MASTER_KEY,
    };
  }

  configPath = path.resolve(configPath || "config/parse-server.config.json");

  if (!fs.existsSync(configPath)) {
    console.error(
      `[@openinc/parse-server-schema] No config at '${configPath}'`
    );
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
    console.error(`[@openinc/parse-server-schema] Invalid config file type`);
    process.exit(1);
  }

  if (!config.publicServerURL) {
    console.error(
      `[@openinc/parse-server-schema] Invalid config: Missing key 'publicServerURL'.`
    );
    process.exit(1);
  }

  if (!config.appId) {
    console.error(
      `[@openinc/parse-server-schema] Invalid config: Missing key 'appId'.`
    );
    process.exit(1);
  }

  if (!config.masterKey) {
    console.error(
      `[@openinc/parse-server-schema] Invalid config: Missing key 'masterKey'.`
    );
    process.exit(1);
  }

  return config;
}

export async function up(
  cfg: ConfigInterface,
  schemaPath: string,
  options: {
    prefix?: string;
    deleteClasses?: boolean;
    deleteFields?: boolean;
  } = {}
) {
  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  let localSchema = await getLocalSchema(localSchemaPath);
  let remoteSchema = await getRemoteSchema(cfg);

  const prefix = options.prefix;
  const deleteClasses = options.deleteClasses ?? true;
  const deleteFields = options.deleteFields ?? true;

  if (prefix) {
    for (const s of localSchema) {
      s.className = prefix + s.className;

      for (const field of Object.values(s.fields)) {
        if (
          "targetClass" in field &&
          field.targetClass?.startsWith("{{PREFIX}}")
        ) {
          field.targetClass = field.targetClass.replace("{{PREFIX}}", prefix);
        }
      }
    }

    remoteSchema = remoteSchema.filter((s) => s.className.startsWith(prefix));
  }

  // update + create
  for (const local of localSchema) {
    const remote = remoteSchema.find((s) => s.className === local.className);

    // update an existing schema
    if (remote && !equals(local, remote)) {
      console.log("[@openinc/parse-server-schema] update", local.className);

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
        if (deleteFields) {
          await updateSchema(cfg, {
            className: local.className,
            // @ts-ignore
            fields: Object.fromEntries(
              fieldsToDelete.map((field) => [field, { __op: "Delete" }])
            ),
            classLevelPermissions: local.classLevelPermissions,
          });
        } else {
          console.warn(
            "[@openinc/parse-server-schema] Skip deleting fields: " +
              fieldsToDelete.join(", ")
          );

          for (const fieldName of fieldsToDelete) {
            const index = fieldsToCreate.indexOf(fieldName);

            if (index >= 0) {
              console.warn(
                `[@openinc/parse-server-schema] Can't update field: ${fieldName}`
              );

              fieldsToCreate.splice(index, 1);
            }
          }
        }
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
      console.log("[@openinc/parse-server-schema] create", local.className);

      createSchema(cfg, local);
    }
  }

  // delete
  for (const remote of remoteSchema) {
    const local = localSchema.find((s) => s.className === remote.className);

    // delete a missing schema
    if (!local && !equals(local, remote)) {
      if (deleteClasses) {
        console.log("[@openinc/parse-server-schema] delete", remote.className);
        await deleteSchema(cfg, remote);
      } else {
        console.warn(
          "[@openinc/parse-server-schema] Skip deleting class: " +
            remote.className
        );
      }
    }
  }
}

export async function del(
  cfg: ConfigInterface,
  schemaPath: string,
  options: {
    prefix?: string;
  } = {}
) {
  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  let localSchema = await getLocalSchema(localSchemaPath);
  let remoteSchema = await getRemoteSchema(cfg);

  const prefix = options.prefix;

  if (prefix) {
    for (const s of localSchema) {
      s.className = prefix + s.className;
    }

    remoteSchema = remoteSchema.filter((s) => s.className.startsWith(prefix));
  }

  // delete
  for (const local of localSchema) {
    const remote = remoteSchema.find((s) => s.className === local.className);

    if (remote) {
      console.log("[@openinc/parse-server-schema] delete", local.className);
      await deleteSchema(cfg, local);
    }
  }
}

export async function down(
  cfg: ConfigInterface,
  schemaPath: string,
  options: {
    prefix?: string;
  } = {}
) {
  let schema = await getRemoteSchema(cfg);

  const prefix = options.prefix;

  if (prefix) {
    schema = schema.filter((s) => s.className.startsWith(prefix));

    for (const s of schema) {
      s.className = s.className.replace(prefix, "");

      for (const field of Object.values(s.fields)) {
        if (
          (field.type === "Pointer" || field.type === "Relation") &&
          field.targetClass?.startsWith(prefix)
        ) {
          field.targetClass = field.targetClass.replace(prefix, "{{PREFIX}}");
        }
      }
    }
  }

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
    prefix?: string;
    ignore?: string[];
    sdk?: boolean;
    globalSdk?: boolean;
    class?: boolean;
  }
) {
  let schema = await getRemoteSchema(cfg);

  const prefix = (options.prefix ||= "");

  options.sdk ??= true;
  options.globalSdk ??= false;
  options.class ??= false;

  if (prefix) {
    schema = schema.filter(
      (s) => s.className.startsWith(prefix) || s.className.startsWith("_")
    );
  }

  if (Array.isArray(options.ignore)) {
    for (let ignore of options.ignore) {
      if (ignore.endsWith("*")) {
        ignore = ignore.slice(0, -1);

        schema = schema.filter((s) => !s.className.startsWith(ignore));
      } else {
        schema = schema.filter((s) => s.className !== ignore);
      }
    }
  }

  const p = (className: string) => {
    if (prefix && className.startsWith(prefix)) {
      return className.replace(prefix, "");
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
    const getter = [];

    if (options.sdk) {
      attributes.push("id: string;");
      attributes.push("objectId: string;");
      attributes.push("createdAt: Date;");
      attributes.push("updatedAt: Date;");
    } else {
      attributes.push("objectId: string;");
      attributes.push("createdAt: string;");
      attributes.push("updatedAt: string;");
    }

    attributes.push("");

    const ignoreFields = ["id", "objectId", "createdAt", "updatedAt"];

    const fieldEntries = Object.entries(fields).filter(
      ([name]) => !ignoreFields.includes(name)
    );

    fieldEntries.sort(([a], [b]) => a.localeCompare(b));

    for (const [field, fieldAttributes] of fieldEntries) {
      if (
        "targetClass" in fieldAttributes &&
        fieldAttributes.targetClass !== className
      ) {
        dependencies.push(fieldAttributes.targetClass);
      }

      const type = getTypescriptFieldType(
        fieldAttributes,
        options.sdk,
        p,
        className
      );
      const nullable = getTypescriptFieldNullable(fieldAttributes);

      const r = nullable ? "" : "?";
      const u = nullable ? "" : " | undefined";

      if (fieldAttributes.type === "Relation") {
        attributes.push(`${field}: ${type};`);

        getter.push(`get ${field}(): ${type} {`);
        getter.push(`  return super.relation("${field}");`);
        getter.push(`}`);
      } else {
        attributes.push(`${field}${r}: ${type};`);

        getter.push(`get ${field}(): ${type}${u} {`);
        getter.push(`  return super.get("${field}");`);
        getter.push(`}`);

        getter.push(`set ${field}(value: ${type}${u}) {`);
        getter.push(`  super.set("${field}", value);`);
        getter.push(`}`);
      }
    }

    let file = "";

    if (options.sdk && !options.globalSdk) {
      file += `import Parse from "parse";\n\n`;
    }

    if (options.sdk) {
      const uniqueDependencies = dependencies
        .filter((v) => v !== p(className))
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

      const externalDependencies = uniqueDependencies.filter((v) => {
        if (v.startsWith("_")) {
          return false;
        }

        if (prefix && v.startsWith(prefix)) {
          return false;
        }

        return true;
      });

      const internalDependencies = uniqueDependencies.filter(
        (v) => !externalDependencies.includes(v)
      );

      internalDependencies.forEach((dep) => {
        file += `import type { ${p(dep)}${
          options.sdk ? "" : "Attributes"
        } } from "./${p(dep)}";\n`;
      });

      if (internalDependencies.length > 0) {
        file += "\n";
      }

      externalDependencies.forEach((dep) => {
        file += `type ${p(dep)} = Parse.Object;\n`;
      });

      if (externalDependencies.length > 0) {
        file += "\n";
      }
    }
    file += `export interface ${p(className)}Attributes {\n`;

    attributes.forEach((attr) => {
      if (attr) {
        file += `  ${attr}\n`;
      } else {
        file += "\n";
      }
    });

    file += "}\n";

    if (options.sdk && options.class) {
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
        file += `  static className: string = "${className}";\n\n`;
        file += `  constructor(data?: Partial<${p(className)}Attributes>) {\n`;
        file += `    super("${className}", data as ${p(
          className
        )}Attributes);\n`;
        file += `  }\n`;

        file += "\n";

        getter.forEach((attr) => {
          if (attr) {
            file += `  ${attr}\n`;
          } else {
            file += "\n";
          }
        });

        file += `}\n`;
        file += "\n";
        file += `Parse.Object.registerSubclass("${className}", ${p(
          className
        )});\n`;
      }
    }

    if (options.sdk && !options.class) {
      file += "\n";

      if (className === "_Session") {
        file += `export type ${className} = Parse.Session<${className}Attributes>;\n`;
      } else if (className === "_User") {
        file += `export type ${className} = Parse.User<${className}Attributes>;\n`;
      } else if (className === "_Role") {
        file += `export type ${className} = Parse.Role<${className}Attributes>;\n`;
      } else {
        file += `export type ${p(className)} = Parse.Object<${p(
          className
        )}Attributes>;\n`;
      }
    }

    fs.writeFileSync(path.resolve(tsPath, p(className) + ".ts"), file);
  }

  if (options.sdk) {
    fs.writeFileSync(
      path.resolve(tsPath, "index.ts"),
      schema
        .map((field) => field.className)
        .map(
          (className) =>
            `export { ${p(className)} } from "./${p(
              className
            )}";\nexport type { ${p(className)}Attributes } from "./${p(
              className
            )}";\n`
        )
        .join("\n") + "\n"
    );
  } else {
    fs.writeFileSync(
      path.resolve(tsPath, "index.ts"),
      schema
        .map((field) => field.className)
        .map(
          (className) =>
            `export { ${p(className)}Attributes } from "./${p(className)}";`
        )
        .join("\n") + "\n"
    );
  }
}

function getTypescriptFieldNullable(
  fieldAttributes: SchemaInterface["fields"][0]
) {
  return fieldAttributes.required || "defaultValue" in fieldAttributes;
}

function getTypescriptFieldType(
  fieldAttributes: SchemaInterface["fields"][0],
  sdk: boolean,
  p: (className: string) => string,
  className: string
) {
  switch (fieldAttributes.type) {
    case "String":
      return "string";

    case "Number":
      return `number`;

    case "Boolean":
      return `boolean`;

    case "Object":
      return `any`;

    case "Array":
      return `any[]`;

    case "Date":
      if (sdk) {
        return `Date`;
      } else {
        return `{ __type: "Date"; iso: string }`;
      }

    case "GeoPoint":
      if (sdk) {
        return `Parse.GeoPoint`;
      } else {
        return `{ __type: "GeoPoint"; latitude: number; longitude: number };`;
      }

    case "Polygon":
      if (sdk) {
        return `Parse.Polygon`;
      } else {
        return `{ __type: "Polygon"; coordinates: [number, number][] };`;
      }

    case "File":
      if (sdk) {
        return `Parse.File`;
      } else {
        return `{ __type: "File"; name: string; url: string };`;
      }

    case "Pointer":
      const pointerTarget = p(fieldAttributes.targetClass);

      if (sdk) {
        return `${pointerTarget}`;
      } else {
        // return(
        //   `${pointerTarget}Attributes;`
        // );
        return `{ __type: "Pointer", className: "${pointerTarget}", objectId: string };`;
      }

    case "Relation":
      const relationTarget = p(fieldAttributes.targetClass);

      if (sdk) {
        return `Parse.Relation<${p(className)}, ${relationTarget}>`;
      } else {
        return `{ __type: "Pointer", className: "${relationTarget}";`;
      }

    default:
      throw new Error(
        // @ts-ignore
        `Parse type '${fieldAttributes.type}' not implemented for typescript conversation.`
      );
  }
}
