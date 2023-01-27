import fs from "fs";
import path from "path";

import { fetch, copy } from "./helper";
import { ConfigInterface, SchemaInterface } from "./types";

const cwd = process.cwd();

export function pickSchema(schema: SchemaInterface): SchemaInterface {
  if (!schema) {
    throw new Error("Schema not found.");
  }

  if (!schema.className) {
    throw new Error("Schema is missing 'className' key.");
  }

  schema = copy(schema);

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
  schemaPath: string
): Promise<SchemaInterface[]> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No local schema at '${schemaPath}'`);
  }

  if (schemaPath.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(schemaPath, "utf-8")).map(pickSchema);
  } else {
    return fs
      .readdirSync(schemaPath)
      .filter((p) => p.endsWith(".json"))
      .map((p) => ({
        className: p.replace(".json", ""),
        ...JSON.parse(fs.readFileSync(path.resolve(schemaPath, p), "utf-8")),
      }))
      .map(pickSchema);
  }
}

export async function getRemoteSchema({
  publicServerURL,
  appId,
  masterKey,
}: ConfigInterface): Promise<SchemaInterface[]> {
  const schema: SchemaInterface[] = await fetch({
    url: publicServerURL + "/schemas",
    headers: {
      "X-Parse-Application-Id": appId,
      "X-Parse-Master-Key": masterKey,
    },
  })
    .then((res) => res.results || [])
    .then((res) => res.map(pickSchema));

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

    s.fields = Object.fromEntries(keys.map((key) => [key, s.fields[key]]));
  }

  return schema;
}

export async function createSchema(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  schema: SchemaInterface
) {
  return await fetch({
    url: publicServerURL + "/schemas",
    method: "POST",
    headers: {
      "X-Parse-Application-Id": appId,
      "X-Parse-Master-Key": masterKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(schema),
  });
}

export async function updateSchema(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  schema: SchemaInterface
) {
  return await fetch({
    url: publicServerURL + "/schemas/" + schema.className,
    method: "PUT",
    headers: {
      "X-Parse-Application-Id": appId,
      "X-Parse-Master-Key": masterKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(schema),
  });
}

export async function deleteSchema(
  { publicServerURL, appId, masterKey }: ConfigInterface,
  { className }: { className: string }
) {
  return await fetch({
    url: publicServerURL + "/schemas/" + className,
    method: "DELETE",
    headers: {
      "X-Parse-Application-Id": appId,
      "X-Parse-Master-Key": masterKey,
    },
  });
}
