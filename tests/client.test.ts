import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FantraxClient } from "../src/client.js";

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  }) as unknown as typeof fetch;
}

function makeFetchError(status: number, body: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.stubEnv("FANTRAX_SESSION_COOKIE", "test-cookie");
  vi.stubEnv("FANTRAX_LEAGUE_ID", "test-league");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("FantraxClient constructor", () => {
  it("throws if FANTRAX_SESSION_COOKIE is missing", () => {
    vi.stubEnv("FANTRAX_SESSION_COOKIE", "");
    expect(() => new FantraxClient()).toThrow("FANTRAX_SESSION_COOKIE");
  });

  it("throws if FANTRAX_LEAGUE_ID is missing", () => {
    vi.stubEnv("FANTRAX_LEAGUE_ID", "");
    expect(() => new FantraxClient()).toThrow("FANTRAX_LEAGUE_ID");
  });

  it("constructs successfully when both env vars are set", () => {
    expect(() => new FantraxClient()).not.toThrow();
  });
});

describe("FantraxClient.getLeagueInfo", () => {
  it("POSTs to the correct URL with Cookie header", async () => {
    const mockFetch = makeFetchOk({ league: "test" });
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getLeagueInfo();

    const [url, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://www.fantrax.com/fxpa/req?leagueId=test-league");
    expect((options.headers as Record<string, string>)["Cookie"]).toBe("test-cookie");
  });

  it("sends the getFantasyLeagueInfo method in the POST body", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getLeagueInfo();

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].method).toBe("getFantasyLeagueInfo");
  });

  it("returns the parsed JSON response", async () => {
    vi.stubGlobal("fetch", makeFetchOk({ data: "leagueData" }));
    const client = new FantraxClient();
    const result = await client.getLeagueInfo();
    expect(result).toEqual({ data: "leagueData" });
  });

  it("throws with status code on HTTP error", async () => {
    vi.stubGlobal("fetch", makeFetchError(401, "Unauthorized"));
    const client = new FantraxClient();
    await expect(client.getLeagueInfo()).rejects.toThrow("401");
  });
});

describe("FantraxClient.getStandings", () => {
  it("sends getStandings method without view param by default", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getStandings();

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].method).toBe("getStandings");
    expect(body.msgs[0].data).toEqual({});
  });

  it("includes view in data when provided", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getStandings("overall");

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].data.view).toBe("overall");
  });
});

describe("FantraxClient.getRoster", () => {
  it("sends getTeamRosterInfo with teamId", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getRoster("team-123");

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].method).toBe("getTeamRosterInfo");
    expect(body.msgs[0].data.teamId).toBe("team-123");
  });

  it("includes scoringPeriod when provided", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getRoster("team-123", 5);

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].data.scoringPeriod).toBe(5);
  });
});

describe("FantraxClient.getScoring", () => {
  it("sends getLiveScoringStats with no params by default", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getScoring();

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].method).toBe("getLiveScoringStats");
    expect(body.msgs[0].data).toEqual({});
  });

  it("includes date and period when provided", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getScoring("20260401", 3);

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].data.date).toBe("20260401");
    expect(body.msgs[0].data.period).toBe(3);
  });
});

describe("FantraxClient.getTransactions", () => {
  it("calls both getPendingTransactions and getTransactionDetailsHistory", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getTransactions();

    const calls = (mockFetch as ReturnType<typeof vi.fn>).mock.calls as Array<[string, RequestInit]>;
    const methods = calls.map((c) => JSON.parse(c[1].body as string).msgs[0].method);
    expect(methods).toContain("getPendingTransactions");
    expect(methods).toContain("getTransactionDetailsHistory");
  });

  it("returns pending and history keyed separately", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ pending: true }), text: () => Promise.resolve("") })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ history: true }), text: () => Promise.resolve("") });
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    const result = await client.getTransactions();

    expect(result).toHaveProperty("pending");
    expect(result).toHaveProperty("history");
  });
});

describe("FantraxClient.getPlayerInfo", () => {
  it("GETs from the public base URL with sport=MLB", async () => {
    const mockFetch = makeFetchOk([]);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getPlayerInfo();

    const [url] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("fantrax.com/fxea/general/getAdp");
    expect(url).toContain("sport=MLB");
  });

  it("includes position, limit, and order params when provided", async () => {
    const mockFetch = makeFetchOk([]);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getPlayerInfo("SP", 50, "adp");

    const [url] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("position=SP");
    expect(url).toContain("limit=50");
    expect(url).toContain("order=adp");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", makeFetchError(500, "Server Error"));
    const client = new FantraxClient();
    await expect(client.getPlayerInfo()).rejects.toThrow("500");
  });
});

describe("FantraxClient.getPlayerIds", () => {
  it("GETs from the public base URL with sport=MLB", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getPlayerIds();

    const [url] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("fantrax.com/fxea/general/getPlayerIds");
    expect(url).toContain("sport=MLB");
  });
});

describe("FantraxClient.getTradeBlocks", () => {
  it("sends getTradeBlocks method", async () => {
    const mockFetch = makeFetchOk({});
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getTradeBlocks();

    const [, options] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string);
    expect(body.msgs[0].method).toBe("getTradeBlocks");
  });
});
