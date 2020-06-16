const fs = require("fs");
const path = require("path");

const { fetch, copy } = require("./helper");

module.exports = {
  pickSchema,
  getLocalSchema,
  getRemoteSchema,
  createSchema,
  updateSchema,
  deleteSchema,
};

const cwd = process.cwd();

function pickSchema(schema) {
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

async function getLocalSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No local schema at '${schemaPath}'`);
  }

  if (schemaPath.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(schemaPath)).map(pickSchema);
  } else {
    return fs
      .readdirSync(schemaPath)
      .filter((p) => p.endsWith(".json"))
      .map((p) => ({
        className: p.replace(".json", ""),
        ...JSON.parse(fs.readFileSync(path.resolve(schemaPath, p))),
      }))
      .map(pickSchema);
  }
}

async function getRemoteSchema({ publicServerURL, appId, masterKey }) {
  return await fetch({
    url: publicServerURL + "/schemas",
    headers: {
      "X-Parse-Application-Id": appId,
      "X-Parse-Master-Key": masterKey,
    },
  })
    .then((res) => res.results || [])
    .then((res) => res.map(pickSchema));
}

async function createSchema({ publicServerURL, appId, masterKey }, schema) {
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

async function updateSchema({ publicServerURL, appId, masterKey }, schema) {
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

async function deleteSchema(
  { publicServerURL, appId, masterKey },
  { className }
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
