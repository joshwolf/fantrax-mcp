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
  vi.stubEnv("FANTRAX_LEAGUE_ID", "test-league");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("FantraxClient constructor", () => {
  it("throws if FANTRAX_LEAGUE_ID is missing", () => {
    vi.stubEnv("FANTRAX_LEAGUE_ID", "");
    expect(() => new FantraxClient()).toThrow("FANTRAX_LEAGUE_ID");
  });

  it("constructs successfully when env var is set", () => {
    expect(() => new FantraxClient()).not.toThrow();
  });
});

describe("FantraxClient.getLeagueInfo", () => {
  it("GETs from the official public API with leagueId", async () => {
    const mockFetch = makeFetchOk({ leagueName: "test" });
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getLeagueInfo();

    const [url] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("fantrax.com/fxea/general/getLeagueInfo");
    expect(url).toContain("leagueId=test-league");
  });

  it("returns the parsed JSON response", async () => {
    vi.stubGlobal("fetch", makeFetchOk({ leagueName: "My League" }));
    const client = new FantraxClient();
    const result = await client.getLeagueInfo();
    expect(result).toEqual({ leagueName: "My League" });
  });

  it("throws with status code on HTTP error", async () => {
    vi.stubGlobal("fetch", makeFetchError(404, "Not Found"));
    const client = new FantraxClient();
    await expect(client.getLeagueInfo()).rejects.toThrow("404");
  });
});

describe("FantraxClient.getStandings", () => {
  it("GETs from the official public API with leagueId", async () => {
    const mockFetch = makeFetchOk([]);
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getStandings();

    const [url] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("fantrax.com/fxea/general/getStandings");
    expect(url).toContain("leagueId=test-league");
  });
});

describe("FantraxClient.getAllRosters", () => {
  it("GETs from the official public API with leagueId", async () => {
    const mockFetch = makeFetchOk({ rosters: {} });
    vi.stubGlobal("fetch", mockFetch);

    const client = new FantraxClient();
    await client.getAllRosters();

    const [url] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("fantrax.com/fxea/general/getTeamRosters");
    expect(url).toContain("leagueId=test-league");
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

describe("FantraxClient.getFreeAgents", () => {
  const mockLeagueInfo = {
    playerInfo: {
      "id-001": { status: "FA", eligiblePos: "OF,UT" },
      "id-002": { status: "T", eligiblePos: "SP" },
      "id-003": { status: "FA", eligiblePos: "1B,UT" },
      "id-004": { status: "FA", eligiblePos: "SS,MI" },
    },
  };

  const mockPlayerIds = {
    "id-001": { name: "Player, Alpha", team: "NYY", position: "OF" },
    "id-003": { name: "Player, Beta", team: "LAD", position: "1B" },
    // id-004 intentionally missing from playerIds (no name data)
  };

  it("returns only players with FA status that exist in playerIds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockLeagueInfo), text: () => Promise.resolve("") })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPlayerIds), text: () => Promise.resolve("") }),
    );

    const client = new FantraxClient();
    const result = await client.getFreeAgents() as Array<Record<string, string>>;

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toContain("id-001");
    expect(result.map((p) => p.id)).toContain("id-003");
    expect(result.map((p) => p.id)).not.toContain("id-002");
  });

  it("includes name, team, position, and eligiblePositions for each FA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockLeagueInfo), text: () => Promise.resolve("") })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPlayerIds), text: () => Promise.resolve("") }),
    );

    const client = new FantraxClient();
    const result = await client.getFreeAgents() as Array<Record<string, string>>;
    const alpha = result.find((p) => p.id === "id-001");

    expect(alpha?.name).toBe("Player, Alpha");
    expect(alpha?.team).toBe("NYY");
    expect(alpha?.position).toBe("OF");
    expect(alpha?.eligiblePositions).toBe("OF,UT");
  });

  it("excludes FA players with no matching entry in playerIds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockLeagueInfo), text: () => Promise.resolve("") })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPlayerIds), text: () => Promise.resolve("") }),
    );

    const client = new FantraxClient();
    const result = await client.getFreeAgents() as Array<Record<string, string>>;

    expect(result.map((p) => p.id)).not.toContain("id-004");
  });
});

describe("FantraxClient.getScoringCategories", () => {
  it("extracts scoringCategories from leagueInfo scoringSystem", async () => {
    const mockLeagueInfo = {
      scoringSystem: {
        scoringCategories: {
          HITTING: { HR: { Default: "1.0" }, R: { Default: "1.0" } },
          PITCHING: { K: { Default: "1.0" } },
        },
      },
    };

    vi.stubGlobal("fetch", makeFetchOk(mockLeagueInfo));
    const client = new FantraxClient();
    const result = await client.getScoringCategories() as Record<string, unknown>;

    expect(result).toHaveProperty("HITTING");
    expect(result).toHaveProperty("PITCHING");
    expect(result).not.toHaveProperty("scoringSystem");
  });

  it("returns empty object when scoringSystem is absent", async () => {
    vi.stubGlobal("fetch", makeFetchOk({}));
    const client = new FantraxClient();
    const result = await client.getScoringCategories();
    expect(result).toEqual({});
  });
});
