import playerIds from "./player-ids.json" assert { type: "json" };

const PUBLIC_BASE = "https://www.fantrax.com/fxea/general";

export class FantraxClient {
  private readonly leagueId: string;

  constructor() {
    this.leagueId = process.env.FANTRAX_LEAGUE_ID || "missing-league-id";
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    if (this.leagueId === "missing-league-id") {
      throw new Error("FANTRAX_LEAGUE_ID env var is required");
    }
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
    return this.get("getLeagueInfo", { leagueId: this.leagueId });
  }

  async getStandings(): Promise<unknown> {
    return this.get("getStandings", { leagueId: this.leagueId });
  }

  async getAllRosters(): Promise<unknown> {
    return this.get("getTeamRosters", { leagueId: this.leagueId });
  }

  async getPlayerInfo(position?: string, limit?: number, order?: string): Promise<unknown> {
    const params: Record<string, string> = { sport: "MLB" };
    if (position !== undefined) params.position = position;
    if (limit !== undefined) params.limit = String(limit);
    if (order !== undefined) params.order = order;
    return this.get("getAdp", params);
  }

  async getFreeAgents(): Promise<unknown> {
    const leagueInfoData = await this.getLeagueInfo();

    const leagueInfo = leagueInfoData as {
      playerInfo: Record<string, { status: string; eligiblePos: string }>;
    };
    const players = playerIds as unknown as Record<string, {
      name: string;
      team?: string;
      position: string;
    }>;

    return Object.entries(leagueInfo.playerInfo)
      .filter(([, p]) => p.status === "FA")
      .flatMap(([id, p]) => {
        const player = players[id];
        if (!player) return [];
        return [{ id, name: player.name, team: player.team ?? null, position: player.position, eligiblePositions: p.eligiblePos }];
      });
  }

  async getScoringCategories(): Promise<unknown> {
    const data = await this.getLeagueInfo() as Record<string, unknown>;
    const scoringSystem = (data.scoringSystem ?? {}) as Record<string, unknown>;
    return scoringSystem.scoringCategories ?? {};
  }
}
