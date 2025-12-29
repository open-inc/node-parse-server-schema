import "dotenv/config";
import fs from "fs";
import path from "path";
import { Config } from "../classes/Config.js";
import type { ConfigInterface } from "../index.js";

/**
 * Load the Parse Server configuration.
 * @param configPath The path to the config file.
 * @param options Options for loading the config.
 * @returns The loaded config.
 */
export function loadConfig(
  configPath?: string,
  options?: { operation: "down" | "up" }
): ConfigInterface {
  const {
    PARSE_SERVER_APPLICATION_ID,
    PARSE_SERVER_MASTER_KEY,
    PARSE_PUBLIC_SERVER_URL,
    PARSE_SERVER_URL,
    PARSE_SERVER_DOWN_SCHEMA_SERVER_URL,
    PARSE_SERVER_DOWN_SCHEMA_APPID,
    PARSE_SERVER_DOWN_SCHEMA_MASTERKEY,
    PARSE_SERVER_UP_SCHEMA_SERVER_URL,
    PARSE_SERVER_UP_SCHEMA_APPID,
    PARSE_SERVER_UP_SCHEMA_MASTERKEY,
  } = process.env;

  //Set url to the fetch schema server url if it is set and options.operation is "down"
  if (
    options?.operation === "down" &&
    PARSE_SERVER_DOWN_SCHEMA_SERVER_URL &&
    PARSE_SERVER_DOWN_SCHEMA_APPID &&
    PARSE_SERVER_DOWN_SCHEMA_MASTERKEY
  ) {
    console.log(
      "[@openinc/parse-server-schema] Using config from process.env with PARSE_SERVER_DOWN_SCHEMA_SERVER_URL: " +
        PARSE_SERVER_DOWN_SCHEMA_SERVER_URL +
        " with APPID: " +
        PARSE_SERVER_DOWN_SCHEMA_APPID +
        " and MASTERKEY: " +
        PARSE_SERVER_DOWN_SCHEMA_MASTERKEY.slice(0, 1) +
        "****" +
        PARSE_SERVER_DOWN_SCHEMA_MASTERKEY.slice(
          PARSE_SERVER_DOWN_SCHEMA_MASTERKEY.length - 1,
          PARSE_SERVER_DOWN_SCHEMA_MASTERKEY.length
        )
    );

    const configData = {
      publicServerURL: PARSE_SERVER_DOWN_SCHEMA_SERVER_URL,
      appId: PARSE_SERVER_DOWN_SCHEMA_APPID,
      masterKey: PARSE_SERVER_DOWN_SCHEMA_MASTERKEY,
    };

    Config.initialize(configData);
    return configData;
  }

  //Set url to the push schema server url if it is set and options.operation is "up"
  if (
    options?.operation === "up" &&
    PARSE_SERVER_UP_SCHEMA_SERVER_URL &&
    PARSE_SERVER_UP_SCHEMA_APPID &&
    PARSE_SERVER_UP_SCHEMA_MASTERKEY
  ) {
    console.log(
      "[@openinc/parse-server-schema] Using config from process.env with PARSE_SERVER_UP_SCHEMA_SERVER_URL: " +
        PARSE_SERVER_UP_SCHEMA_SERVER_URL +
        " with APPID: " +
        PARSE_SERVER_UP_SCHEMA_APPID +
        " and MASTERKEY: " +
        PARSE_SERVER_UP_SCHEMA_MASTERKEY.slice(0, 1) +
        "****" +
        PARSE_SERVER_UP_SCHEMA_MASTERKEY.slice(
          PARSE_SERVER_UP_SCHEMA_MASTERKEY.length - 1,
          PARSE_SERVER_UP_SCHEMA_MASTERKEY.length
        )
    );

    const configData = {
      publicServerURL: PARSE_SERVER_UP_SCHEMA_SERVER_URL,
      appId: PARSE_SERVER_UP_SCHEMA_APPID,
      masterKey: PARSE_SERVER_UP_SCHEMA_MASTERKEY,
    };

    Config.initialize(configData);
    return configData;
  }

  //Use default env variables
  const url = PARSE_SERVER_URL || PARSE_PUBLIC_SERVER_URL;
  if (PARSE_SERVER_APPLICATION_ID && PARSE_SERVER_MASTER_KEY && url) {
    console.log(
      "[@openinc/parse-server-schema] Using config from process.env with PARSE_SERVER_URL: " +
        url +
        " with APPID: " +
        PARSE_SERVER_APPLICATION_ID +
        " and MASTERKEY: " +
        PARSE_SERVER_MASTER_KEY.slice(0, 1) +
        "****" +
        PARSE_SERVER_MASTER_KEY.slice(
          PARSE_SERVER_MASTER_KEY.length - 1,
          PARSE_SERVER_MASTER_KEY.length
        )
    );

    const configData = {
      publicServerURL: url,
      appId: PARSE_SERVER_APPLICATION_ID,
      masterKey: PARSE_SERVER_MASTER_KEY,
    };

    Config.initialize(configData);
    return configData;
  }

  configPath = path.resolve(configPath || "config/parse-server.config.json");

  if (!fs.existsSync(configPath)) {
    console.error(
      `[@openinc/parse-server-schema] No config at '${configPath}'`
    );
    process.exit(1);
  }

  let config;

  if (configPath.endsWith(".js")) {
    config = require(configPath);
  }

  if (configPath.endsWith(".json")) {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  if (!config) {
    console.error(`[@openinc/parse-server-schema] Invalid config file type`);
    process.exit(1);
  }

  if (!config.publicServerURL) {
    console.error(
      `[@openinc/parse-server-schema] Invalid config: Missing key 'publicServerURL'.`
    );
    process.exit(1);
  }

  if (!config.appId) {
    console.error(
      `[@openinc/parse-server-schema] Invalid config: Missing key 'appId'.`
    );
    process.exit(1);
  }

  if (!config.masterKey) {
    console.error(
      `[@openinc/parse-server-schema] Invalid config: Missing key 'masterKey'.`
    );
    process.exit(1);
  }

  Config.initialize(config);
  return config;
}
