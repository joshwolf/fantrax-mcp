import { createMcpHandler } from "mcp-handler";
import { FantraxClient } from "../../../src/client.js";
import { registerAtomicTools } from "../../../src/tools/atomic.js";
import { registerCompositeTools } from "../../../src/tools/composite.js";

const client = new FantraxClient();

const handler = createMcpHandler((server) => {
  registerAtomicTools(server, client);
  registerCompositeTools(server, client);
});

export { handler as GET, handler as POST, handler as DELETE };
