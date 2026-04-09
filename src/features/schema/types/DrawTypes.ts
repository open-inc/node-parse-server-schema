export type DrawFormat = "mermaid" | "markdown" | "html";

export type DrawRenderer = "dagre-wrapper" | "dagre-d3" | "elk";

export type DrawOptions = {
  output?: string;
  format?: DrawFormat;
  prefix?: string;
  ignore?: string[];
  fontSize?: number;
  defaultRenderer?: DrawRenderer;
};

export type CLI_DrawType = DrawOptions;
