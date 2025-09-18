import path from "path";
import { deleteSchema, getLocalSchema, getRemoteSchema } from "../index.js";

/**
 * Deletes the schema from Parse Server.
 * @param cfg ConfigInterface with publicServerURL, appId and masterKey
 * @param schemaPath The path to the local schema folder.
 * @param options Options for the deletion
 * @param options.prefix Only classes with the given prefix will be deleted. The prefix will be added to the class names in the local schema.
 * @param options.deleteNonEmptyClass Whether to delete non-empty classes when deleting a class. Default is
 */
export async function del(
  schemaPath: string,
  options: {
    prefix?: string;
    deleteNonEmptyClass?: boolean;
  } = {}
) {
  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  let localSchema = await getLocalSchema(localSchemaPath);
  let remoteSchema = await getRemoteSchema();

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
      console.log(
        `[@openinc/parse-server-schema] 🗑️ Deleting schema: ${local.className}`
      );
      await deleteSchema(local, {
        options: { deleteNonEmptyClass: options.deleteNonEmptyClass },
      });
    }
  }
}
