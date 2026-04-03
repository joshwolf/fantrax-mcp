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

Adjust `command`/`args` if you prefer `npx tsx src/mcp-stdio.ts` with `cwd` set to this repo.

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

## Development

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next.js dev server (remote MCP at `/api/mcp`) |
| `pnpm mcp:stdio` | Local stdio MCP server |
| `pnpm build` | Production build (`prebuild` regenerates player IDs) |
| `pnpm test` | Vitest |
| `pnpm typecheck` | `tsc --noEmit` |

## SDK version

This project depends on `@modelcontextprotocol/sdk`. `mcp-handler` recommends keeping the SDK updated (see their [README](https://github.com/vercel/mcp-handler)). Refresh the lockfile periodically with `pnpm update @modelcontextprotocol/sdk` if you want to stay aligned with their supported range.

## Further detail

See [2026-04-01-fantrax-mcp-design.md](./2026-04-01-fantrax-mcp-design.md) for architecture, tool list, and API notes.
