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

export async function getEnrichedRostersHandler(client: FantraxClient): Promise<ToolResponse> {
  const [rostersData, playerInfoData] = await Promise.all([
    client.getAllRosters(),
    client.getPlayerInfo(undefined, 2000),
  ]);

  const rosters = rostersData as { rosters?: Record<string, any> };
  const playerInfo = playerInfoData as Array<{ id: string; name: string; ADP: number | string }>;

  const playerMap = new Map(playerInfo.map((p) => [p.id, p]));

  const enrichedRosters: Record<string, any> = {};

  if (rosters.rosters) {
    for (const [teamId, team] of Object.entries(rosters.rosters)) {
      const enrichedItems = (team.rosterItems || []).map((item: any) => {
        const pInfo = playerMap.get(item.id);
        return {
          ...item,
          name: pInfo?.name || "Unknown",
          ADP: pInfo?.ADP ?? "N/A",
        };
      });
      enrichedRosters[teamId] = {
        ...team,
        rosterItems: enrichedItems,
      };
    }
  }

  return toJson({ rosters: enrichedRosters });
}

export async function findTradeTargetsHandler(
  client: FantraxClient,
  teamId: string,
  position: string,
  maxAdp: number,
): Promise<ToolResponse> {
  const [rostersData, playerInfoData, standingsData] = await Promise.all([
    client.getAllRosters(),
    client.getPlayerInfo(undefined, 2000),
    client.getStandings(),
  ]);

  const rosters = rostersData as { rosters?: Record<string, any> };
  const playerInfo = playerInfoData as Array<{ id: string; name: string; ADP: number | string }>;
  const standings = standingsData as Array<{ teamId: string; rank: number }>;

  const playerMap = new Map(playerInfo.map((p) => [p.id, p]));

  const totalTeams = standings.length;
  const bottomHalfTeams = new Set(
    standings.filter((s) => s.rank > totalTeams / 2).map((s) => s.teamId),
  );

  const targets = [];

  if (rosters.rosters) {
    for (const [tid, team] of Object.entries(rosters.rosters)) {
      if (tid === teamId) continue;
      if (!bottomHalfTeams.has(tid)) continue;

      for (const item of team.rosterItems || []) {
        if (item.position === position || position === "ANY") {
          const pInfo = playerMap.get(item.id);
          const adp = typeof pInfo?.ADP === "number" ? pInfo.ADP : 9999;
          if (pInfo && adp <= maxAdp) {
            targets.push({
              teamId: tid,
              teamName: team.teamName,
              playerId: item.id,
              name: pInfo.name,
              position: item.position,
              salary: item.salary,
              status: item.status,
              ADP: pInfo.ADP,
            });
          }
        }
      }
    }
  }

  targets.sort((a, b) => (a.ADP as number) - (b.ADP as number));

  return toJson({ targets });
}

export function registerCompositeTools(server: McpServer, client: FantraxClient): void {
  server.tool(
    "get_enriched_rosters",
    "Get every team's current roster in the league, enriched with player names and ADP data",
    {},
    () => getEnrichedRostersHandler(client),
  );

  server.tool(
    "find_trade_targets",
    "Find trade targets by position from teams in the bottom half of the standings",
    {
      teamId: z.string().describe("Your Fantrax team ID"),
      position: z.string().describe("The position to target (e.g. '2B', 'C', 'SP', or 'ANY')"),
      maxAdp: z.number().describe("The maximum ADP to consider (e.g. 100)"),
    },
    ({ teamId, position, maxAdp }) => findTradeTargetsHandler(client, teamId, position, maxAdp),
  );

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
