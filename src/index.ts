#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerInitTool, tryInitFromArgs } from "./tools/init.tool.js";
import { registerConnectionTools } from "./tools/connection.tool.js";

const server = new McpServer({
  name: "database-mcp",
  version: "0.1.0",
});

registerInitTool(server);
registerConnectionTools(server);

async function main() {
  // Try to auto-initialize from --project-path argument
  tryInitFromArgs(process.argv);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[database-mcp] Server ready, listening on stdio");
}

main().catch(console.error);
