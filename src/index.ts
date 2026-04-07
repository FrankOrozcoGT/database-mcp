#!/usr/bin/env node
import { appendFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const LOG_FILE = "/tmp/database-mcp.log";
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(LOG_FILE, line);
  console.error(line.trim());
}
import { registerInitTool, tryInitFromArgs } from "./tools/init.tool.js";
import { registerConnectionTools } from "./tools/connection.tool.js";
import { registerQueryTools } from "./tools/query.tool.js";
import { registerSchemaTools } from "./tools/schema.tool.js";
import { closeDb, runMigrations } from "./infrastructure/database/local.js";
import { setNotifier } from "./domain/services/notifier.js";
import { socketNotifier, connect, disconnect } from "./infrastructure/websocket/client.js";
import { syncActiveConnections } from "./infrastructure/ipc/client.js";

const server = new McpServer({
  name: "database-mcp",
  version: "0.1.0",
});

registerInitTool(server);
registerConnectionTools(server);
registerQueryTools(server);
registerSchemaTools(server);

async function gracefulShutdown(signal: string): Promise<void> {
  log(`${signal} received, shutting down...`);
  try {
    // Don't kill daemon — connections persist
    await disconnect();
    closeDb();
  } catch (error) {
    log(`Error during shutdown: ${error}`);
  }
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function main() {
  log("Starting database-mcp...");
  log(`Args: ${process.argv.join(" ")}`);

  await runMigrations();
  log("Migrations done");

  // Try to auto-initialize from --project-path argument
  tryInitFromArgs(process.argv);
  log("Init from args done");

  // Connect to wrapper via Socket.IO and inject notifier
  const wsUrl = process.env.MCP_WS_URL || "http://localhost:3050";
  setNotifier(socketNotifier);
  connect(wsUrl, "/mcp");
  log(`Socket.IO connecting to ${wsUrl}/mcp`);

  // Sync active daemon connections to wrapper
  try {
    const active = await syncActiveConnections();
    for (const conn of active) {
      socketNotifier.emit("connection:status", { type: "display", connId: conn.connId, status: conn.status });
    }
    if (active.length > 0) {
      log(`Synced ${active.length} active connections to wrapper`);
    }
  } catch {
    log("Daemon not available yet, will auto-spawn on first use");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server ready, listening on stdio");
}

main().catch((err) => {
  log(`FATAL: ${err}`);
  console.error(err);
});
