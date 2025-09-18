export type DependenciesType = {
  externalDependencies: Set<string>;
  internalDependencies: Set<string>;
  importDependencies: Set<string>;
};

/**
 * Type for attribute definitions
 *
 * @example
 * { fieldname: "name", type: "string" }
 * Desired Output:
 * {
 * id: string;
 * createdAt: Date;
 * xxx: Parse.Relation<aaa, _Role>;
 * enabled: boolean;
 * bbb?: CCC;
 * }
 */
export type AttributesType = {
  fieldname: string;
  type: string;
};

/**
 * Type for getter definitions
 */
export type GetterType = {
  fieldname: string;
  type: string;
  returnType: string;
};

/**
 * Type for setter definitions
 */
export type SetterType = {
  fieldname: string;
  type: string;
  action: string;
};

export type FieldEntryType = [
  string,
  (
    | {
        type:
          | "String"
          | "Boolean"
          | "Number"
          | "Object"
          | "Date"
          | "GeoPoint"
          | "Polygon"
          | "File"
          | "Array";
      }
    | {
        type: "Relation" | "Pointer";
        targetClass: string;
      }
  ) & {
    required?: boolean | undefined;
    defaultValue?: any;
  }
];

export type TypescriptConversionOptions = {
  prefix?: string;
  ignore?: string[];
  include?: string[];
  sdk?: boolean; // "default" | "node" | "global" | "none";
  globalSdk?: boolean;
  class?: boolean;
  isEsm?: boolean;
  customClassFieldTypesConfig?: string;
  resolveReferencedClasses?: boolean;
  verbose?: boolean;
};

export type CustomClassFieldReturnType = { type: string; importfrom?: string };
