#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerInitTool, tryInitFromArgs } from "./tools/init.tool.js";
import { registerConnectionTools } from "./tools/connection.tool.js";
import { shutdownAll } from "./usecases/manageConnection.js";
import { closeDb } from "./infrastructure/database/local.js";

const server = new McpServer({
  name: "database-mcp",
  version: "0.1.0",
});

registerInitTool(server);
registerConnectionTools(server);

async function gracefulShutdown(signal: string): Promise<void> {
  console.error(`[database-mcp] ${signal} received, shutting down...`);
  try {
    await shutdownAll();
    closeDb();
  } catch (error) {
    console.error("[database-mcp] Error during shutdown:", error);
  }
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function main() {
  // Try to auto-initialize from --project-path argument
  tryInitFromArgs(process.argv);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[database-mcp] Server ready, listening on stdio");
}

main().catch(console.error);
