import path from "path";
import { equals, LOG_PREFIX, step } from "../../../helper.js";
import { Config } from "../../config/index.js";
import {
  createSchema,
  deleteSchema,
  getLocalSchema,
  getRemoteSchema,
  updateSchema,
  type UpType,
} from "../index.js";

/**
 * Uploads the local schema to Parse Server.
 * @param cfg ConfigInterface with publicServerURL, appId and masterKey
 * @param schemaPath The path to the local schema folder.
 * @param options Options for the upload
 * @param options.ignore Class(es) to ignore. You can use * at the end to ignore all classes that start with the given string.
 * @param options.prefix Only classes with the given prefix will be pushed or removed. The prefix will be added to the class names in the local schema.
 * @param options.deleteClasses Whether to delete classes that are not in the local schema. Default is true.
 * @param options.deleteFields Whether to delete fields that are not in the local schema. Default is true.
 * @param options.deleteNonEmptyClass Whether to delete non-empty classes when deleting a class. Default is
 */
export async function up(schemaPath: string, options: UpType = {}) {
  const localSchemaPath = schemaPath
    ? path.resolve(schemaPath)
    : path.resolve(".", "schema", "classes");

  const prefix = options.prefix;
  const deleteClasses = options.deleteClasses ?? true;
  const deleteFields = options.deleteFields ?? true;
  const deleteNonEmptyClass = options.deleteNonEmptyClass ?? false;

  console.log(
    `${LOG_PREFIX} ⬆️ Uploading schema from ${localSchemaPath} ` +
      `(prefix: ${prefix || "none"}, deleteClasses: ${deleteClasses}, ` +
      `deleteFields: ${deleteFields}, deleteNonEmptyClass: ${deleteNonEmptyClass})`
  );

  let localSchema = await step(
    `read local schema from ${localSchemaPath}`,
    () => getLocalSchema(localSchemaPath, options.prefix || "", options.filter)
  );

  const serverURL = Config.getInstance().publicServerURL;

  let remoteSchema = await step(`fetch remote schema from ${serverURL}`, () =>
    getRemoteSchema()
  );

  if (Array.isArray(options.ignore)) {
    for (let ignore of options.ignore) {
      if (ignore.endsWith("*")) {
        ignore = ignore.slice(0, -1);

        remoteSchema = remoteSchema.filter(
          (s) => !s.className.startsWith(ignore)
        );
      } else {
        remoteSchema = remoteSchema.filter((s) => s.className !== ignore);
      }
    }
  }

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

  console.log(
    `${LOG_PREFIX} Comparing ${localSchema.length} local against ` +
      `${remoteSchema.length} remote classes on ${serverURL}`
  );

  const summary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    skippedDeletes: 0,
  };

  // update + create
  for (const local of localSchema) {
    const remote = remoteSchema.find((s) => s.className === local.className);

    if (remote && equals(local, remote)) {
      summary.unchanged++;
    }

    // update an existing schema
    if (remote && !equals(local, remote)) {
      const fieldsToCreate: string[] = [];
      const fieldsToDelete: string[] = [];
      const fieldsChanged: string[] = [];
      const fieldsAdded: string[] = [];
      const fieldsRemoved: string[] = [];

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
          fieldsChanged.push(field);
        }

        if (!remote.fields[field]) {
          fieldsToCreate.push(field);
          fieldsAdded.push(field);
        }
      }

      for (const field of Object.keys(remote.fields)) {
        if (!local.fields[field]) {
          fieldsToDelete.push(field);
          fieldsRemoved.push(field);
        }
      }

      const changes = [
        fieldsAdded.length > 0 && `added: ${fieldsAdded.join(", ")}`,
        fieldsChanged.length > 0 && `changed: ${fieldsChanged.join(", ")}`,
        fieldsRemoved.length > 0 && `removed: ${fieldsRemoved.join(", ")}`,
        clpChanged && "classLevelPermissions changed",
      ].filter(Boolean);

      console.log(
        `${LOG_PREFIX} 🔄 Updating schema: ${local.className} (${changes.join("; ")})`
      );

      for (const field of fieldsChanged) {
        console.log(
          `${LOG_PREFIX}    ${local.className}.${field}: ` +
            `${JSON.stringify(remote.fields[field])} -> ` +
            `${JSON.stringify(local.fields[field])}`
        );
      }

      // delete schema request
      if (fieldsToDelete.length > 0 || clpChanged) {
        if (deleteFields) {
          await step(
            `delete fields of ${local.className} (${fieldsToDelete.join(", ") || "none, classLevelPermissions only"})`,
            () =>
              updateSchema({
                className: local.className,
                // @ts-ignore
                fields: Object.fromEntries(
                  fieldsToDelete.map((field) => [field, { __op: "Delete" }])
                ),
                classLevelPermissions: local.classLevelPermissions,
              })
          );
        } else if (fieldsToDelete.length > 0) {
          console.warn(
            `${LOG_PREFIX} Skip deleting fields of ${local.className}: ` +
              fieldsToDelete.join(", ")
          );

          for (const fieldName of fieldsToDelete) {
            const index = fieldsToCreate.indexOf(fieldName);

            if (index >= 0) {
              console.warn(
                `${LOG_PREFIX} Can't update field: ${local.className}.${fieldName}`
              );

              fieldsToCreate.splice(index, 1);
            }
          }
        }
      }

      // create schema request
      if (fieldsToCreate.length > 0 || clpChanged) {
        await step(
          `create fields of ${local.className} (${fieldsToCreate.join(", ") || "none, classLevelPermissions only"})`,
          () =>
            updateSchema({
              className: local.className,
              fields: Object.fromEntries(
                fieldsToCreate.map((field) =>
                  [field, local.fields[field]].filter(Boolean)
                )
              ),
              classLevelPermissions: local.classLevelPermissions,
            })
        );
      }

      summary.updated++;
    }

    // create a missing schema
    if (!remote) {
      console.log(`${LOG_PREFIX} ➕ Creating schema: ${local.className}`);

      await step(`create class ${local.className}`, () => createSchema(local));

      summary.created++;
    }
  }

  // delete
  for (const remote of remoteSchema) {
    const local = localSchema.find((s) => s.className === remote.className);

    // delete a missing schema
    if (!local && !equals(local, remote)) {
      if (deleteClasses) {
        console.log(`${LOG_PREFIX} 🗑️ Deleting schema: ${remote.className}`);

        await step(`delete class ${remote.className}`, () =>
          deleteSchema(remote, {
            options: { deleteNonEmptyClass: deleteNonEmptyClass },
          })
        );

        summary.deleted++;
      } else {
        console.warn(`${LOG_PREFIX} Skip deleting class: ${remote.className}`);

        summary.skippedDeletes++;
      }
    }
  }

  console.log(
    `${LOG_PREFIX} ✅ Schema upload finished: ${summary.created} created, ` +
      `${summary.updated} updated, ${summary.unchanged} unchanged, ` +
      `${summary.deleted} deleted, ${summary.skippedDeletes} deletes skipped`
  );
}
