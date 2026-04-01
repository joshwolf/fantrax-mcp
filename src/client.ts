import type { FantraxPostPayload } from "./types.js";

const AUTH_BASE = "https://www.fantrax.com/fxpa/req";
const PUBLIC_BASE = "https://www.fantrax.com/fxea/general";

export class FantraxClient {
  private readonly sessionCookie: string;
  private readonly leagueId: string;

  constructor() {
    const sessionCookie = process.env.FANTRAX_SESSION_COOKIE;
    const leagueId = process.env.FANTRAX_LEAGUE_ID;

    if (!sessionCookie) {
      throw new Error("FANTRAX_SESSION_COOKIE env var is required");
    }
    if (!leagueId) {
      throw new Error("FANTRAX_LEAGUE_ID env var is required");
    }

    this.sessionCookie = sessionCookie;
    this.leagueId = leagueId;
  }

  private async post(method: string, data: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${AUTH_BASE}?leagueId=${this.leagueId}`;
    const body: FantraxPostPayload = { msgs: [{ method, data }] };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: this.sessionCookie,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fantrax API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${PUBLIC_BASE}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fantrax API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  async getLeagueInfo(): Promise<unknown> {
    return this.post("getFantasyLeagueInfo");
  }

  async getStandings(view?: string): Promise<unknown> {
    return this.post("getStandings", view ? { view } : {});
  }

  async getRoster(teamId: string, scoringPeriod?: number): Promise<unknown> {
    const data: Record<string, unknown> = { teamId };
    if (scoringPeriod !== undefined) data.scoringPeriod = scoringPeriod;
    return this.post("getTeamRosterInfo", data);
  }

  async getScoring(date?: string, period?: number): Promise<unknown> {
    const data: Record<string, unknown> = {};
    if (date !== undefined) data.date = date;
    if (period !== undefined) data.period = period;
    return this.post("getLiveScoringStats", data);
  }

  async getTransactions(maxResults?: number): Promise<{ pending: unknown; history: unknown }> {
    const data: Record<string, unknown> = {};
    if (maxResults !== undefined) data.maxResults = maxResults;

    const [pending, history] = await Promise.all([
      this.post("getPendingTransactions", data),
      this.post("getTransactionDetailsHistory", data),
    ]);

    return { pending, history };
  }

  async getTradeBlocks(): Promise<unknown> {
    return this.post("getTradeBlocks");
  }

  async getPlayerInfo(position?: string, limit?: number, order?: string): Promise<unknown> {
    const params: Record<string, string> = { sport: "MLB" };
    if (position !== undefined) params.position = position;
    if (limit !== undefined) params.limit = String(limit);
    if (order !== undefined) params.order = order;
    return this.get("getAdp", params);
  }

  async getPlayerIds(): Promise<unknown> {
    return this.get("getPlayerIds", { sport: "MLB" });
  }
}
