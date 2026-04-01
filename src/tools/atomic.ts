import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FantraxClient } from "../client.js";
import type { ToolResponse } from "../types.js";

function toJson(data: unknown): ToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export async function getLeagueInfoHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getLeagueInfo();
  return toJson(data);
}

export async function getStandingsHandler(
  client: FantraxClient,
  view?: string,
): Promise<ToolResponse> {
  const data = await client.getStandings(view);
  return toJson(data);
}

export async function getRosterHandler(
  client: FantraxClient,
  teamId: string,
  scoringPeriod?: number,
): Promise<ToolResponse> {
  const data = await client.getRoster(teamId, scoringPeriod);
  return toJson(data);
}

export async function getScoringHandler(
  client: FantraxClient,
  date?: string,
  period?: number,
): Promise<ToolResponse> {
  const data = await client.getScoring(date, period);
  return toJson(data);
}

export async function getTransactionsHandler(
  client: FantraxClient,
  maxResults?: number,
): Promise<ToolResponse> {
  const data = await client.getTransactions(maxResults);
  return toJson(data);
}

export async function getTradeBlocksHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getTradeBlocks();
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

export async function getPlayerIdsHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getPlayerIds();
  return toJson(data);
}

export function registerAtomicTools(server: McpServer, client: FantraxClient): void {
  server.tool("get_league_info", "Get fantasy league info including teams and settings", {}, () =>
    getLeagueInfoHandler(client),
  );

  server.tool(
    "get_standings",
    "Get current league standings",
    { view: z.string().optional().describe("Standings view type") },
    ({ view }) => getStandingsHandler(client, view),
  );

  server.tool(
    "get_roster",
    "Get roster info for a specific team",
    {
      teamId: z.string().describe("The Fantrax team ID"),
      scoringPeriod: z.number().int().optional().describe("Scoring period number"),
    },
    ({ teamId, scoringPeriod }) => getRosterHandler(client, teamId, scoringPeriod),
  );

  server.tool(
    "get_scoring",
    "Get live scoring stats for a date or period",
    {
      date: z.string().optional().describe("Date in YYYYMMDD format"),
      period: z.number().int().optional().describe("Scoring period number"),
    },
    ({ date, period }) => getScoringHandler(client, date, period),
  );

  server.tool(
    "get_transactions",
    "Get pending and historical transactions",
    { maxResults: z.number().int().optional().describe("Maximum number of results to return") },
    ({ maxResults }) => getTransactionsHandler(client, maxResults),
  );

  server.tool("get_trade_blocks", "Get all active trade blocks in the league", {}, () =>
    getTradeBlocksHandler(client),
  );

  server.tool(
    "get_player_info",
    "Get MLB player ADP data (no auth required)",
    {
      position: z.string().optional().describe("Filter by position (e.g. SP, OF, 1B)"),
      limit: z.number().int().optional().describe("Number of players to return"),
      order: z.string().optional().describe("Sort order field"),
    },
    ({ position, limit, order }) => getPlayerInfoHandler(client, position, limit, order),
  );

  server.tool(
    "get_player_ids",
    "Get all MLB player IDs from Fantrax (no auth required)",
    {},
    () => getPlayerIdsHandler(client),
  );
}
