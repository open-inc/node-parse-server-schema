import fs from "fs";
import path from "path";
import { deepClone, fetchHandler } from "../../../helper.js";
import type { ConfigInterface } from "../../config/index.js";
import type { SchemaInterface } from "../index.js";

export function pickSchema(schema: SchemaInterface): SchemaInterface {
  if (!schema) {
    throw new Error("Schema not found.");
  }

  if (!schema.className) {
    throw new Error("Schema is missing 'className' key.");
  }

  schema = deepClone(schema);

  if (schema.fields) {
    delete schema.fields.objectId;
    delete schema.fields.createdAt;
    delete schema.fields.updatedAt;
    delete schema.fields.ACL;
  }

  return {
    className: schema.className,
    fields: schema.fields || {},
    classLevelPermissions: schema.classLevelPermissions || {},
  };
}

export async function getLocalSchema(
  schemaPath: string,
  prefix: string = "",
  filter?: (className: string) => boolean
): Promise<SchemaInterface[]> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No local schema at '${schemaPath}'`);
  }

  let schema: SchemaInterface[] = [];

  if (schemaPath.endsWith(".json")) {
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")).map(pickSchema);
  } else {
    schema = fs
      .readdirSync(schemaPath)
      .filter((p) => p.endsWith(".json"))
      .map((p) => ({
        className: p.replace(".json", ""),
        ...JSON.parse(fs.readFileSync(path.resolve(schemaPath, p), "utf-8")),
      }))
      .map(pickSchema);
  }

  if (filter) {
    schema = schema.filter((s) => filter(prefix + s.className));
  }

  return schema;
}

export async function getRemoteSchema<T>(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  filter?: (className: string) => boolean
): Promise<SchemaInterface[]> {
  let schema: SchemaInterface[] = await fetchHandler<T>({
    url: publicServerURL + "/schemas",
    options: {
      headers: {
        "X-Parse-Application-Id": appId,
        "X-Parse-Master-Key": masterKey,
      },
    },
  })
    .then((res: any) => res.results || [])
    .then((res: any) => res.map(pickSchema));

  if (filter) {
    schema = schema.filter((s) => filter(s.className));
  }

  schema.sort((a, b) => {
    if (a.className < b.className) {
      return -1;
    }
    if (a.className > b.className) {
      return 1;
    }
    return 0;
  });

  for (const s of schema) {
    const keys = Object.keys(s.fields);

    keys.sort((a, b) => a.localeCompare(b));

    s.fields = Object.fromEntries(
      keys.map((key) => [key, s.fields[key]]).filter(Boolean)
    );
  }

  return schema;
}

export async function createSchema<T>(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  schema: SchemaInterface
) {
  return await fetchHandler<T>({
    url: publicServerURL + "/schemas",
    options: {
      method: "POST",
      headers: {
        "X-Parse-Application-Id": appId,
        "X-Parse-Master-Key": masterKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(schema),
    },
  });
}

export async function updateSchema<T>(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  schema: SchemaInterface
) {
  return await fetchHandler<T>({
    url: publicServerURL + "/schemas/" + schema.className,
    options: {
      method: "PUT",
      headers: {
        "X-Parse-Application-Id": appId,
        "X-Parse-Master-Key": masterKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(schema),
    },
  });
}

export async function deleteSchema<T>(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  { className }: { className: string },
  { options }: { options: { deleteNonEmptyClass: boolean | undefined } }
) {
  if (options.deleteNonEmptyClass) {
    await deleteNonEmptySchemaObjects(
      { publicServerURL, appId, masterKey },
      { className }
    );
  }

  return await fetchHandler<T>({
    url: publicServerURL + "/schemas/" + className,
    options: {
      method: "DELETE",
      headers: {
        "X-Parse-Application-Id": appId,
        "X-Parse-Master-Key": masterKey,
      },
    },
  });
}

async function deleteNonEmptySchemaObjects(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  { className }: { className: string }
) {
  //Purge all objects in the class
  const objects: { results: any[] } = await fetchHandler<{ results: any[] }>({
    url: publicServerURL + "/classes/" + className,
    options: {
      method: "GET",
      headers: {
        "X-Parse-Application-Id": appId,
        "X-Parse-Master-Key": masterKey,
      },
    },
  });

  for await (const entry of objects.results) {
    await fetchHandler({
      url: publicServerURL + "/classes/" + className + "/" + entry.objectId,
      options: {
        method: "DELETE",
        headers: {
          "X-Parse-Application-Id": appId,
          "X-Parse-Master-Key": masterKey,
        },
      },
    });
  }
}
