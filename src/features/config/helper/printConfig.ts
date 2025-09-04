import type { ConfigInterface } from "../index.js";

/**
 * Prints the current configuration.
 * @param cfg - Configuration object
 */
export function printConfig(cfg: ConfigInterface) {
  console.log("Current configuration:");
  console.log(
    "Location: " +
      (process.env.PARSE_SERVER_SCHEMA_CONFIG_PATH ||
        "./config/parse-server.config.json (default)")
  );
  console.log("  Server URL: " + cfg.publicServerURL);
  console.log("  App ID: " + cfg.appId);
  console.log("  Master Key: " + (cfg.masterKey ? "********" : "(not set)"));
  console.log("  Custom Class Field Types: ");
}
