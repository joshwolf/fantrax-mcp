import { describe, it, expect, vi } from "vitest";
import {
  getLeagueInfoHandler,
  getStandingsHandler,
  getAllRostersHandler,
  getFreeAgentsHandler,
  getPlayerInfoHandler,
  getScoringCategoriesHandler,
} from "../src/tools/atomic.js";
import type { FantraxClient } from "../src/client.js";

const mockScoringCategories = {
  HITTING: { R: { Default: "1.0" }, HR: { Default: "1.0" } },
  PITCHING: { K: { Default: "1.0" }, ERA: { Default: "1.0" } },
};

function makeClient(overrides: Partial<Record<keyof FantraxClient, unknown>> = {}): FantraxClient {
  return {
    getLeagueInfo: vi.fn().mockResolvedValue({ leagueName: "Test League" }),
    getStandings: vi.fn().mockResolvedValue([{ teamName: "Team A", rank: 1 }]),
    getAllRosters: vi.fn().mockResolvedValue({ rosters: { "team-1": { teamName: "Team A", rosterItems: [] } } }),
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
    expect(JSON.parse(result.content[0].text)).toEqual({ leagueName: "Test League" });
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({ getLeagueInfo: vi.fn().mockRejectedValue(new Error("API error")) });
    await expect(getLeagueInfoHandler(client)).rejects.toThrow("API error");
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
