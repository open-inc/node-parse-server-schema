import type { CustomClassFieldType } from "../../schema/index.js";

/**
 * Configuration interface for Parse Server Schema tool.
 */
export interface ConfigInterface {
  publicServerURL: string;
  appId: string;
  masterKey: string;
  customClassFieldTypes?: CustomClassFieldType[];
}
