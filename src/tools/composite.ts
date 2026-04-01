import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FantraxClient } from "../client";
import type { ToolResponse } from "../types";

function toJson(data: unknown): ToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function filterPlayersByName(players: unknown, name: string): unknown {
  if (!Array.isArray(players)) return [];
  const lower = name.toLowerCase();
  return players.filter((p) => {
    if (typeof p !== "object" || p === null) return false;
    const record = p as Record<string, unknown>;
    return Object.values(record).some(
      (v) => typeof v === "string" && v.toLowerCase().includes(lower),
    );
  });
}

export async function getTeamOverviewHandler(
  client: FantraxClient,
  teamId: string,
  scoringPeriod?: number,
): Promise<ToolResponse> {
  const [roster, scoring, standings] = await Promise.all([
    client.getRoster(teamId, scoringPeriod),
    client.getScoring(),
    client.getStandings(),
  ]);

  return toJson({ teamId, roster, scoring, standings });
}

export async function evaluateTradeTargetsHandler(client: FantraxClient): Promise<ToolResponse> {
  const [tradeBlocks, playerInfo] = await Promise.all([
    client.getTradeBlocks(),
    client.getPlayerInfo(),
  ]);

  return toJson({ tradeBlocks, playerInfo });
}

export async function getWaiverCandidatesHandler(
  client: FantraxClient,
  maxResults?: number,
): Promise<ToolResponse> {
  const [transactions, playerInfo] = await Promise.all([
    client.getTransactions(maxResults),
    client.getPlayerInfo(),
  ]);

  return toJson({ transactions, playerInfo });
}

export async function comparePlayersHandler(
  client: FantraxClient,
  player1: string,
  player2: string,
): Promise<ToolResponse> {
  const allPlayers = await client.getPlayerInfo();

  const player1Data = filterPlayersByName(allPlayers, player1);
  const player2Data = filterPlayersByName(allPlayers, player2);

  return toJson({ player1: { name: player1, data: player1Data }, player2: { name: player2, data: player2Data } });
}

export function registerCompositeTools(server: McpServer, client: FantraxClient): void {
  server.tool(
    "get_team_overview",
    "Get a full snapshot of a team's roster, recent scoring, and standings position",
    {
      teamId: z.string().describe("The Fantrax team ID"),
      scoringPeriod: z.number().int().optional().describe("Scoring period number"),
    },
    ({ teamId, scoringPeriod }) => getTeamOverviewHandler(client, teamId, scoringPeriod),
  );

  server.tool(
    "evaluate_trade_targets",
    "Get trade block players enriched with ADP data",
    {},
    () => evaluateTradeTargetsHandler(client),
  );

  server.tool(
    "get_waiver_candidates",
    "Get pending waiver wire pickups enriched with ADP context",
    { maxResults: z.number().int().optional().describe("Maximum number of results to return") },
    ({ maxResults }) => getWaiverCandidatesHandler(client, maxResults),
  );

  server.tool(
    "compare_players",
    "Compare two MLB players side-by-side using ADP, position, and stats",
    {
      player1: z.string().describe("Name of the first player"),
      player2: z.string().describe("Name of the second player"),
    },
    ({ player1, player2 }) => comparePlayersHandler(client, player1, player2),
  );
}
