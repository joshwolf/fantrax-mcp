# Fantrax MCP Server — Design Spec

**Date:** 2026-04-01

## Context

The goal is a TypeScript MCP server that wraps the Fantrax fantasy baseball API, enabling Claude to read league data and assist with roster management decisions. Fantrax has no official public API or API key system — access is via session cookie and a mix of public GET endpoints and authenticated POST endpoints.

## Architecture

Three layers:

1. **`FantraxClient`** (`src/client.ts`) — all HTTP. Reads `FANTRAX_SESSION_COOKIE` and `FANTRAX_LEAGUE_ID` from env. Exposes one method per Fantrax API call. Pure data-fetching; no business logic.
2. **Tools layer** (`src/tools/atomic.ts`, `src/tools/composite.ts`) — MCP tool definitions and handlers. Atomic tools map 1:1 to client methods. Composite tools call multiple client methods and merge results.
3. **`index.ts`** — creates the MCP server, registers all tools, starts stdio transport.

```
fantrax-mcp/
├── src/
│   ├── index.ts              # Server entry, tool registration, stdio transport
│   ├── client.ts             # FantraxClient class
│   ├── tools/
│   │   ├── atomic.ts         # Atomic tool definitions + handlers
│   │   └── composite.ts      # Composite tool definitions + handlers
│   └── types.ts              # Shared TypeScript types
├── tests/
│   ├── client.test.ts
│   ├── atomic.test.ts
│   └── composite.test.ts
├── package.json
└── tsconfig.json
```

## API Details

**Base URLs:**
- Public (no auth): `https://www.fantrax.com/fxea/general/`
- Authenticated (POST): `https://www.fantrax.com/fxpa/req?leagueId={leagueId}`

**Authentication:** Session cookie (`FANTRAX_SESSION_COOKIE` env var) sent as `Cookie` header on all authenticated requests. The `FantraxClient` constructor throws if env vars are missing.

**Authenticated POST format:**
```json
{ "msgs": [{ "method": "methodName", "data": { ...params } }] }
```

**Sport:** MLB only (hardcoded — not a config option).

## Tools

### Atomic Tools (`src/tools/atomic.ts`)

| Tool | Fantrax Method | Auth | Parameters |
|---|---|---|---|
| `get_league_info` | `getFantasyLeagueInfo` | Yes | none |
| `get_standings` | `getStandings` | Yes | `view?: string` |
| `get_roster` | `getTeamRosterInfo` | Yes | `teamId: string`, `scoringPeriod?: number` |
| `get_scoring` | `getLiveScoringStats` | Yes | `date?: string`, `period?: number` |
| `get_transactions` | `getPendingTransactions` + `getTransactionDetailsHistory` | Yes | `maxResults?: number` |
| `get_trade_blocks` | `getTradeBlocks` | Yes | none |
| `get_player_info` | `GET /fxea/general/getAdp?sport=MLB` | No | `position?: string`, `limit?: number`, `order?: string` |
| `get_player_ids` | `GET /fxea/general/getPlayerIds?sport=MLB` | No | none |

### Composite Tools (`src/tools/composite.ts`)

| Tool | Calls | Purpose |
|---|---|---|
| `get_team_overview` | `get_roster` + `get_scoring` + `get_standings` | Full snapshot of a team's roster, recent scoring, and standings position |
| `evaluate_trade_targets` | `get_trade_blocks` + `get_player_info` | Trade block players enriched with ADP data |
| `get_waiver_candidates` | `get_transactions` + `get_player_info` | Pending waiver wire pickups enriched with ADP context |
| `compare_players` | `get_player_info` (x2, filtered by name) | Side-by-side ADP, position, and stats for two named players |

## KentonAI Standards Compliance

- **Named exports only** — no `export default` anywhere; no `index.ts` barrel/re-export files
- **Pure functions** — all data transformation functions are pure (no side effects, only use arguments); HTTP calls isolated in `FantraxClient`
- **Early returns** — all tool handlers guard on missing/invalid input before main logic
- **Low complexity** — functions ≤20 lines, ≤4 parameters, ≤3 nesting levels; single responsibility per function
- **Un-DRY tests** — one explicit `it()` per branch; no loops or conditional logic in test files; Arrange-Act-Assert structure throughout

## Authentication Flow

1. User copies `FX_SESS` cookie value from browser DevTools after logging into Fantrax
2. Sets `FANTRAX_SESSION_COOKIE=<value>` in their MCP server config (Claude Desktop / VS Code)
3. Sets `FANTRAX_LEAGUE_ID=<leagueId>` in the same config
4. `FantraxClient` constructor reads both; throws `Error` with clear message if either is missing

## Error Handling

- Missing env vars → throw at startup (fail fast)
- HTTP errors → throw with status code and Fantrax response body
- Tool handlers use early returns to validate inputs before calling the client
- No silent failures; all errors propagate to MCP caller

## Testing Strategy

- **`client.test.ts`** — mock `fetch`; test each client method returns expected shape; test auth header is set; test error cases
- **`atomic.test.ts`** — mock `FantraxClient`; test each tool handler with valid input, missing input, and error from client
- **`composite.test.ts`** — mock `FantraxClient`; test each composite merges data correctly; test partial failure cases

## Verification

1. `npm run build` — TypeScript compiles with no errors
2. Set `FANTRAX_SESSION_COOKIE` and `FANTRAX_LEAGUE_ID` in environment
3. Run server locally: `node dist/index.js`
4. Connect via Claude Desktop MCP config; call `get_league_info` — should return league name and teams
5. Call `get_standings` — should return ordered team list
6. Call `compare_players` with two MLB player names — should return side-by-side ADP
7. `npm test` — all tests pass
