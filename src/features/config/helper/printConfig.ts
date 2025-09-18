import { Config } from "../index.js";

/**
 * Prints the current configuration.
 * @param cfg - Configuration object
 */
export function printConfig() {
  const config = Config.getInstance();
  console.log("Current configuration:");
  console.log(
    "Location: " +
      (process.env.PARSE_SERVER_SCHEMA_CONFIG_PATH ||
        "./config/parse-server.config.json (default)")
  );
  console.log("  Server URL: " + config.publicServerURL);
  console.log("  App ID: " + config.appId);
  console.log("  Master Key: " + (config.masterKey ? "********" : "(not set)"));
}
