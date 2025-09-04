export interface SchemaInterface {
  className: string;
  fields: {
    [key: string]: (
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
          type: "Pointer" | "Relation";
          targetClass: string;
        }
    ) & {
      required?: boolean;
      defaultValue?: any;
    };
  };
  classLevelPermissions: {
    find: {
      [key: string]: boolean;
    };
    count: {
      [key: string]: boolean;
    };
    get: {
      [key: string]: boolean;
    };
    create: {
      [key: string]: boolean;
    };
    update: {
      [key: string]: boolean;
    };
    delete: {
      [key: string]: boolean;
    };
    addField: {
      [key: string]: boolean;
    };
    protectedFields: {
      [key: string]: boolean;
    };
  };
}
