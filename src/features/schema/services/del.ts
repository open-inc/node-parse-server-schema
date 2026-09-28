import path from "path";
import { LOG_PREFIX, step } from "../../../helper.js";
import { Config } from "../../config/index.js";
import {
  deleteSchema,
  getLocalSchema,
  getRemoteSchema,
  type DeleteType,
} from "../index.js";

/**
 * Deletes the schema from Parse Server.
 * @param cfg ConfigInterface with publicServerURL, appId and masterKey
 * @param schemaPath The path to the local schema folder.
 * @param options Options for the deletion
 * @param options.prefix Only classes with the given prefix will be deleted. The prefix will be added to the class names in the local schema.
 * @param options.deleteNonEmptyClass Whether to delete non-empty classes when deleting a class. Default is
 */
export async function del(schemaPath: string, options: DeleteType = {}) {
  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  const prefix = options.prefix;

  console.log(
    `${LOG_PREFIX} 🗑️ Deleting classes of ${localSchemaPath} ` +
      `(prefix: ${prefix || "none"}, deleteNonEmptyClass: ${!!options.deleteNonEmptyClass})`
  );

  let localSchema = await step(
    `read local schema from ${localSchemaPath}`,
    () => getLocalSchema(localSchemaPath)
  );

  const serverURL = Config.getInstance().publicServerURL;

  let remoteSchema = await step(`fetch remote schema from ${serverURL}`, () =>
    getRemoteSchema()
  );

  if (prefix) {
    for (const s of localSchema) {
      s.className = prefix + s.className;
    }

    remoteSchema = remoteSchema.filter((s) => s.className.startsWith(prefix));
  }

  console.log(
    `${LOG_PREFIX} Comparing ${localSchema.length} local against ` +
      `${remoteSchema.length} remote classes on ${serverURL}`
  );

  let deleted = 0;

  // delete
  for (const local of localSchema) {
    const remote = remoteSchema.find((s) => s.className === local.className);

    if (remote) {
      console.log(`${LOG_PREFIX} 🗑️ Deleting schema: ${local.className}`);

      await step(`delete class ${local.className}`, () =>
        deleteSchema(local, {
          options: { deleteNonEmptyClass: options.deleteNonEmptyClass },
        })
      );

      deleted++;
    }
  }

  console.log(
    `${LOG_PREFIX} ✅ Schema delete finished: ${deleted} deleted, ` +
      `${localSchema.length - deleted} not on server`
  );
}
