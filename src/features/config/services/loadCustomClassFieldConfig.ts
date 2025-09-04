import fs from "fs";
import path from "path";
import type { CustomClassFieldType } from "../../schema/index.js";

/**
 * Loads the custom class field configuration from a .json file.
 * @param configPath Path to .json config file
 * @returns An array of custom class field types or undefined if not found.
 */
export function loadCustomClassFieldConfig(
  configPath: string
): CustomClassFieldType[] {
  const resolvedPath = path.resolve(configPath);
  if (fs.existsSync(resolvedPath)) {
    const rawData = fs.readFileSync(resolvedPath, "utf-8");
    return JSON.parse(rawData);
  }
  return [];
}
