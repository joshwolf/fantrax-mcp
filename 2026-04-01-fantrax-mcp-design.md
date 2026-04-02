# Fantrax MCP Server — Design Spec

**Date:** 2026-04-01 (updated 2026-04-02)

## Context

A TypeScript MCP server that wraps the Fantrax fantasy baseball API, enabling Claude to read league data and assist with roster management decisions. Fantrax has no official public API — all endpoints used here are public GET endpoints (no authentication required).

## Architecture

Three layers:

1. **`FantraxClient`** (`src/client.ts`) — all HTTP. Reads `FANTRAX_LEAGUE_ID` from env. Exposes one method per Fantrax API call. Pure data-fetching; no business logic.
2. **Tools layer** (`src/tools/atomic.ts`, `src/tools/composite.ts`) — MCP tool definitions and handlers. Atomic tools map 1:1 to client methods. Composite tools call multiple client methods and merge results.
3. **`app/api/[transport]/route.ts`** — Next.js API route that creates the MCP server, registers all tools, and serves via the `mcp-handler` transport (HTTP SSE + POST).

```
fantrax-mcp/
├── app/
│   └── api/
│       └── [transport]/
│           └── route.ts       # MCP HTTP handler (Vercel/Next.js)
├── src/
│   ├── client.ts              # FantraxClient class
│   ├── tools/
│   │   ├── atomic.ts          # Atomic tool definitions + handlers
│   │   └── composite.ts       # Composite tool definitions + handlers
│   └── types.ts               # Shared TypeScript types and Zod schemas
├── scripts/
│   └── generate-player-ids.ts # Build-time script: fetches player IDs, writes src/player-ids.json
├── tests/
│   ├── client.test.ts
│   ├── atomic.test.ts
│   └── composite.test.ts
└── package.json
```

## API Details

**Base URL:** `https://www.fantrax.com/fxea/general/`

All endpoints are public GET requests — no authentication, no session cookie required.

**Sport:** MLB only (hardcoded — not a config option).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FANTRAX_LEAGUE_ID` | Yes | Fantrax league ID (found in the league URL) |

The server is **league-scoped, not user-scoped**. Multiple league members can share one deployment. Each caller supplies their own `teamId` as a tool parameter when needed.

## Tools

### Atomic Tools (`src/tools/atomic.ts`)

| Tool | Client Method | Parameters | Purpose |
|---|---|---|---|
| `get_league_info` | `getLeagueInfo` | none | Full league info including teams, roster settings, player statuses |
| `get_league_summary` | `getLeagueInfo` | none | Lightweight: name, season, dates, roster settings — no playerInfo map |
| `get_standings` | `getStandings` | none | Current standings with rank, points, win% per team |
| `list_teams` | `getStandings` | none | Lightweight: teamId, teamName, rank only |
| `get_all_rosters` | `getAllRosters` | none | Every team's roster with player IDs, positions, salaries |
| `get_team_roster` | `getTeamRoster` | `teamId: string` | Single team's roster — avoids sending all 13 when one is needed |
| `get_free_agents` | `getFreeAgents` | none | All available free agents with name, MLB team, position |
| `get_player_info` | `getPlayerInfo` | `position?: string`, `limit?: number`, `order?: string` | MLB player ADP data |
| `get_scoring_categories` | `getScoringCategories` | none | League scoring categories (R, HR, OBP, TB, SB, K, ERA, WHIP, etc.) |

### Composite Tools (`src/tools/composite.ts`)

| Tool | Calls | Purpose |
|---|---|---|
| `get_team_overview` | `getAllRosters` + `getStandings` + `getScoringCategories` | Roster + standings position + scoring categories for one team |
| `get_enriched_rosters` | `getAllRosters` + `getPlayerInfo` | All rosters enriched with player names and ADP |
| `get_waiver_candidates` | `getFreeAgents` + `getPlayerInfo` + `getScoringCategories` | Free agents joined with ADP, ranked by ADP, with scoring context |
| `find_trade_targets` | `getAllRosters` + `getPlayerInfo` + `getStandings` | Trade targets by position, with optional team/status filters |
| `compare_players` | `getPlayerInfo` | Side-by-side ADP and position for two named players |

## `player-ids.json`

`src/player-ids.json` maps Fantrax player IDs to names, teams, and positions. It is **generated at build time** by `scripts/generate-player-ids.ts` (run via the `prebuild` npm script) and is not committed to version control.

To regenerate locally: `pnpm generate-player-ids`

## Error Handling

- Missing `FANTRAX_LEAGUE_ID` → throws on first API call (fail fast)
- HTTP errors → throws with status code and Fantrax response body
- Invalid API response shapes → Zod parse errors returned as tool error strings (not thrown)
- All errors propagate clearly to MCP caller

## Running the Server

**Development:** `pnpm dev` — starts Next.js dev server; MCP endpoint at `/api/mcp`

**Production:** Deploy to Vercel. The MCP endpoint is the Next.js API route at `/api/[transport]`.

**Connect via Cursor/Claude Desktop:** Point your MCP config at the deployed URL or `http://localhost:3000/api` for local dev.

## Testing

- **`client.test.ts`** — mock `fetch`; test each client method returns expected shape; test error cases
- **`atomic.test.ts`** — mock `FantraxClient`; test each tool handler with valid input, missing input, and error from client
- **`composite.test.ts`** — mock `FantraxClient`; test each composite merges data correctly; test Zod validation errors; test partial failure cases

Run: `pnpm test`
