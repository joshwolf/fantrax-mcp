import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FantraxClient } from "../client";
import {
  StandingSchema,
  RosterItemSchema,
  PlayerInfoRowSchema,
  toToolError,
  type ToolResponse,
  type Standing,
  type RosterItem,
  type PlayerInfoRow,
} from "../types";

export type RequestCache = {
  standings?: Promise<unknown>;
  allRosters?: Promise<unknown>;
  playerInfo?: Promise<unknown>;
  scoringCategories?: Promise<unknown>;
  freeAgents?: Promise<unknown>;
};

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

function parseStandings(data: unknown): Standing[] | string {
  const result = z.array(StandingSchema).safeParse(data);
  return result.success ? result.data : `Invalid standings shape: ${result.error.message}`;
}

function parsePlayerInfo(data: unknown): PlayerInfoRow[] | string {
  const result = z.array(PlayerInfoRowSchema).safeParse(data);
  return result.success ? result.data : `Invalid playerInfo shape: ${result.error.message}`;
}

function parseRosterItems(items: unknown): RosterItem[] | string {
  const result = z.array(RosterItemSchema).safeParse(items);
  return result.success ? result.data : `Invalid rosterItems shape: ${result.error.message}`;
}

function cachedGet(cache: RequestCache, key: keyof RequestCache, fetch: () => Promise<unknown>): Promise<unknown> {
  if (!cache[key]) {
    cache[key] = fetch();
  }
  return cache[key]!;
}

export async function getTeamOverviewHandler(
  client: FantraxClient,
  teamId: string,
  cache: RequestCache = {},
): Promise<ToolResponse> {
  const [rostersData, standings, scoringCategories] = await Promise.all([
    cachedGet(cache, "allRosters", () => client.getAllRosters()),
    cachedGet(cache, "standings", () => client.getStandings()),
    cachedGet(cache, "scoringCategories", () => client.getScoringCategories()),
  ]);

  const rosters = rostersData as { rosters?: Record<string, unknown> };
  const teamRoster = rosters.rosters?.[teamId] ?? null;

  return toJson({ teamId, roster: teamRoster, standings, scoringCategories });
}

export async function getWaiverCandidatesHandler(
  client: FantraxClient,
  cache: RequestCache = {},
): Promise<ToolResponse> {
  const [freeAgentsData, playerInfoData, scoringCategories] = await Promise.all([
    cachedGet(cache, "freeAgents", () => client.getFreeAgents()),
    cachedGet(cache, "playerInfo", () => client.getPlayerInfo()),
    cachedGet(cache, "scoringCategories", () => client.getScoringCategories()),
  ]);

  const playerInfoResult = parsePlayerInfo(playerInfoData);
  if (typeof playerInfoResult === "string") return toToolError(playerInfoResult);

  const freeAgents = freeAgentsData as Array<{
    id: string;
    name: string;
    team: string | null;
    position: string;
    eligiblePositions: string;
  }>;

  const playerMap = new Map(playerInfoResult.map((p) => [p.id, p]));

  const candidates = freeAgents
    .flatMap((fa) => {
      const pInfo = playerMap.get(fa.id);
      if (!pInfo) return [];
      const adp = typeof pInfo.ADP === "number" ? pInfo.ADP : 9999;
      return [{ ...fa, ADP: pInfo.ADP, adpSortKey: adp }];
    })
    .sort((a, b) => a.adpSortKey - b.adpSortKey)
    .map(({ adpSortKey: _dropped, ...rest }) => rest);

  return toJson({ scoringCategories, candidates });
}

export async function comparePlayersHandler(
  client: FantraxClient,
  player1: string,
  player2: string,
  cache: RequestCache = {},
): Promise<ToolResponse> {
  const [allPlayers, scoringCategories] = await Promise.all([
    cachedGet(cache, "playerInfo", () => client.getPlayerInfo(undefined, 500)),
    cachedGet(cache, "scoringCategories", () => client.getScoringCategories()),
  ]);

  const player1Data = filterPlayersByName(allPlayers, player1);
  const player2Data = filterPlayersByName(allPlayers, player2);

  return toJson({
    scoringCategories,
    player1: { name: player1, data: player1Data },
    player2: { name: player2, data: player2Data },
  });
}

export async function getEnrichedRostersHandler(
  client: FantraxClient,
  cache: RequestCache = {},
): Promise<ToolResponse> {
  const [rostersData, playerInfoData] = await Promise.all([
    cachedGet(cache, "allRosters", () => client.getAllRosters()),
    cachedGet(cache, "playerInfo", () => client.getPlayerInfo(undefined, 2000)),
  ]);

  const playerInfoResult = parsePlayerInfo(playerInfoData);
  if (typeof playerInfoResult === "string") return toToolError(playerInfoResult);

  const rosters = rostersData as { rosters?: Record<string, any> };
  const playerMap = new Map(playerInfoResult.map((p) => [p.id, p]));

  const enrichedRosters: Record<string, any> = {};

  if (rosters.rosters) {
    for (const [teamId, team] of Object.entries(rosters.rosters)) {
      const enrichedItems = (team.rosterItems || []).map((item: any) => {
        const pInfo = playerMap.get(item.id);
        return {
          ...item,
          name: pInfo?.name ?? "Unknown",
          ADP: pInfo?.ADP ?? "N/A",
        };
      });
      enrichedRosters[teamId] = { ...team, rosterItems: enrichedItems };
    }
  }

  return toJson({ rosters: enrichedRosters });
}

export async function findTradeTargetsHandler(
  client: FantraxClient,
  teamId: string,
  position: string,
  maxAdp: number,
  excludeStatuses: string[],
  includeAllTeams: boolean,
  cache: RequestCache = {},
): Promise<ToolResponse> {
  const [rostersData, playerInfoData, standingsData] = await Promise.all([
    cachedGet(cache, "allRosters", () => client.getAllRosters()),
    cachedGet(cache, "playerInfo", () => client.getPlayerInfo(undefined, 2000)),
    cachedGet(cache, "standings", () => client.getStandings()),
  ]);

  const playerInfoResult = parsePlayerInfo(playerInfoData);
  if (typeof playerInfoResult === "string") return toToolError(playerInfoResult);

  const standingsResult = parseStandings(standingsData);
  if (typeof standingsResult === "string") return toToolError(standingsResult);

  const rosters = rostersData as { rosters?: Record<string, any> };
  const playerMap = new Map(playerInfoResult.map((p) => [p.id, p]));

  const totalTeams = standingsResult.length;
  const bottomHalfTeams = new Set(
    standingsResult.filter((s) => s.rank > totalTeams / 2).map((s) => s.teamId),
  );

  const targets = [];

  if (rosters.rosters) {
    for (const [tid, team] of Object.entries(rosters.rosters)) {
      if (tid === teamId) continue;
      if (!includeAllTeams && !bottomHalfTeams.has(tid)) continue;

      const rosterItemsResult = parseRosterItems(team.rosterItems ?? []);
      if (typeof rosterItemsResult === "string") continue;

      for (const item of rosterItemsResult) {
        if (excludeStatuses.includes(item.status ?? "")) continue;

        const positionMatch =
          position === "ANY" ||
          item.position === position ||
          (item as any).eligiblePositions?.split(",").includes(position);

        if (!positionMatch) continue;

        const pInfo = playerMap.get(item.id);
        const adp = typeof pInfo?.ADP === "number" ? pInfo.ADP : 9999;
        if (pInfo && adp <= maxAdp) {
          targets.push({
            teamId: tid,
            teamName: team.teamName,
            playerId: item.id,
            name: pInfo.name,
            position: item.position,
            salary: (item as any).salary,
            status: item.status,
            ADP: pInfo.ADP,
          });
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
    "Find trade targets by position. By default searches bottom-half teams and excludes players on injured reserve.",
    {
      teamId: z.string().describe("Your Fantrax team ID"),
      position: z.string().describe("The position to target (e.g. '2B', 'C', 'SP', or 'ANY')"),
      maxAdp: z.number().describe("The maximum ADP to consider (e.g. 100)"),
      excludeStatuses: z
        .array(z.string())
        .optional()
        .describe("Player statuses to exclude (default: ['INJURED_RESERVE'])"),
      includeAllTeams: z
        .boolean()
        .optional()
        .describe("When true, search all teams instead of only bottom-half teams (default: false)"),
    },
    ({ teamId, position, maxAdp, excludeStatuses, includeAllTeams }) =>
      findTradeTargetsHandler(
        client,
        teamId,
        position,
        maxAdp,
        excludeStatuses ?? ["INJURED_RESERVE"],
        includeAllTeams ?? false,
      ),
  );

  server.tool(
    "get_team_overview",
    "Get a team's current roster, their league standings position, and the league's scoring categories",
    {
      teamId: z.string().describe("The Fantrax team ID"),
    },
    ({ teamId }) => getTeamOverviewHandler(client, teamId),
  );

  server.tool(
    "get_waiver_candidates",
    "Get all free agents ranked by ADP, enriched with player names and league scoring categories — use this to find and rank add/drop candidates",
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
