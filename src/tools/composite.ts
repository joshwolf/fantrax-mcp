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
): Promise<ToolResponse> {
  const [rostersData, standings, scoringCategories] = await Promise.all([
    client.getAllRosters(),
    client.getStandings(),
    client.getScoringCategories(),
  ]);

  const rosters = rostersData as { rosters?: Record<string, unknown> };
  const teamRoster = rosters.rosters?.[teamId] ?? null;

  return toJson({ teamId, roster: teamRoster, standings, scoringCategories });
}

export async function getWaiverCandidatesHandler(client: FantraxClient): Promise<ToolResponse> {
  const [freeAgents, playerInfo, scoringCategories] = await Promise.all([
    client.getFreeAgents(),
    client.getPlayerInfo(),
    client.getScoringCategories(),
  ]);

  return toJson({ scoringCategories, freeAgents, playerInfo });
}

export async function comparePlayersHandler(
  client: FantraxClient,
  player1: string,
  player2: string,
): Promise<ToolResponse> {
  const [allPlayers, scoringCategories] = await Promise.all([
    client.getPlayerInfo(),
    client.getScoringCategories(),
  ]);

  const player1Data = filterPlayersByName(allPlayers, player1);
  const player2Data = filterPlayersByName(allPlayers, player2);

  return toJson({
    scoringCategories,
    player1: { name: player1, data: player1Data },
    player2: { name: player2, data: player2Data },
  });
}

export function registerCompositeTools(server: McpServer, client: FantraxClient): void {
  server.tool(
    "get_team_overview",
    "Get a snapshot of a specific team: their roster, league standings, and the league's scoring categories",
    {
      teamId: z.string().describe("The Fantrax team ID"),
    },
    ({ teamId }) => getTeamOverviewHandler(client, teamId),
  );

  server.tool(
    "get_waiver_candidates",
    "Get all free agents enriched with ADP context and league scoring categories — use this to find and rank add/drop candidates",
    {},
    () => getWaiverCandidatesHandler(client),
  );

  server.tool(
    "compare_players",
    "Compare two MLB players side-by-side using ADP, position, and league scoring categories",
    {
      player1: z.string().describe("Name of the first player"),
      player2: z.string().describe("Name of the second player"),
    },
    ({ player1, player2 }) => comparePlayersHandler(client, player1, player2),
  );
}
