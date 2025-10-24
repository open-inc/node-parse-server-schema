import path from "path";
import { equals } from "../../../helper.js";
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

  let localSchema = await getLocalSchema(
    localSchemaPath,
    options.prefix || "",
    options.filter
  );
  let remoteSchema = await getRemoteSchema();

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

  const prefix = options.prefix;
  const deleteClasses = options.deleteClasses ?? true;
  const deleteFields = options.deleteFields ?? true;
  const deleteNonEmptyClass = options.deleteNonEmptyClass ?? false;

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
      console.log(
        `[@openinc/parse-server-schema] 🔄 Updating schema: ${local.className}`
      );

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
          await updateSchema({
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
        await updateSchema({
          className: local.className,
          fields: Object.fromEntries(
            fieldsToCreate.map((field) =>
              [field, local.fields[field]].filter(Boolean)
            )
          ),
          classLevelPermissions: local.classLevelPermissions,
        });
      }
    }

    // create a missing schema
    if (!remote) {
      console.log(
        `[@openinc/parse-server-schema] ➕ Creating schema: ${local.className}`
      );

      await createSchema(local);
    }
  }

  // delete
  for (const remote of remoteSchema) {
    const local = localSchema.find((s) => s.className === remote.className);

    // delete a missing schema
    if (!local && !equals(local, remote)) {
      if (deleteClasses) {
        console.log(
          `[@openinc/parse-server-schema] 🗑️ Deleting schema: ${remote.className}`
        );
        await deleteSchema(remote, {
          options: { deleteNonEmptyClass: deleteNonEmptyClass },
        });
      } else {
        console.warn(
          "[@openinc/parse-server-schema] Skip deleting class: " +
            remote.className
        );
      }
    }
  }
}
