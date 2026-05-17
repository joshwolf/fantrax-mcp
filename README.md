# fantrax-mcp

MCP server for [Fantrax](https://www.fantrax.com/) fantasy baseball. It exposes tools to read league info, rosters, standings, free agents, and related data. The server is **league-scoped**: set one Fantrax league ID per deployment or local process.

## Requirements

- Node.js 18+
- [pnpm](https://pnpm.io/) (or use `npx` / `npm` equivalents)

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `FANTRAX_LEAGUE_ID` | Yes | Fantrax league ID (from the league URL) |

The app does not load `.env` automatically for the stdio entrypoint; set variables in your shell or in your MCP client config (`env`).

## MCP tools

All tools use the league configured by `FANTRAX_LEAGUE_ID`. **Atomic** tools map roughly one-to-one to Fantrax data; **composite** tools combine several calls for common workflows.

### Atomic

| Tool | Description |
|------|-------------|
| `get_league_info` | Full league info: teams, roster settings, player statuses. Prefer `get_league_summary` when you only need high-level details. |
| `get_league_summary` | Lightweight league info: name, season year, start/end dates, roster and draft settings. |
| `get_standings` | Standings: rank, points, and win percentage per team. |
| `list_teams` | All teams with `teamId`, `teamName`, and rank — use before tools that require a team ID. |
| `get_all_rosters` | Every team’s roster (player IDs, positions, salary). Prefer `get_team_roster` for a single team. |
| `get_team_roster` | One team’s roster (`teamId`). |
| `get_free_agents` | Free agents with name, MLB team, position, and eligible fantasy positions. |
| `get_player_info` | MLB player ADP-style data for ranking and valuation. Optional: `position`, `limit`, `order`. |
| `get_scoring_categories` | Stats that count in this league — use when comparing or recommending players. |

### Composite

| Tool | Description |
|------|-------------|
| `get_enriched_rosters` | All rosters enriched with player names and ADP. |
| `find_trade_targets` | Trade targets by position and max ADP (`teamId`, `position`, `maxAdp`; optional status exclusions and whether to search all teams vs bottom half). |
| `get_team_overview` | One team’s roster, standings position, and league scoring categories (`teamId`). |
| `get_waiver_candidates` | Free agents ranked by ADP, with scoring categories — for add/drop decisions. |
| `compare_players` | Side-by-side comparison for two players by name, with league scoring context. |

## Run locally (stdio MCP)

Use this when your client spawns a subprocess and talks MCP over stdin/stdout (e.g. Cursor, Claude Desktop).

From the repo root:

```bash
pnpm install
export FANTRAX_LEAGUE_ID=your-league-id
pnpm mcp:stdio
```

**Cursor** (`~/.cursor/mcp.json` or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "fantrax": {
      "command": "pnpm",
      "args": ["mcp:stdio"],
      "cwd": "/absolute/path/to/fantrax-mcp",
      "env": {
        "FANTRAX_LEAGUE_ID": "your-league-id"
      }
    }
  }
}
```

Prefer the example above: it runs the lockfile-pinned `tsx` from this repo. Using `npx tsx …` for the local server works after `pnpm install`, but `npx` adds resolver/caching overhead on each spawn compared to `pnpm mcp:stdio` or `pnpm exec tsx src/mcp-stdio.ts`. If you use npm, `npm run mcp:stdio` with the same `cwd` is the analogous choice.

**Important:** Do not log to stdout in the stdio server; MCP uses stdout for the protocol.

## Run remotely (HTTP MCP)

This repo is a **Next.js** app. The MCP endpoint is served by [`mcp-handler`](https://github.com/vercel/mcp-handler) at:

`https://<your-host>/api/mcp`

Examples:

- Local dev: `http://localhost:3000/api/mcp` (after `pnpm dev`)
- Production: `https://<project>.vercel.app/api/mcp` (or your custom domain)

Clients that support **Streamable HTTP** can use the URL directly, for example:

```json
{
  "mcpServers": {
    "fantrax-remote": {
      "url": "https://your-deployment.vercel.app/api/mcp"
    }
  }
}
```

If your client only supports stdio, proxy the remote server with [mcp-remote](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "fantrax-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-deployment.vercel.app/api/mcp"]
    }
  }
}
```

## Deploy to Vercel

1. Push this repository to GitHub (or another supported Git provider).
2. In the [Vercel dashboard](https://vercel.com/new), import the project and select the Next.js preset.
3. Under **Settings → Environment Variables**, add `FANTRAX_LEAGUE_ID` for **Production** (and Preview if you want preview deployments to work).
4. Deploy. The build runs `prebuild`, which generates `src/player-ids.json` via `scripts/generate-player-ids.ts`.

Official reference: [Deploying Next.js to Vercel](https://vercel.com/docs/frameworks/nextjs).

### Scheduled rebuilds

Production is redeployed automatically every **Monday and Thursday** at approximately **6:00 AM Eastern** via [`.github/workflows/scheduled-rebuild.yml`](.github/workflows/scheduled-rebuild.yml). The workflow POSTs to a Vercel Deploy Hook, which runs a full build (including `prebuild` player ID refresh).

**One-time setup:**

1. In Vercel: **Settings → Git → Deploy Hooks** — create a hook named e.g. `scheduled-production-rebuild` on branch `main` for **Production**.
2. In GitHub: **Settings → Secrets and variables → Actions** — add `VERCEL_DEPLOY_HOOK_URL` with the hook URL.

**Manual trigger:** Actions → **Scheduled production rebuild** → **Run workflow**.

**Timezone note:** GitHub cron uses UTC only (no DST). The schedule `0 11 * * 1,4` runs at 6:00 AM EST and 7:00 AM EDT. To target 6:00 AM during daylight saving instead, change the cron to `0 10 * * 1,4` (5:00 AM in winter).

## Player data at build time

`pnpm build` runs **`prebuild`** first (`package.json`), which executes `scripts/generate-player-ids.ts`. That script **fetches** the MLB player ID catalogue from Fantrax’s public `getPlayerIds` API over HTTPS and writes `src/player-ids.json`. The build host must allow outbound network access; if the fetch fails, the build exits with an error. This step does **not** use `FANTRAX_LEAGUE_ID` (that variable is only for runtime MCP requests against your league).

## Development

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next.js dev server (remote MCP at `/api/mcp`) |
| `pnpm mcp:stdio` | Local stdio MCP server |
| `pnpm build` | Production build (`prebuild` regenerates player IDs) |
| `pnpm test` | Vitest |
| `pnpm typecheck` | `tsc --noEmit` |
