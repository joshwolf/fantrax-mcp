import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FantraxClient } from "../client";
import type { ToolResponse } from "../types";

function toJson(data: unknown): ToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export async function getLeagueInfoHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getLeagueInfo();
  return toJson(data);
}

export async function getStandingsHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getStandings();
  return toJson(data);
}

export async function getAllRostersHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getAllRosters();
  return toJson(data);
}

export async function getFreeAgentsHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getFreeAgents();
  return toJson(data);
}

export async function getPlayerInfoHandler(
  client: FantraxClient,
  position?: string,
  limit?: number,
  order?: string,
): Promise<ToolResponse> {
  const data = await client.getPlayerInfo(position, limit, order);
  return toJson(data);
}

export async function getScoringCategoriesHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getScoringCategories();
  return toJson(data);
}

export function registerAtomicTools(server: McpServer, client: FantraxClient): void {
  server.tool(
    "get_league_info",
    "Get fantasy league info including teams, roster settings, and player statuses",
    {},
    () => getLeagueInfoHandler(client),
  );

  server.tool(
    "get_standings",
    "Get current league standings with rank, points, and win percentage per team",
    {},
    () => getStandingsHandler(client),
  );

  server.tool(
    "get_all_rosters",
    "Get every team's current roster in the league, including player IDs, positions, and salary",
    {},
    () => getAllRostersHandler(client),
  );

  server.tool(
    "get_free_agents",
    "Get all available free agents with name, MLB team, position, and fantasy-eligible positions. Use this to find add candidates.",
    {},
    () => getFreeAgentsHandler(client),
  );

  server.tool(
    "get_player_info",
    "Get MLB player ADP data — useful for ranking and valuing players",
    {
      position: z.string().optional().describe("Filter by position (e.g. SP, OF, 1B)"),
      limit: z.number().int().optional().describe("Number of players to return"),
      order: z.string().optional().describe("Sort order field"),
    },
    ({ position, limit, order }) => getPlayerInfoHandler(client, position, limit, order),
  );

  server.tool(
    "get_scoring_categories",
    "Get the scoring categories for this league — the specific stats that count toward standings (e.g. HR, OBP, TB, SB for hitting; K, ERA, WHIP, K/BB, W, SV for pitching). Always call this when evaluating or comparing players so recommendations reflect what actually matters in this league.",
    {},
    () => getScoringCategoriesHandler(client),
  );
}
