import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" assert { type: "json" };
import { FantraxClient } from "./client";
import { registerFantraxTools } from "./register-fantrax-tools";

async function main(): Promise<void> {
  const client = new FantraxClient();
  const server = new McpServer({
    name: "fantrax-mcp",
    version: packageJson.version,
  });
  registerFantraxTools(server, client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
