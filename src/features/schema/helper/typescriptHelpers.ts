import type { CustomClassFieldType } from "../../schema/index.js";
import type { SchemaInterface } from "../index.js";

/**
 * Returns custom type and importfrom if defined in config for a class/field.
 */
export function getCustomFieldType(
  config: { customClassFieldTypes?: CustomClassFieldType[] },
  className: string,
  fieldName: string
): { type: string; importfrom?: string } | undefined {
  if (!config.customClassFieldTypes) return undefined;

  for (const entry of config.customClassFieldTypes) {
    if (entry.classname === className) {
      for (const field of entry.fields) {
        // Only consider keys that are not 'importfrom'
        for (const key of Object.keys(field)) {
          if (
            key !== "importfrom" &&
            key === fieldName &&
            typeof field[key] === "string"
          ) {
            return { type: field[key] as string, importfrom: field.importfrom };
          }
        }
      }
    }
  }
  return undefined;
}

export function getTypescriptFieldNullable(
  fieldAttributes: SchemaInterface["fields"][0]
) {
  return fieldAttributes.required || "defaultValue" in fieldAttributes;
}

export function getTypescriptFieldType(
  fieldName: string,
  fieldAttributes: SchemaInterface["fields"][0],
  sdk: boolean,
  p: (className: string) => string,
  className: string,
  config?: { customClassFieldTypes?: CustomClassFieldType[] }
): { type: string; importfrom?: string } {
  if (config && fieldName && className) {
    const custom = getCustomFieldType(config, className, fieldName);
    if (custom) return custom;
  }

  switch (fieldAttributes.type) {
    case "String":
      return { type: "string" };

    case "Number":
      return { type: "number" };

    case "Boolean":
      return { type: "boolean" };

    case "Object":
      return { type: `any` };

    case "Array":
      return { type: `any[]` };

    case "Date":
      if (sdk) {
        return { type: `Date` };
      } else {
        return { type: `{ __type: "Date"; iso: string }` };
      }

    case "GeoPoint":
      if (sdk) {
        return { type: `Parse.GeoPoint` };
      } else {
        return {
          type: `{ __type: "GeoPoint"; latitude: number; longitude: number };`,
        };
      }

    case "Polygon":
      if (sdk) {
        return { type: `Parse.Polygon` };
      } else {
        return {
          type: `{ __type: "Polygon"; coordinates: [number, number][] };`,
        };
      }

    case "File":
      if (sdk) {
        return { type: `Parse.File` };
      } else {
        return { type: `{ __type: "File"; name: string; url: string };` };
      }

    case "Pointer": {
      const pointerTarget = p(fieldAttributes.targetClass);

      if (sdk) {
        return { type: `${pointerTarget}` };
      } else {
        return {
          type: `{ __type: "Pointer", className: "${pointerTarget}", objectId: string };`,
        };
      }
    }

    case "Relation": {
      const relationTarget = p(fieldAttributes.targetClass);

      if (sdk) {
        return { type: `Parse.Relation<${p(className)}, ${relationTarget}>` };
      } else {
        return { type: `{ __type: "Pointer", className: "${relationTarget}";` };
      }
    }

    default:
      throw new Error(
        `Parse type '${JSON.stringify(
          fieldAttributes
        )}' not implemented for typescript conversation.`
      );
  }
}
