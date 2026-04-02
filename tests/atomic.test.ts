import { describe, it, expect, vi } from "vitest";
import {
  getLeagueInfoHandler,
  getLeagueSummaryHandler,
  getStandingsHandler,
  listTeamsHandler,
  getAllRostersHandler,
  getTeamRosterHandler,
  getFreeAgentsHandler,
  getPlayerInfoHandler,
  getScoringCategoriesHandler,
} from "../src/tools/atomic.js";
import type { FantraxClient } from "../src/client.js";

const mockScoringCategories = {
  HITTING: { R: { Default: "1.0" }, HR: { Default: "1.0" } },
  PITCHING: { K: { Default: "1.0" }, ERA: { Default: "1.0" } },
};

const mockLeagueInfo = {
  leagueName: "Test League",
  seasonYear: 2026,
  startDate: "2026-03-25",
  endDate: "2026-09-27",
  rosterInfo: { maxTotalPlayers: 23 },
  draftSettings: { budget: 260 },
  playerInfo: { "p1": { status: "T", eligiblePos: "OF" } },
};

function makeClient(overrides: Partial<Record<keyof FantraxClient, unknown>> = {}): FantraxClient {
  return {
    getLeagueInfo: vi.fn().mockResolvedValue(mockLeagueInfo),
    getStandings: vi.fn().mockResolvedValue([
      { teamId: "t1", teamName: "Team A", rank: 1, points: "100" },
      { teamId: "t2", teamName: "Team B", rank: 2, points: "80" },
    ]),
    getAllRosters: vi.fn().mockResolvedValue({ rosters: { "team-1": { teamName: "Team A", rosterItems: [] } } }),
    getTeamRoster: vi.fn().mockResolvedValue({ teamName: "Team A", rosterItems: [] }),
    getFreeAgents: vi.fn().mockResolvedValue([{ id: "p1", name: "Player, Alpha", team: "NYY", position: "OF", eligiblePositions: "OF,UT" }]),
    getPlayerInfo: vi.fn().mockResolvedValue([{ name: "Player A", adp: 10 }]),
    getPlayerIds: vi.fn().mockResolvedValue({ "p1": { name: "Player, Alpha" } }),
    getScoringCategories: vi.fn().mockResolvedValue(mockScoringCategories),
    ...overrides,
  } as unknown as FantraxClient;
}

describe("getLeagueInfoHandler", () => {
  it("returns league info as JSON text content", async () => {
    const client = makeClient();
    const result = await getLeagueInfoHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(mockLeagueInfo);
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getLeagueInfo: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getLeagueInfoHandler(client)).rejects.toThrow("API error");
  });
});

describe("getLeagueSummaryHandler", () => {
  it("returns only summary fields from league info", async () => {
    const client = makeClient();
    const result = await getLeagueSummaryHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("leagueName", "Test League");
    expect(parsed).toHaveProperty("seasonYear", 2026);
    expect(parsed).toHaveProperty("startDate");
    expect(parsed).toHaveProperty("endDate");
    expect(parsed).toHaveProperty("rosterInfo");
    expect(parsed).toHaveProperty("draftSettings");
  });

  it("does not include the full playerInfo map", async () => {
    const client = makeClient();
    const result = await getLeagueSummaryHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).not.toHaveProperty("playerInfo");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getLeagueInfo: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getLeagueSummaryHandler(client)).rejects.toThrow("API error");
  });
});

describe("getStandingsHandler", () => {
  it("returns standings as JSON text content", async () => {
    const client = makeClient();
    const result = await getStandingsHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].rank).toBe(1);
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getStandings: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getStandingsHandler(client)).rejects.toThrow("API error");
  });
});

describe("listTeamsHandler", () => {
  it("returns only teamId, teamName, and rank per team", async () => {
    const client = makeClient();
    const result = await listTeamsHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toEqual({ teamId: "t1", teamName: "Team A", rank: 1 });
    expect(parsed[1]).toEqual({ teamId: "t2", teamName: "Team B", rank: 2 });
  });

  it("does not include points or winPercentage", async () => {
    const client = makeClient();
    const result = await listTeamsHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed[0]).not.toHaveProperty("points");
    expect(parsed[0]).not.toHaveProperty("winPercentage");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getStandings: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(listTeamsHandler(client)).rejects.toThrow("API error");
  });
});

describe("getAllRostersHandler", () => {
  it("returns all rosters as JSON text content", async () => {
    const client = makeClient();
    const result = await getAllRostersHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("rosters");
    expect(parsed.rosters).toHaveProperty("team-1");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getAllRosters: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getAllRostersHandler(client)).rejects.toThrow("API error");
  });
});

describe("getTeamRosterHandler", () => {
  it("returns the roster for the requested team", async () => {
    const client = makeClient();
    const result = await getTeamRosterHandler(client, "team-1");

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("teamName", "Team A");
  });

  it("returns null when teamId is not found", async () => {
    const client = makeClient({ getTeamRoster: vi.fn().mockResolvedValue(null) });
    const result = await getTeamRosterHandler(client, "unknown");
    expect(JSON.parse(result.content[0].text)).toBeNull();
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getTeamRoster: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getTeamRosterHandler(client, "team-1")).rejects.toThrow("API error");
  });
});

describe("getFreeAgentsHandler", () => {
  it("returns free agents list as JSON text content", async () => {
    const client = makeClient();
    const result = await getFreeAgentsHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe("Player, Alpha");
    expect(parsed[0].eligiblePositions).toBe("OF,UT");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getFreeAgents: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getFreeAgentsHandler(client)).rejects.toThrow("API error");
  });
});

describe("getPlayerInfoHandler", () => {
  it("returns player ADP data as JSON text content", async () => {
    const client = makeClient();
    const result = await getPlayerInfoHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual([{ name: "Player A", adp: 10 }]);
  });

  it("passes position, limit, and order to the client", async () => {
    const client = makeClient();
    await getPlayerInfoHandler(client, "SP", 25, "adp");

    expect(client.getPlayerInfo).toHaveBeenCalledWith("SP", 25, "adp");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getPlayerInfoHandler(client)).rejects.toThrow("API error");
  });
});

describe("getScoringCategoriesHandler", () => {
  it("returns scoring categories as JSON text content", async () => {
    const client = makeClient();
    const result = await getScoringCategoriesHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("HITTING");
    expect(parsed).toHaveProperty("PITCHING");
  });

  it("returns empty object when no categories present", async () => {
    const client = makeClient({ getScoringCategories: vi.fn().mockResolvedValue({}) });
    const result = await getScoringCategoriesHandler(client);
    expect(JSON.parse(result.content[0].text)).toEqual({});
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getScoringCategories: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getScoringCategoriesHandler(client)).rejects.toThrow("API error");
  });
});
