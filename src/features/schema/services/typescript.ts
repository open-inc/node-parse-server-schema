import fs from "fs";
import { mkdirp } from "mkdirp";
import path from "path";
import {
  loadCustomClassFieldConfig,
  type ConfigInterface,
} from "../../config/index.js";
import {
  getTypescriptFieldNullable,
  getTypescriptFieldType,
} from "../helper/typescriptHelpers.js";
import { getRemoteSchema, type CustomClassFieldType } from "../index.js";

/**
 * Generates TypeScript definitions for the Parse Server schema.
 * @param cfg ConfigInterface with publicServerURL, appId and masterKey
 * @param typescriptPath The path to the output TypeScript folder.
 * @param options Options for the generation of the TypeScript definitions
 * @param options.prefix Only classes with the given prefix will be generated. The prefix will be removed from the class names in the local schema.
 * @param options.ignore Class(es) to ignore. You can use * at the end to ignore all classes that start with the given string.
 * @param options.sdk Whether to generate classes that extend Parse.Object. Default is true.
 * @param options.globalSdk Whether to import Parse from "parse" or assume it's globally available. Default is false.
 * @param options.class Whether to create and register custom Parse.Object classes. Default is false.
 * @param options.isEsm Whether to generate ESM imports/exports. Default is false (CommonJS).
 */
export async function typescript(
  cfg: ConfigInterface,
  typescriptPath: string,
  options: {
    prefix?: string;
    ignore?: string[];
    sdk?: boolean; // "default" | "node" | "global" | "none";
    globalSdk?: boolean;
    class?: boolean;
    isEsm?: boolean;
    customClassFieldTypesConfig?: string;
  }
) {
  let schema = await getRemoteSchema(cfg);

  const prefix = (options.prefix ||= "");

  let customClassFieldTypesConfigPath: CustomClassFieldType[] = [];
  if (options.customClassFieldTypesConfig) {
    customClassFieldTypesConfigPath = loadCustomClassFieldConfig(
      options.customClassFieldTypesConfig
    );
  }

  options.sdk ??= true;
  options.globalSdk ??= false;
  options.class ??= false;

  if (prefix) {
    schema = schema.filter(
      (s) => s.className.startsWith(prefix) || s.className.startsWith("_")
    );
  }

  if (Array.isArray(options.ignore)) {
    for (let ignore of options.ignore) {
      if (ignore.endsWith("*")) {
        ignore = ignore.slice(0, -1);

        schema = schema.filter((s) => !s.className.startsWith(ignore));
      } else {
        schema = schema.filter((s) => s.className !== ignore);
      }
    }
  }

  const p = (className: string) => {
    if (prefix && className.startsWith(prefix)) {
      return className.replace(prefix, "");
    }

    return className;
  };

  const tsPath = typescriptPath
    ? path.resolve(typescriptPath)
    : path.resolve(".", "schema", "typescript");

  await mkdirp(tsPath);

  for (const { className, fields } of schema) {
    const dependencies = [];
    const attributes = [];
    const getter = [];

    if (options.sdk) {
      attributes.push("id: string;");
      attributes.push("objectId: string;");
      attributes.push("createdAt: Date;");
      attributes.push("updatedAt: Date;");
    } else {
      attributes.push("objectId: string;");
      attributes.push("createdAt: string;");
      attributes.push("updatedAt: string;");
    }

    attributes.push("");

    const ignoreFields = ["id", "objectId", "createdAt", "updatedAt"];

    const fieldEntries = Object.entries(fields).filter(
      ([name]) => !ignoreFields.includes(name)
    );

    fieldEntries.sort(([a], [b]) => a.localeCompare(b));

    for (const [field, fieldAttributes] of fieldEntries) {
      if (
        "targetClass" in fieldAttributes &&
        fieldAttributes.targetClass !== className
      ) {
        dependencies.push(fieldAttributes.targetClass);
      }

      const type = getTypescriptFieldType(
        field,
        fieldAttributes,
        options.sdk,
        p,
        className,
        {
          customClassFieldTypes: customClassFieldTypesConfigPath,
        }
      );

      console.log("Class", className, "field", field, "Type", type);

      const nullable = getTypescriptFieldNullable(fieldAttributes);

      const r = nullable ? "" : "?";
      const u = nullable ? "" : " | undefined";

      //Check if type.importfrom is set and if so, add it to the dependencies
      if (type.importfrom) {
        dependencies.push(type.importfrom);
      }

      if (fieldAttributes.type === "Relation") {
        attributes.push(`${field}: ${type.type};`);

        getter.push(`get ${field}(): ${type.type} {`);
        getter.push(`  return super.relation("${field}");`);
        getter.push(`}`);
      } else {
        attributes.push(`${field}${r}: ${type.type};`);

        getter.push(`get ${field}(): ${type.type}${u} {`);
        getter.push(`  return super.get("${field}");`);
        getter.push(`}`);

        getter.push(`set ${field}(value: ${type.type}${u}) {`);
        getter.push(`  super.set("${field}", value);`);
        getter.push(`}`);
      }
    }

    let file = "";

    if (options.sdk && !options.globalSdk) {
      file += `import Parse from "parse";\n\n`;
    }

    if (options.sdk) {
      const uniqueDependencies = dependencies
        .filter((v) => v !== p(className))
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

      const externalDependencies = uniqueDependencies.filter((v) => {
        if (v.startsWith("import")) {
          return false;
        }

        if (v.startsWith("_")) {
          return false;
        }

        if (prefix && v.startsWith(prefix)) {
          return false;
        }

        if (Array.isArray(options.ignore)) {
          for (let ignore of options.ignore) {
            if (ignore.endsWith("*")) {
              ignore = ignore.slice(0, -1);

              if (v.startsWith(ignore)) {
                return true;
              }
            } else {
              if (v === ignore) {
                return true;
              }
            }
          }
        }

        if (!prefix) {
          return false;
        }

        return true;
      });

      const importDependencies = uniqueDependencies.filter((v) => {
        if (v.startsWith("import")) {
          return true;
        }
      });

      const internalDependencies = uniqueDependencies.filter(
        (v) =>
          !externalDependencies.includes(v) && !importDependencies.includes(v)
      );

      importDependencies.forEach((dep) => {
        file += `${dep}\n`;
      });

      internalDependencies.forEach((dep) => {
        if (options.isEsm) {
          file += `import type { ${p(dep)}${
            options.sdk ? "" : "Attributes"
          } } from "./${p(dep)}.js";\n`;
        } else {
          file += `import type { ${p(dep)}${
            options.sdk ? "" : "Attributes"
          } } from "./${p(dep)}";\n`;
        }
      });

      if (internalDependencies.length > 0) {
        file += "\n";
      }

      externalDependencies.forEach((dep) => {
        file += `type ${p(dep)} = Parse.Object;\n`;
      });

      if (externalDependencies.length > 0) {
        file += "\n";
      }
    }
    file += `export interface ${p(className)}Attributes {\n`;

    attributes.forEach((attr) => {
      if (attr) {
        file += `  ${attr}\n`;
      } else {
        file += "\n";
      }
    });

    file += "}\n";

    if (options.sdk && options.class) {
      file += "\n";

      if (className === "_Session") {
        file += `export type ${className} = Parse.Session<${className}Attributes>;\n`;
      } else if (className === "_User") {
        file += `export type ${className} = Parse.User<${className}Attributes>;\n`;
      } else if (className === "_Role") {
        file += `export type ${className} = Parse.Role<${className}Attributes>;\n`;
      } else {
        file += `export class ${p(className)} extends Parse.Object<${p(
          className
        )}Attributes> {\n`;
        file += `  static className: string = "${className}";\n\n`;
        file += `  constructor(data?: Partial<${p(className)}Attributes>) {\n`;
        file += `    super("${className}", data as ${p(
          className
        )}Attributes);\n`;
        file += `  }\n`;

        file += "\n";

        getter.forEach((attr) => {
          if (attr) {
            file += `  ${attr}\n`;
          } else {
            file += "\n";
          }
        });

        file += `}\n`;
        file += "\n";
        file += `Parse.Object.registerSubclass("${className}", ${p(
          className
        )});\n`;
      }
    }

    if (options.sdk && !options.class) {
      file += "\n";

      if (className === "_Session") {
        file += `export type ${className} = Parse.Session<${className}Attributes>;\n`;
      } else if (className === "_User") {
        file += `export type ${className} = Parse.User<${className}Attributes>;\n`;
      } else if (className === "_Role") {
        file += `export type ${className} = Parse.Role<${className}Attributes>;\n`;
      } else {
        file += `export type ${p(className)} = Parse.Object<${p(
          className
        )}Attributes>;\n`;
      }
    }

    fs.writeFileSync(path.resolve(tsPath, p(className) + ".ts"), file);
  }

  if (options.sdk) {
    fs.writeFileSync(
      path.resolve(tsPath, "index.ts"),
      schema
        .map((field) => field.className)
        .map((className) => {
          if (options.isEsm) {
            //Check if className starts with "_" and if so, return export type
            //This is for parse default classes _User, _Role, _Session
            if (className.startsWith("_")) {
              return `export type { ${p(className)} } from "./${p(
                className
              )}.js";\nexport type { ${p(className)}Attributes } from "./${p(
                className
              )}.js";\n`;
            }

            return `export { ${p(className)} } from "./${p(
              className
            )}.js";\nexport type { ${p(className)}Attributes } from "./${p(
              className
            )}.js";\n`;
          }
          return `export { ${p(className)} } from "./${p(
            className
          )}";\nexport type { ${p(className)}Attributes } from "./${p(
            className
          )}";\n`;
        })
        .join("\n") + "\n"
    );
  } else {
    fs.writeFileSync(
      path.resolve(tsPath, "index.ts"),
      schema
        .map((field) => field.className)
        .map((className) => {
          if (options.isEsm) {
            return `export { ${p(className)}Attributes } from "./${p(
              className
            )}.js";`;
          }

          return `export { ${p(className)}Attributes } from "./${p(
            className
          )}";`;
        })
        .join("\n") + "\n"
    );
  }
}
