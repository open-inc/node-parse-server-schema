# @openinc/parse-server-schema

A schema manager for Parse Server

## CLI Usage

Repository on npm:| `--include <include...>` | string[] | `[]` | Additional class name(s) to add to the schema (beyond prefix filter). Supports wildcards with `*`. Can be specified multiple times |https://www.npmjs.com/package/@openinc/parse-server-schema

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

### CLI options for typescript conversion

The `typescript` command supports the following options:

| Option                                     | Type     | Default | Description                                                                                                                                      |
| ------------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--prefix <prefix>`                        | string   | `""`    | Prefix will be stripped from class names in generated TypeScript files                                                                           |
| `--ignore <ignore...>`                     | string[] | `[]`    | Class name(s) to ignore during generation. Supports wildcards: `Prefix*` (starts with) or `*Suffix` (ends with). Can be specified multiple times |
| `--include <include...>`                   | string[] | `[]`    | Class name(s) to include (overrides --ignore). Supports wildcards with `*`. Can be specified multiple times                                      |
| `--no-class`                               | boolean  | `false` | Don't create and register custom Parse.Object classes (generates type definitions only)                                                          |
| `--no-sdk`                                 | boolean  | `false` | Don't use Parse JS SDK dependencies, generates plain TypeScript types only                                                                       |
| `--global-sdk`                             | boolean  | `false` | Assume Parse JS SDK is globally available (doesn't import Parse)                                                                                 |
| `--is-esm`                                 | boolean  | `false` | Use ES module imports/exports with `.js` extensions in generated files                                                                           |
| `--resolve-referenced-classes`             | boolean  | `false` | Generate TypeScript files for all referenced classes, even if they're not in the initial schema (enables recursive dependency resolution)        |
| `--custom-class-field-types-config <path>` | string   | -       | Path to JSON config file for custom class field type mappings                                                                                    |
| `--verbose`                                | boolean  | `false` | Enable verbose logging including dependency validation and dependency graph visualization                                                        |

**Examples:**

```bash
# Basic usage with prefix stripping
parse-server-schema typescript ./types --prefix "MyApp_"

# Generate with ES modules and recursive dependencies
parse-server-schema typescript ./types --is-esm --resolve-referenced-classes

# Generate type definitions only (no Parse.Object classes)
parse-server-schema typescript ./types --no-class --no-sdk

# Ignore specific classes and use custom field types
parse-server-schema typescript ./types --ignore "_Session" "TempClass*" --custom-class-field-types-config ./custom-types.json

# Enable verbose logging for debugging dependency issues
parse-server-schema typescript ./types --verbose --resolve-referenced-classes

# Generate MyApp_ prefixed classes plus additional Asset classes
parse-server-schema typescript ./types --prefix "MyApp_" --include "Asset*"

# Generate Documentation classes plus specific additional classes
parse-server-schema typescript ./types --prefix "OD3_Documentation_" --include "OD3_Asset" "User"
```

## Version update and deployment to npm

The next version number is calculated by semantic release.

When commiting keep the structure in mind: https://docs.openinc.dev/docs/general/semanticrelease

A GitHub workflow publishes the package automatically to npm.

## Programmatic Usage

```ts
import { loadConfig, up, down, typescript } from "@openinc/parse-server-schema";

// load JSON file with config
await loadConfig("./parse-server-config.json");
// or load config from process.env
await loadConfig();

await up(schemaPath);

await down(schemaPath);

await typescript(typescriptPath);
```
