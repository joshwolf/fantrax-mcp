export type TextContent = {
  type: "text";
  text: string;
};

export type ToolResponse = {
  content: TextContent[];
};

export type FantraxPostPayload = {
  msgs: Array<{
    method: string;
    data: Record<string, unknown>;
  }>;
};
