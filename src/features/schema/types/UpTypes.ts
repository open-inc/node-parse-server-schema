export type UpType = {
  ignore?: string[];
  prefix?: string;
  deleteClasses?: boolean;
  deleteFields?: boolean;
  deleteNonEmptyClass?: boolean;
  filter?: (className: string) => boolean;
};

export type CLI_UpType = {
  prefix: string | undefined;
  ignore: string[] | undefined;
  safe: boolean | undefined;
  deleteNonEmptyClass: boolean | undefined;
};
