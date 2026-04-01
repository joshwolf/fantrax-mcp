import { describe, it, expect, vi } from "vitest";
import {
  getLeagueInfoHandler,
  getStandingsHandler,
  getRosterHandler,
  getScoringHandler,
  getTransactionsHandler,
  getTradeBlocksHandler,
  getPlayerInfoHandler,
  getPlayerIdsHandler,
} from "../src/tools/atomic.js";
import type { FantraxClient } from "../src/client.js";

function makeClient(overrides: Partial<Record<keyof FantraxClient, unknown>> = {}): FantraxClient {
  return {
    getLeagueInfo: vi.fn().mockResolvedValue({ league: "test" }),
    getStandings: vi.fn().mockResolvedValue({ standings: [] }),
    getRoster: vi.fn().mockResolvedValue({ roster: [] }),
    getScoring: vi.fn().mockResolvedValue({ scoring: [] }),
    getTransactions: vi.fn().mockResolvedValue({ pending: [], history: [] }),
    getTradeBlocks: vi.fn().mockResolvedValue({ blocks: [] }),
    getPlayerInfo: vi.fn().mockResolvedValue([{ name: "Player A" }]),
    getPlayerIds: vi.fn().mockResolvedValue({ ids: [] }),
    ...overrides,
  } as unknown as FantraxClient;
}

describe("getLeagueInfoHandler", () => {
  it("returns league info as JSON text content", async () => {
    const client = makeClient();
    const result = await getLeagueInfoHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ league: "test" });
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getLeagueInfo: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getLeagueInfoHandler(client)).rejects.toThrow("API error");
  });
});

describe("getStandingsHandler", () => {
  it("returns standings as JSON text content", async () => {
    const client = makeClient();
    const result = await getStandingsHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ standings: [] });
  });

  it("passes view param to the client", async () => {
    const client = makeClient();
    await getStandingsHandler(client, "overall");

    expect(client.getStandings).toHaveBeenCalledWith("overall");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getStandings: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getStandingsHandler(client)).rejects.toThrow("API error");
  });
});

describe("getRosterHandler", () => {
  it("returns roster data as JSON text content", async () => {
    const client = makeClient();
    const result = await getRosterHandler(client, "team-1");

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ roster: [] });
  });

  it("passes teamId and scoringPeriod to the client", async () => {
    const client = makeClient();
    await getRosterHandler(client, "team-1", 3);

    expect(client.getRoster).toHaveBeenCalledWith("team-1", 3);
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getRoster: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getRosterHandler(client, "team-1")).rejects.toThrow("API error");
  });
});

describe("getScoringHandler", () => {
  it("returns scoring data as JSON text content", async () => {
    const client = makeClient();
    const result = await getScoringHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ scoring: [] });
  });

  it("passes date and period to the client", async () => {
    const client = makeClient();
    await getScoringHandler(client, "20260401", 2);

    expect(client.getScoring).toHaveBeenCalledWith("20260401", 2);
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getScoring: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getScoringHandler(client)).rejects.toThrow("API error");
  });
});

describe("getTransactionsHandler", () => {
  it("returns transactions as JSON text content", async () => {
    const client = makeClient();
    const result = await getTransactionsHandler(client);

    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("pending");
    expect(parsed).toHaveProperty("history");
  });

  it("passes maxResults to the client", async () => {
    const client = makeClient();
    await getTransactionsHandler(client, 10);

    expect(client.getTransactions).toHaveBeenCalledWith(10);
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getTransactions: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getTransactionsHandler(client)).rejects.toThrow("API error");
  });
});

describe("getTradeBlocksHandler", () => {
  it("returns trade blocks as JSON text content", async () => {
    const client = makeClient();
    const result = await getTradeBlocksHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ blocks: [] });
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getTradeBlocks: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getTradeBlocksHandler(client)).rejects.toThrow("API error");
  });
});

describe("getPlayerInfoHandler", () => {
  it("returns player info as JSON text content", async () => {
    const client = makeClient();
    const result = await getPlayerInfoHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual([{ name: "Player A" }]);
  });

  it("passes position, limit, and order to the client", async () => {
    const client = makeClient();
    await getPlayerInfoHandler(client, "SP", 25, "adp");

    expect(client.getPlayerInfo).toHaveBeenCalledWith("SP", 25, "adp");
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getPlayerInfo: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getPlayerInfoHandler(client)).rejects.toThrow("API error");
  });
});

describe("getPlayerIdsHandler", () => {
  it("returns player IDs as JSON text content", async () => {
    const client = makeClient();
    const result = await getPlayerIdsHandler(client);

    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ ids: [] });
  });

  it("propagates errors from the client", async () => {
    const client = makeClient({
      getPlayerIds: vi.fn().mockRejectedValue(new Error("API error")),
    });

    await expect(getPlayerIdsHandler(client)).rejects.toThrow("API error");
  });
});
