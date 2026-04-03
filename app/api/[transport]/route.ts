import { createMcpHandler } from "mcp-handler";
import { FantraxClient } from "../../../src/client";
import { registerFantraxTools } from "../../../src/register-fantrax-tools";

export const maxDuration = 60;

const client = new FantraxClient();

const handler = createMcpHandler(
  (server) => {
    registerFantraxTools(server, client);
  },
  {},
  { basePath: "/api" },
);

export { handler as GET, handler as POST, handler as DELETE };
