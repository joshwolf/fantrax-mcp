import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FantraxClient } from "./client.js";
import { registerAtomicTools } from "./tools/atomic.js";
import { registerCompositeTools } from "./tools/composite.js";

const client = new FantraxClient();

const server = new McpServer({
  name: "fantrax-mcp",
  version: "1.0.0",
});

registerAtomicTools(server, client);
registerCompositeTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
