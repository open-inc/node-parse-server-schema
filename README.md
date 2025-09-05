# @openinc/parse-server-schema

A schema manager for Parse Server

## CLI Usage

```
npm i -g @openinc/parse-server-schema

parse-server-schema --help

# or

npm i -D @openinc/parse-server-schema

npx parse-server-schema --help
```

### Generate local schemas from distant Parse server

```
parse-server-schema down ./path/to/local/schemas --configPath ./path/to/my-parse-conf.json
```

### Generate TS types from distant Parse server

```
parse-server-schema typescript ./path/to/my/local/types --configPath ./path/to/my-parse-conf.json
```

## Configuration

You have two options to connect to parse server.

1. By providing a json config file
2. By providing an env with the necessary values set.

### 1. Config files

By default the config file is expected to be in _./config/parse-server.config.json_

You can specify the path providing the option `--configPath`.

Here's what a valid JSON file looks like:

```JSON
{
  "masterKey": "my-parse-master-key",
  "publicServerURL": "https://my-parse-server.com",
  "appId": "my-parse-app-id"
}
```

### 2. Environment variables

The following variables can be set. By default the package looks for process.env, so takes every .env in cwd into account and uses these information to connect to parse server. The json file is ignored in this scenarion.

- PARSE_SERVER_APPLICATION_ID
- PARSE_SERVER_MASTER_KEY
- PARSE_PUBLIC_SERVER_URL
- PARSE_SERVER_URL

**Distinct values for "down" script (optional)**

- PARSE_SERVER_DOWN_SCHEMA_SERVER_URL
- PARSE_SERVER_DOWN_SCHEMA_APPID
- PARSE_SERVER_DOWN_SCHEMA_MASTERKEY

**Distinct values for "up" script (optional)**

- PARSE_SERVER_UP_SCHEMA_SERVER_URL
- PARSE_SERVER_UP_SCHEMA_APPID
- PARSE_SERVER_UP_SCHEMA_MASTERKEY

### Providing custom types for class fields

By default array and object typed class fields are set to any[]/any. By specifing `--custom-class-field-types-config <path>` in the cli command you can set these to custom types.
The file has to be an array of form `classname` --> `fields` --> `[key: fieldname]: type`. Specify the **importfrom** option to import the type correctly!

**Example:**

```json
[
  {
    "classname": "YourClassName",
    "fields": [
      {
        "fieldname": "fieldtype",
        "importfrom": "import { fieldtype } from \"../path/to/type\""
      }
    ]
  }
]
```

## Version update and deployment to npm

The next version number is calculated by semantic release.

When commiting keep the structure in mind: https://docs.openinc.dev/docs/general/semanticrelease

A GitHub workflow publishes the package automatically to npm.

## Programmatic Usage

```ts
import { loadConfig, up, down, typescript } from "@openinc/parse-server-schema";

// load JSON file with config
const cfg = await loadConfig("./parse-server-config.json");
// or load config from process.env
const cfg = await loadConfig();

await up(cfg, schemaPath);

await down(cfg, schemaPath);

await typescript(cfg, typescriptPath);
```
