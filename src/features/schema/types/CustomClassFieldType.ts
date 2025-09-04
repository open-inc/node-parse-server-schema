export type CustomClassFieldType = {
  classname: string;
  fields: Array<{
    importfrom?: string;
    [fieldName: string]: string | undefined;
  }>;
};
