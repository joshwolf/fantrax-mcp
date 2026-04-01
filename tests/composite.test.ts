import { describe, it, expect, vi } from "vitest";
import {
  getTeamOverviewHandler,
  getWaiverCandidatesHandler,
  comparePlayersHandler,
} from "../src/tools/composite.js";
import type { FantraxClient } from "../src/client.js";

const mockScoringCategories = {
  HITTING: { R: { Default: "1.0" }, HR: { Default: "1.0" } },
  PITCHING: { K: { Default: "1.0" }, ERA: { Default: "1.0" } },
};

const mockFreeAgents = [
  { id: "fa-1", name: "Jones, Adam", team: "ARI", position: "OF", eligiblePositions: "OF,UT" },
  { id: "fa-2", name: "Smith, Bob", team: "CHC", position: "SP", eligiblePositions: "SP" },
];

function makeClient(overrides: Partial<Record<keyof FantraxClient, unknown>> = {}): FantraxClient {
  return {
    getLeagueInfo: vi.fn().mockResolvedValue({}),
    getStandings: vi.fn().mockResolvedValue([{ teamName: "Team A", rank: 1, points: "50" }]),
    getAllRosters: vi.fn().mockResolvedValue({
      rosters: {
        "team-1": { teamName: "My Team", rosterItems: [{ id: "p1", position: "OF" }] },
        "team-2": { teamName: "Their Team", rosterItems: [{ id: "p2", position: "SP" }] },
      },
    }),
    getFreeAgents: vi.fn().mockResolvedValue(mockFreeAgents),
    getPlayerInfo: vi.fn().mockResolvedValue([
      { name: "Shohei Ohtani", position: "DH", adp: 1 },
      { name: "Ronald Acuña Jr.", position: "OF", adp: 2 },
      { name: "Mike Trout", position: "OF", adp: 5 },
    ]),
    getPlayerIds: vi.fn().mockResolvedValue({}),
    getScoringCategories: vi.fn().mockResolvedValue(mockScoringCategories),
    ...overrides,
  } as unknown as FantraxClient;
}

describe("getTeamOverviewHandler", () => {
  it("returns the specified team's roster, standings, and scoring categories", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "team-1");

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.teamId).toBe("team-1");
    expect(parsed).toHaveProperty("roster");
    expect(parsed).toHaveProperty("standings");
    expect(parsed).toHaveProperty("scoringCategories");
  });

  it("returns the correct roster for the requested teamId", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "team-1");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.roster.teamName).toBe("My Team");
  });

  it("returns null roster when teamId is not found in rosters", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "team-unknown");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.roster).toBeNull();
  });

  it("propagates error when getAllRosters fails", async () => {
    const client = makeClient({ getAllRosters: vi.fn().mockRejectedValue(new Error("Rosters error")) });
    await expect(getTeamOverviewHandler(client, "team-1")).rejects.toThrow("Rosters error");
  });

  it("propagates error when getStandings fails", async () => {
    const client = makeClient({ getStandings: vi.fn().mockRejectedValue(new Error("Standings error")) });
    await expect(getTeamOverviewHandler(client, "team-1")).rejects.toThrow("Standings error");
  });
});

describe("getWaiverCandidatesHandler", () => {
  it("returns free agents, player ADP, and scoring categories", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("freeAgents");
    expect(parsed).toHaveProperty("playerInfo");
    expect(parsed).toHaveProperty("scoringCategories");
  });

  it("includes the full list of free agents in the response", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.freeAgents).toHaveLength(2);
    expect(parsed.freeAgents[0].name).toBe("Jones, Adam");
  });

  it("propagates error when getFreeAgents fails", async () => {
    const client = makeClient({ getFreeAgents: vi.fn().mockRejectedValue(new Error("FA error")) });
    await expect(getWaiverCandidatesHandler(client)).rejects.toThrow("FA error");
  });

  it("propagates error when getPlayerInfo fails", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockRejectedValue(new Error("Player info error")) });
    await expect(getWaiverCandidatesHandler(client)).rejects.toThrow("Player info error");
  });
});

describe("comparePlayersHandler", () => {
  it("returns side-by-side data for two named players with scoring categories", async () => {
    const client = makeClient();
    const result = await comparePlayersHandler(client, "Shohei Ohtani", "Mike Trout");

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.player1.name).toBe("Shohei Ohtani");
    expect(parsed.player2.name).toBe("Mike Trout");
    expect(parsed.player1.data).toHaveLength(1);
    expect(parsed.player1.data[0].name).toBe("Shohei Ohtani");
    expect(parsed.player2.data[0].name).toBe("Mike Trout");
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
    const result = await comparePlayersHandler(client, "shohei ohtani", "mike trout");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.player1.data).toHaveLength(1);
    expect(parsed.player2.data).toHaveLength(1);
  });

  it("propagates error when getPlayerInfo fails", async () => {
    const client = makeClient({ getPlayerInfo: vi.fn().mockRejectedValue(new Error("Player info error")) });
    await expect(comparePlayersHandler(client, "Player A", "Player B")).rejects.toThrow("Player info error");
  });
});
