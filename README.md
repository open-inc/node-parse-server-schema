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
