import { createMcpHandler } from "mcp-handler";
import { FantraxClient } from "../../../src/client";
import { registerAtomicTools } from "../../../src/tools/atomic";
import { registerCompositeTools } from "../../../src/tools/composite";

export const maxDuration = 60;

const client = new FantraxClient();

const handler = createMcpHandler(
  (server) => {
    registerAtomicTools(server, client);
    registerCompositeTools(server, client);
  },
  {},
  { basePath: "/api" },
);

export { handler as GET, handler as POST, handler as DELETE };
