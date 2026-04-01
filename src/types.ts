export type TextContent = {
  type: "text";
  text: string;
};

export type ToolResponse = {
  content: TextContent[];
};
