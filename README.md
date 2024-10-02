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

### Config file (JSON)

Here's what a valid JSON file looks like:

```JSON
{
  "masterKey": "my-parse-master-key",
  "publicServerURL": "https://my-parse-server.com",
  "appId": "my-parse-app-id"
}
```

### Generate local schemas from distant Parse server

```
parse-server-schema down ./path/to/local/schemas --configPath ./path/to/my-parse-conf.json
```

### Generate TS types from distant Parse server

```
parse-server-schema typescript ./path/to/my/local/types --configPath ./path/to/my-parse-conf.json
```

## Version update and deployment to npm

A GitHub workflow publishes the script automatically to npm when a new version is released. You can trigger this with the following commands:

`npm version patch`

`git push --follow-tags`

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
