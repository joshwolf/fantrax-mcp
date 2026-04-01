import { describe, it, expect, vi } from "vitest";
import {
  getTeamOverviewHandler,
  evaluateTradeTargetsHandler,
  getWaiverCandidatesHandler,
  comparePlayersHandler,
} from "../src/tools/composite.js";
import type { FantraxClient } from "../src/client.js";

function makeClient(overrides: Partial<Record<keyof FantraxClient, unknown>> = {}): FantraxClient {
  return {
    getLeagueInfo: vi.fn().mockResolvedValue({}),
    getStandings: vi.fn().mockResolvedValue({ standings: [{ rank: 1 }] }),
    getRoster: vi.fn().mockResolvedValue({ players: ["PlayerA"] }),
    getScoring: vi.fn().mockResolvedValue({ scores: [] }),
    getTransactions: vi.fn().mockResolvedValue({ pending: ["txn1"], history: ["txn2"] }),
    getTradeBlocks: vi.fn().mockResolvedValue({ blocks: ["blockA"] }),
    getPlayerInfo: vi.fn().mockResolvedValue([
      { name: "Shohei Ohtani", position: "DH", adp: 1 },
      { name: "Ronald Acuña Jr.", position: "OF", adp: 2 },
      { name: "Mike Trout", position: "OF", adp: 5 },
    ]),
    getPlayerIds: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as FantraxClient;
}

describe("getTeamOverviewHandler", () => {
  it("returns merged roster, scoring, and standings data", async () => {
    const client = makeClient();
    const result = await getTeamOverviewHandler(client, "team-1");

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("roster");
    expect(parsed).toHaveProperty("scoring");
    expect(parsed).toHaveProperty("standings");
    expect(parsed.teamId).toBe("team-1");
  });

  it("passes teamId and scoringPeriod to getRoster", async () => {
    const client = makeClient();
    await getTeamOverviewHandler(client, "team-42", 7);

    expect(client.getRoster).toHaveBeenCalledWith("team-42", 7);
  });

  it("propagates error when getRoster fails", async () => {
    const client = makeClient({
      getRoster: vi.fn().mockRejectedValue(new Error("Roster error")),
    });

    await expect(getTeamOverviewHandler(client, "team-1")).rejects.toThrow("Roster error");
  });

  it("propagates error when getStandings fails", async () => {
    const client = makeClient({
      getStandings: vi.fn().mockRejectedValue(new Error("Standings error")),
    });

    await expect(getTeamOverviewHandler(client, "team-1")).rejects.toThrow("Standings error");
  });

  it("propagates error when getScoring fails", async () => {
    const client = makeClient({
      getScoring: vi.fn().mockRejectedValue(new Error("Scoring error")),
    });

    await expect(getTeamOverviewHandler(client, "team-1")).rejects.toThrow("Scoring error");
  });
});

describe("evaluateTradeTargetsHandler", () => {
  it("returns merged trade blocks and player ADP data", async () => {
    const client = makeClient();
    const result = await evaluateTradeTargetsHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("tradeBlocks");
    expect(parsed).toHaveProperty("playerInfo");
    expect(parsed.tradeBlocks).toEqual({ blocks: ["blockA"] });
  });

  it("propagates error when getTradeBlocks fails", async () => {
    const client = makeClient({
      getTradeBlocks: vi.fn().mockRejectedValue(new Error("Trade block error")),
    });

    await expect(evaluateTradeTargetsHandler(client)).rejects.toThrow("Trade block error");
  });

  it("propagates error when getPlayerInfo fails", async () => {
    const client = makeClient({
      getPlayerInfo: vi.fn().mockRejectedValue(new Error("Player info error")),
    });

    await expect(evaluateTradeTargetsHandler(client)).rejects.toThrow("Player info error");
  });
});

describe("getWaiverCandidatesHandler", () => {
  it("returns merged transactions and player info", async () => {
    const client = makeClient();
    const result = await getWaiverCandidatesHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("transactions");
    expect(parsed).toHaveProperty("playerInfo");
  });

  it("passes maxResults to getTransactions", async () => {
    const client = makeClient();
    await getWaiverCandidatesHandler(client, 20);

    expect(client.getTransactions).toHaveBeenCalledWith(20);
  });

  it("propagates error when getTransactions fails", async () => {
    const client = makeClient({
      getTransactions: vi.fn().mockRejectedValue(new Error("Transactions error")),
    });

    await expect(getWaiverCandidatesHandler(client)).rejects.toThrow("Transactions error");
  });
});

describe("comparePlayersHandler", () => {
  it("returns side-by-side data for two named players", async () => {
    const client = makeClient();
    const result = await comparePlayersHandler(client, "Shohei Ohtani", "Mike Trout");

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.player1.name).toBe("Shohei Ohtani");
    expect(parsed.player2.name).toBe("Mike Trout");
    expect(parsed.player1.data).toHaveLength(1);
    expect(parsed.player1.data[0].name).toBe("Shohei Ohtani");
    expect(parsed.player2.data[0].name).toBe("Mike Trout");
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
    const client = makeClient({
      getPlayerInfo: vi.fn().mockRejectedValue(new Error("Player info error")),
    });

    await expect(comparePlayersHandler(client, "Player A", "Player B")).rejects.toThrow(
      "Player info error",
    );
  });
});
