import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FantraxClient } from "./client";
import { registerAtomicTools } from "./tools/atomic";
import { registerCompositeTools } from "./tools/composite";

export function registerFantraxTools(server: McpServer, client: FantraxClient): void {
  registerAtomicTools(server, client);
  registerCompositeTools(server, client);
}
