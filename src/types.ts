import { z } from "zod";

export type TextContent = {
  type: "text";
  text: string;
};

export type ToolResponse = {
  content: TextContent[];
};

export const StandingSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  rank: z.number(),
  points: z.string().optional(),
  gamesBack: z.number().optional(),
  winPercentage: z.number().optional(),
});

export const RosterItemSchema = z.object({
  id: z.string(),
  position: z.string(),
  salary: z.number().optional(),
  status: z.string().optional(),
});

export const PlayerInfoRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  ADP: z.union([z.number(), z.string()]),
});

export type Standing = z.infer<typeof StandingSchema>;
export type RosterItem = z.infer<typeof RosterItemSchema>;
export type PlayerInfoRow = z.infer<typeof PlayerInfoRowSchema>;

export function toToolError(message: string): ToolResponse {
  return { content: [{ type: "text", text: `Error: ${message}` }] };
}
