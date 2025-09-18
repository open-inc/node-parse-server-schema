import fs from "fs";
import Handlebars from "handlebars";
import path from "path";
import { fileURLToPath } from "url";
import { loadCustomClassFieldConfig } from "../../config/index.js";
import {
  getClassnameWithoutPrefix,
  type AttributesType,
  type CustomClassFieldReturnType,
  type CustomClassFieldType,
  type DependenciesType,
  type FieldEntryType,
  type GetterType,
  type SchemaInterface,
  type SetterType,
  type TypescriptConversionOptions,
} from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TypescriptConversion {
  public prefix = "";
  public ignoreFields = ["id", "objectId", "createdAt", "updatedAt"];
  public sdk = true;
  public globalSdk = false;
  public isEsm = false;
  public isClass = false;
  public resolveReferencedClasses = false;
  public customClassFieldTypes: CustomClassFieldType[] = [];

  private static templateInitialized = false;
  private static template: HandlebarsTemplateDelegate;
  private static indexTemplate: HandlebarsTemplateDelegate;

  /**
   * Holds dependencies found during conversion.
   * @type {DependenciesType}
   *
   * @example
   * {
   * externalDependencies: ["_User", "_Role"], <-- Everything that is not in the currently processed schema but might be needed (e.g. Parse default classes)
   * internalDependencies: ["MyClass", "AnotherClass"], <-- Everything that is in the currently processed schema
   * importDependencies: ['import { something } from "somewhere";'] <-- Custom imports from config mapping for custom types
   * }
   */
  public dependencies: DependenciesType = {
    externalDependencies: new Set<string>(),
    internalDependencies: new Set<string>(),
    importDependencies: new Set<string>(),
  };
  public attributes: AttributesType[] = [];
  public getter: GetterType[] = [];
  public setter: SetterType[] = [];

  private className = "";

  constructor(options: TypescriptConversionOptions, className: string) {
    console.log(
      `   ⚙️  Initializing TypeScript conversion with options: ${JSON.stringify(
        options
      )}`
    );
    this.prefix = options.prefix || "";
    this.ignoreFields = options.ignore || [
      "id",
      "objectId",
      "createdAt",
      "updatedAt",
    ];
    this.sdk = options.sdk ?? true;
    this.globalSdk = options.globalSdk ?? false;
    this.isEsm = options.isEsm ?? false;
    this.isClass = options.class ?? false;
    this.resolveReferencedClasses = options.resolveReferencedClasses ?? false;

    if (options.customClassFieldTypesConfig) {
      this.customClassFieldTypes = loadCustomClassFieldConfig(
        options.customClassFieldTypesConfig
      );
    }

    this.className = className;

    // Initialize template if not already done
    if (!TypescriptConversion.templateInitialized) {
      this.initializeTemplate();
    }

    if (options.sdk) {
      this.attributes.push({ fieldname: "id", type: "string" });
      this.attributes.push({ fieldname: "objectId", type: "string" });
      this.attributes.push({ fieldname: "createdAt", type: "Date" });
      this.attributes.push({ fieldname: "updatedAt", type: "Date" });
    } else {
      this.attributes.push({ fieldname: "objectId", type: "string" });
      this.attributes.push({ fieldname: "createdAt", type: "string" });
      this.attributes.push({ fieldname: "updatedAt", type: "string" });
    }
  }

  /**
   * Initialize Handlebars template and helpers
   */
  private initializeTemplate() {
    // Register helpers
    Handlebars.registerHelper(
      "getClassnameWithoutPrefix",
      (prefix: string, className: string) => {
        return getClassnameWithoutPrefix(prefix, className);
      }
    );

    Handlebars.registerHelper(
      "ifEquals",
      function (this: any, arg1: string, arg2: string, options: any) {
        return arg1 === arg2 ? options.fn(this) : options.inverse(this);
      }
    );

    Handlebars.registerHelper(
      "startsWith",
      function (str: string, prefix: string) {
        return str.startsWith(prefix);
      }
    );

    // Load templates from src directory (since .hbs files aren't copied to dist)
    const templatePath = path.resolve(
      __dirname,
      "../../../../src/features/schema/templates/typescript-class.hbs"
    );
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    TypescriptConversion.template = Handlebars.compile(templateSource);

    const indexTemplatePath = path.resolve(
      __dirname,
      "../../../../src/features/schema/templates/typescript-index.hbs"
    );
    const indexTemplateSource = fs.readFileSync(indexTemplatePath, "utf-8");
    TypescriptConversion.indexTemplate =
      Handlebars.compile(indexTemplateSource);

    TypescriptConversion.templateInitialized = true;
  }

  /**
   * Writes the contents of "file" to the file system.
   * @param tsPath The path where to write the file.
   */
  public writeFile(tsPath: string) {
    fs.writeFileSync(
      path.resolve(
        tsPath,
        getClassnameWithoutPrefix(this.prefix, this.className) + ".ts"
      ),
      this.generateFromTemplate()
    );
  }

  /**
   * Generate TypeScript file content using Handlebars template
   */
  public generateFromTemplate(): string {
    const templateData = {
      className: this.className,
      prefix: this.prefix,
      sdk: this.sdk,
      globalSdk: this.globalSdk,
      isEsm: this.isEsm,
      isClass: this.isClass,
      attributes: this.attributes,
      getters: this.getter,
      setters: this.setter,
      importDependencies: Array.from(this.dependencies.importDependencies),
      internalDependencies: Array.from(this.dependencies.internalDependencies),
      externalDependencies: Array.from(this.dependencies.externalDependencies),
    };

    return TypescriptConversion.template(templateData);
  }

  /**
   * Generate index.ts file content using Handlebars template
   */
  public static generateIndexFromTemplate(
    classNames: string[],
    options: TypescriptConversionOptions
  ): string {
    // Ensure template is initialized
    if (!TypescriptConversion.templateInitialized) {
      const tempInstance = new TypescriptConversion(options, "temp");
      // Template initialization happens in constructor
    }

    const templateData = {
      classes: classNames.map((className) => ({ className })),
      prefix: options.prefix || "",
      sdk: options.sdk ?? true,
      isEsm: options.isEsm ?? false,
    };

    return TypescriptConversion.indexTemplate(templateData);
  }

  /**
   * Returns whether the field is nullable.
   * @param fieldAttributes The attributes of the field
   * @returns Whether the field is nullable
   */
  private getTypescriptFieldNullable(
    fieldAttributes: SchemaInterface["fields"][0]
  ) {
    return fieldAttributes.required || "defaultValue" in fieldAttributes;
  }

  /**
   * Creates getter and setter methods for the fields and adds them to the attributes and getter arrays.
   * @param fieldEntries The entries of the fields
   */
  public createGetterAndSetter(
    fieldEntries: FieldEntryType[],
    schema: SchemaInterface[]
  ) {
    for (const [field, fieldAttributes] of fieldEntries) {
      // Check if targetClass is set and not equal to the current className
      // This might be if the targetClass is in the currently processed schema
      // Check if in current schema, if so, put in internal dependencies
      if (
        "targetClass" in fieldAttributes &&
        fieldAttributes.targetClass !== this.className &&
        schema.find((s) => s.className === fieldAttributes.targetClass)
      ) {
        this.dependencies.internalDependencies.add(fieldAttributes.targetClass);
      } else if (
        "targetClass" in fieldAttributes &&
        fieldAttributes.targetClass !== this.className &&
        !schema.find((s) => s.className === fieldAttributes.targetClass)
      ) {
        // If resolveReferencedClasses is enabled, we want to fetch and process this class
        // So we put it in external dependencies to trigger fetching
        this.dependencies.externalDependencies.add(fieldAttributes.targetClass);
      } else if (
        "targetClass" in fieldAttributes &&
        fieldAttributes.targetClass !== this.className
      ) {
        console.warn("Field '" + field + "' could not be found in schema.");
      }

      // Check if field is nullable
      const nullable = this.getTypescriptFieldNullable(fieldAttributes);
      // Get the TypeScript type for the field
      const type = this.getTypescriptFieldType(field, fieldAttributes);

      console.log(
        `     🔤 Field ${field}: ${type.type}${
          type.importfrom ? ` (imported from ${type.importfrom})` : ""
        }`
      );

      //Check if type.importfrom is set and if so, add it to the importDependencies
      if (type.importfrom) {
        this.dependencies.importDependencies.add(type.importfrom);
      }

      if (fieldAttributes.type === "Relation") {
        this.attributes.push({ fieldname: field, type: type.type });

        this.getter.push({
          fieldname: field,
          type: type.type,
          returnType: `super.relation("${field}");`,
        });
      } else {
        this.attributes.push({
          fieldname: `${field}${nullable ? "?" : ""}`,
          type: type.type + (nullable ? " | null" : ""),
        });

        this.getter.push({
          fieldname: field,
          type: `${type.type}${nullable ? " | undefined" : ""}`,
          returnType: `super.get("${field}");`,
        });

        this.setter.push({
          fieldname: field,
          type: `${type.type}${nullable ? " | undefined" : ""}`,
          action: `super.set("${field}", value);`,
        });
      }
    }
  }

  /**
   * Returns custom type and importfrom if defined in config for a class/field.
   */
  private getCustomFieldType(
    fieldName: string
  ): CustomClassFieldReturnType | undefined {
    if (!this.customClassFieldTypes) return undefined;

    for (const entry of this.customClassFieldTypes) {
      if (entry.classname === this.className) {
        for (const field of entry.fields) {
          // Only consider keys that are not 'importfrom'
          for (const key of Object.keys(field)) {
            if (
              key !== "importfrom" &&
              key === fieldName &&
              typeof field[key] === "string"
            ) {
              return {
                type: field[key] as string,
                importfrom: field.importfrom,
              };
            }
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Returns the TypeScript type for a field.
   * @param fieldName The name of the field
   * @param fieldAttributes The attributes of the field
   * @param sdk Whether the SDK is being used
   * @param p A function to get the class name
   * @param className The name of the class
   * @param config The configuration object
   * @returns The TypeScript type for the field
   */
  private getTypescriptFieldType(
    fieldName: string,
    fieldAttributes: SchemaInterface["fields"][0]
  ): { type: string; importfrom?: string } {
    if (this.customClassFieldTypes.length > 0 && fieldName && this.className) {
      // Check for custom field types
      const custom = this.getCustomFieldType(fieldName);
      if (custom) return custom;
    }

    // Check for default Parse types
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
        if (this.sdk) {
          return { type: `Date` };
        } else {
          return { type: `{ __type: "Date"; iso: string }` };
        }

      case "GeoPoint":
        if (this.sdk) {
          return { type: `Parse.GeoPoint` };
        } else {
          return {
            type: `{ __type: "GeoPoint"; latitude: number; longitude: number };`,
          };
        }

      case "Polygon":
        if (this.sdk) {
          return { type: `Parse.Polygon` };
        } else {
          return {
            type: `{ __type: "Polygon"; coordinates: [number, number][] };`,
          };
        }

      case "File":
        if (this.sdk) {
          return { type: `Parse.File` };
        } else {
          return { type: `{ __type: "File"; name: string; url: string };` };
        }

      case "Pointer": {
        const pointerTarget = getClassnameWithoutPrefix(
          this.prefix,
          fieldAttributes.targetClass
        );

        if (this.sdk) {
          return { type: `${pointerTarget}` };
        } else {
          return {
            type: `{ __type: "Pointer", className: "${pointerTarget}", objectId: string };`,
          };
        }
      }

      case "Relation": {
        const relationTarget = getClassnameWithoutPrefix(
          this.prefix,
          fieldAttributes.targetClass
        );

        if (this.sdk) {
          return {
            type: `Parse.Relation<${getClassnameWithoutPrefix(
              this.prefix,
              this.className
            )}, ${relationTarget}>`,
          };
        } else {
          return {
            type: `{ __type: "Pointer", className: "${relationTarget}";`,
          };
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
}
