import fs from "fs";
import { mkdirp } from "mkdirp";
import path from "path";
import { getRemoteSchema, type DownType } from "../index.js";

/**
 * Fetches the schema from Parse Server and saves it to a local file or folder.
 * @param cfg ConfigInterface with publicServerURL, appId and masterKey
 * @param schemaPath The path to the local schema folder. If it ends with .json it will be saved as a single file, otherwise as multiple files in a folder.
 * @param options Options
 * @param options.prefix Only classes with the given prefix will be pulled. The prefix will be removed from the class names in the local schema.
 * @param options.ignore Class(es) to ignore. You can use * at the end to ignore all classes that start with the given string.
 */
export async function down(schemaPath: string, options: DownType = {}) {
  let schema = await getRemoteSchema();

  const prefix = options.prefix;

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
