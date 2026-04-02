import { describe, it, expect, vi } from "vitest";
import {
  getTeamOverviewHandler,
  getWaiverCandidatesHandler,
  comparePlayersHandler,
  getEnrichedRostersHandler,
  findTradeTargetsHandler,
  type RequestCache,
} from "../src/tools/composite.js";
import type { FantraxClient } from "../src/client.js";

const mockScoringCategories = {
  HITTING: { R: { Default: "1.0" }, HR: { Default: "1.0" } },
  PITCHING: { K: { Default: "1.0" }, ERA: { Default: "1.0" } },
};

const mockStandings = [
  { teamId: "t1", teamName: "First",  rank: 1, points: "100", gamesBack: 0, winPercentage: 0 },
  { teamId: "t2", teamName: "Second", rank: 2, points: "80",  gamesBack: 0, winPercentage: 0 },
  { teamId: "t3", teamName: "Third",  rank: 3, points: "60",  gamesBack: 0, winPercentage: 0 },
  { teamId: "t4", teamName: "Fourth", rank: 4, points: "40",  gamesBack: 0, winPercentage: 0 },
];

const mockFreeAgents = [
  { id: "fa-1", name: "Jones, Adam",  team: "ARI", position: "OF", eligiblePositions: "OF,UT" },
  { id: "fa-2", name: "Smith, Bob",   team: "CHC", position: "SP", eligiblePositions: "SP" },
  { id: "fa-3", name: "Lee, Chris",   team: "NYY", position: "OF", eligiblePositions: "OF,UT" },
];

const mockPlayerInfo = [
  { id: "fa-1",  name: "Jones, Adam",          ADP: 10 },
  { id: "fa-2",  name: "Smith, Bob",           ADP: 25 },
  { id: "fa-3",  name: "Lee, Chris",           ADP: 50 },
  { id: "ohtani", name: "Ohtani, Shohei",      ADP: 1 },
  { id: "trout",  name: "Trout, Mike",         ADP: 5 },
  { id: "p-ir",   name: "Hurt, Guy",           ADP: 30 },
];

const mockRosters = {
  rosters: {
    "t1": {
      teamName: "First",
      rosterItems: [
        { id: "ohtani", position: "OF", status: "ACTIVE", salary: 22 },
      ],
    },
    "t2": {
      teamName: "Second",
      rosterItems: [
        { id: "trout",  position: "OF", status: "ACTIVE", salary: 21 },
        { id: "p-ir",   position: "SP", status: "INJURED_RESERVE", salary: 10 },
      ],
    },
    "t3": {
      teamName: "Third",
      rosterItems: [
        { id: "fa-2", position: "SP", status: "ACTIVE", salary: 5 },
      ],
    },
    "t4": {
      teamName: "Fourth",
      rosterItems: [
        { id: "fa-1", position: "OF", status: "ACTIVE", salary: 8 },
      ],
    },
  },
};

function makeClient(overrides: Partial<Record<keyof FantraxClient, unknown>> = {}): FantraxClient {
  return {
    getLeagueInfo: vi.fn().mockResolvedValue({}),
    getStandings: vi.fn().mockResolvedValue(mockStandings),
    getAllRosters: vi.fn().mockResolvedValue(mockRosters),
    getTeamRoster: vi.fn().mockResolvedValue(mockRosters.rosters["t1"]),
    getFreeAgents: vi.fn().mockResolvedValue(mockFreeAgents),
    getPlayerInfo: vi.fn().mockResolvedValue(mockPlayerInfo),
    getPlayerIds: vi.fn().mockResolvedValue({}),
    getScoringCategories: vi.fn().mockResolvedValue(mockScoringCategories),
    ...overrides,
  } as unknown as FantraxClient;
}

// ─── getTeamOverviewHandler ───────────────────────────────────────────────────

describe("getTeamOverviewHandler", () => {
  it("returns the specified team's roster, standings, and scoring categories", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "t1");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.teamId).toBe("t1");
    expect(parsed).toHaveProperty("roster");
    expect(parsed).toHaveProperty("standings");
    expect(parsed).toHaveProperty("scoringCategories");
  });

  it("returns the correct roster for the requested teamId", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "t1");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.roster.teamName).toBe("First");
  });

  it("returns null roster when teamId is not found in rosters", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "unknown");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.roster).toBeNull();
  });

  it("propagates error when getAllRosters fails", async () => {
    const client = makeClient({ getAllRosters: vi.fn().mockRejectedValue(new Error("Rosters error")) });
    await expect(getTeamOverviewHandler(client, "t1")).rejects.toThrow("Rosters error");
  });

  it("propagates error when getStandings fails", async () => {
    const client = makeClient({ getStandings: vi.fn().mockRejectedValue(new Error("Standings error")) });
    await expect(getTeamOverviewHandler(client, "t1")).rejects.toThrow("Standings error");
  });

  it("reuses cached allRosters when cache is supplied", async () => {
    const client = makeClient();
    const cache: RequestCache = {};
    await getTeamOverviewHandler(client, "t1", cache);
    await getTeamOverviewHandler(client, "t2", cache);
    expect(client.getAllRosters).toHaveBeenCalledTimes(1);
  });
});

// ─── getWaiverCandidatesHandler ───────────────────────────────────────────────

describe("getWaiverCandidatesHandler", () => {
  it("returns candidates joined with ADP and scoring categories", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("candidates");
    expect(parsed).toHaveProperty("scoringCategories");
  });

  it("only includes free agents that have a matching ADP entry", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.candidates.every((c: any) => c.ADP !== undefined)).toBe(true);
  });

  it("ranks candidates by ADP ascending", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    const adps = parsed.candidates.map((c: any) => c.ADP);
    expect(adps).toEqual([...adps].sort((a, b) => a - b));
  });

  it("does not include a raw freeAgents or playerInfo array", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).not.toHaveProperty("freeAgents");
    expect(parsed).not.toHaveProperty("playerInfo");
  });

  it("returns an error string when playerInfo has an invalid shape", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockResolvedValue("not-an-array") });
    const result = await getWaiverCandidatesHandler(client);
    expect(result.content[0].text).toMatch(/^Error:/);
  });

  it("propagates error when getFreeAgents fails", async () => {
    const client = makeClient({ getFreeAgents: vi.fn().mockRejectedValue(new Error("FA error")) });
    await expect(getWaiverCandidatesHandler(client)).rejects.toThrow("FA error");
  });
});

// ─── comparePlayersHandler ────────────────────────────────────────────────────

describe("comparePlayersHandler", () => {
  it("returns side-by-side data for two named players with scoring categories", async () => {
    const client = makeClient();
    const result = await comparePlayersHandler(client, "Ohtani", "Trout");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.player1.name).toBe("Ohtani");
    expect(parsed.player2.name).toBe("Trout");
    expect(parsed.player1.data).toHaveLength(1);
    expect(parsed.player2.data).toHaveLength(1);
    expect(parsed).toHaveProperty("scoringCategories");
  });

  it("returns empty data array when player name does not match", async () => {
    const client = makeClient();
    const result = await comparePlayersHandler(client, "Unknown Player", "Also Unknown");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.player1.data).toHaveLength(0);
    expect(parsed.player2.data).toHaveLength(0);
  });

  it("is case-insensitive when matching player names", async () => {
    const client = makeClient();
    const result = await comparePlayersHandler(client, "ohtani", "trout");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.player1.data).toHaveLength(1);
    expect(parsed.player2.data).toHaveLength(1);
  });

  it("calls getPlayerInfo with limit 500", async () => {
    const client = makeClient();
    await comparePlayersHandler(client, "Ohtani", "Trout");
    expect(client.getPlayerInfo).toHaveBeenCalledWith(undefined, 500);
  });

  it("propagates error when getPlayerInfo fails", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockRejectedValue(new Error("Player info error")) });
    await expect(comparePlayersHandler(client, "Player A", "Player B")).rejects.toThrow("Player info error");
  });
});

// ─── findTradeTargetsHandler ──────────────────────────────────────────────────

describe("findTradeTargetsHandler", () => {
  it("returns targets from bottom-half teams by default", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 999, ["INJURED_RESERVE"], false);

    const parsed = JSON.parse(result.content[0].text);
    const teamIds = parsed.targets.map((t: any) => t.teamId);
    expect(teamIds).not.toContain("t1");
    expect(teamIds).not.toContain("t2");
  });

  it("includes all teams when includeAllTeams is true", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 999, ["INJURED_RESERVE"], true);

    const parsed = JSON.parse(result.content[0].text);
    const teamIds = parsed.targets.map((t: any) => t.teamId);
    expect(teamIds).toContain("t2");
    expect(teamIds).not.toContain("t1");
  });

  it("excludes INJURED_RESERVE players by default", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 999, ["INJURED_RESERVE"], true);

    const parsed = JSON.parse(result.content[0].text);
    const statuses = parsed.targets.map((t: any) => t.status);
    expect(statuses).not.toContain("INJURED_RESERVE");
  });

  it("includes INJURED_RESERVE when excludeStatuses is empty", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "SP", 999, [], true);

    const parsed = JSON.parse(result.content[0].text);
    const statuses = parsed.targets.map((t: any) => t.status);
    expect(statuses).toContain("INJURED_RESERVE");
  });

  it("filters by position", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "SP", 999, [], true);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.targets.length).toBeGreaterThan(0);
    expect(parsed.targets.every((t: any) => t.position === "SP")).toBe(true);
  });

  it("respects maxAdp filter", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 3, [], true);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.targets.every((t: any) => t.ADP <= 3)).toBe(true);
  });

  it("returns targets sorted by ADP ascending", async () => {
    const client = makeClient();
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 999, [], true);

    const parsed = JSON.parse(result.content[0].text);
    const adps = parsed.targets.map((t: any) => t.ADP as number);
    expect(adps).toEqual([...adps].sort((a, b) => a - b));
  });

  it("returns an error string when standings has an invalid shape", async () => {
    const client = makeClient({ getStandings: vi.fn().mockResolvedValue("bad") });
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 999, [], false);
    expect(result.content[0].text).toMatch(/^Error:/);
  });

  it("returns an error string when playerInfo has an invalid shape", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockResolvedValue(null) });
    const result = await findTradeTargetsHandler(client, "t1", "ANY", 999, [], false);
    expect(result.content[0].text).toMatch(/^Error:/);
  });

  it("reuses cached data when cache is supplied", async () => {
    const client = makeClient();
    const cache: RequestCache = {};
    await findTradeTargetsHandler(client, "t1", "ANY", 999, [], false, cache);
    await findTradeTargetsHandler(client, "t2", "SP",  999, [], false, cache);
    expect(client.getAllRosters).toHaveBeenCalledTimes(1);
    expect(client.getStandings).toHaveBeenCalledTimes(1);
    expect(client.getPlayerInfo).toHaveBeenCalledTimes(1);
  });
});

// ─── getEnrichedRostersHandler ────────────────────────────────────────────────

describe("getEnrichedRostersHandler", () => {
  it("returns all rosters enriched with player names and ADP", async () => {
    const client = makeClient();
    const result = await getEnrichedRostersHandler(client);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("rosters");
    const t1Items = parsed.rosters["t1"].rosterItems;
    expect(t1Items[0]).toHaveProperty("name", "Ohtani, Shohei");
    expect(t1Items[0]).toHaveProperty("ADP", 1);
  });

  it("uses 'Unknown' and 'N/A' for players missing from ADP list", async () => {
    const client = makeClient({
      getAllRosters: vi.fn().mockResolvedValue({
        rosters: {
          "t1": { teamName: "First", rosterItems: [{ id: "missing-id", position: "OF", status: "ACTIVE" }] },
        },
      }),
    });
    const result = await getEnrichedRostersHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.rosters["t1"].rosterItems[0].name).toBe("Unknown");
    expect(parsed.rosters["t1"].rosterItems[0].ADP).toBe("N/A");
  });

  it("returns an error string when playerInfo has an invalid shape", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockResolvedValue({ bad: "shape" }) });
    const result = await getEnrichedRostersHandler(client);
    expect(result.content[0].text).toMatch(/^Error:/);
  });
});
