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

export async function getLeagueSummaryHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getLeagueInfo() as Record<string, unknown>;
  const { leagueName, seasonYear, startDate, endDate, rosterInfo, draftSettings } = data;
  return toJson({ leagueName, seasonYear, startDate, endDate, rosterInfo, draftSettings });
}

export async function getStandingsHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getStandings();
  return toJson(data);
}

export async function listTeamsHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getStandings() as Array<Record<string, unknown>>;
  const teams = data.map(({ teamId, teamName, rank }) => ({ teamId, teamName, rank }));
  return toJson(teams);
}

export async function getAllRostersHandler(client: FantraxClient): Promise<ToolResponse> {
  const data = await client.getAllRosters();
  return toJson(data);
}

export async function getTeamRosterHandler(
  client: FantraxClient,
  teamId: string,
): Promise<ToolResponse> {
  const data = await client.getTeamRoster(teamId);
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
    "Get full fantasy league info including teams, roster settings, and player statuses. Prefer get_league_summary when you only need high-level league details.",
    {},
    () => getLeagueInfoHandler(client),
  );

  server.tool(
    "get_league_summary",
    "Get lightweight league info: name, season year, start/end dates, roster settings, and draft settings. Use this instead of get_league_info when you don't need the full player status map.",
    {},
    () => getLeagueSummaryHandler(client),
  );

  server.tool(
    "get_standings",
    "Get current league standings with rank, points, and win percentage per team",
    {},
    () => getStandingsHandler(client),
  );

  server.tool(
    "list_teams",
    "Get a lightweight list of all teams: teamId, teamName, and rank. Use this to look up teamIds before calling tools that require one.",
    {},
    () => listTeamsHandler(client),
  );

  server.tool(
    "get_all_rosters",
    "Get every team's current roster in the league, including player IDs, positions, and salary. Prefer get_team_roster when you only need one team.",
    {},
    () => getAllRostersHandler(client),
  );

  server.tool(
    "get_team_roster",
    "Get a single team's current roster including player IDs, positions, and salary. Use this instead of get_all_rosters when you only need one team.",
    {
      teamId: z.string().describe("The Fantrax team ID"),
    },
    ({ teamId }) => getTeamRosterHandler(client, teamId),
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
