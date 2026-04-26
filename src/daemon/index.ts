#!/usr/bin/env node
import { createServer, Socket } from "net";
import { existsSync, unlinkSync, mkdirSync, appendFileSync } from "fs";
import { dirname } from "path";
import { getPlatform } from "../infrastructure/platform/index.js";
import { DaemonRequest, DaemonResponse } from "./protocol.js";
import {
  handleConnect,
  handleDisconnect,
  handleExecute,
  handleGetSchema,
  handleStatus,
  handleStatusAll,
  handleShutdown,
} from "./handlers.js";

const LOG_FILE = "/tmp/database-mcp-daemon.log";

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(LOG_FILE, line);
}

function getProjectId(): string {
  const idx = process.argv.indexOf("--project-id");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : "default";
}

function getSocketPath(): string {
  const platform = getPlatform();
  const projectId = getProjectId();
  if (platform.osType === "windows") {
    return `\\\\.\\pipe\\database-mcp-daemon-${projectId}`;
  }
  const dataDir = platform.dataDir("database-mcp");
  mkdirSync(dataDir, { recursive: true });
  return `${dataDir}/daemon-${projectId}.sock`;
}

function cleanupStaleSocket(socketPath: string): void {
  if (socketPath.startsWith("\\\\.\\pipe\\")) return; // Named pipes don't leave stale files
  if (existsSync(socketPath)) {
    log(`Cleaning up stale socket: ${socketPath}`);
    unlinkSync(socketPath);
  }
}

async function handleRequest(request: DaemonRequest): Promise<DaemonResponse> {
  switch (request.action) {
    case "connect":
      return handleConnect(request.payload);
    case "disconnect":
      return handleDisconnect(request.payload);
    case "execute":
      return handleExecute(request.payload);
    case "getSchema":
      return handleGetSchema(request.payload);
    case "status":
      return handleStatus(request.payload);
    case "statusAll":
      return handleStatusAll();
    case "shutdown":
      return handleShutdown();
    default:
      return { ok: false, error: `Unknown action: ${(request as { action: string }).action}` };
  }
}

function handleConnection(socket: Socket): void {
  let buffer = "";

  socket.on("data", async (chunk) => {
    buffer += chunk.toString();

    // Process complete JSON lines
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      let response: DaemonResponse;
      try {
        const request: DaemonRequest = JSON.parse(line);
        log(`Request: ${request.action}`);
        response = await handleRequest(request);
      } catch (error) {
        response = { ok: false, error: `Invalid request: ${error instanceof Error ? error.message : String(error)}` };
      }

      try {
        socket.write(JSON.stringify(response) + "\n");
      } catch {
        // Client disconnected
      }

      // Shutdown: respond then exit
      if (line.includes('"shutdown"')) {
        log("Shutdown requested, exiting...");
        setTimeout(() => process.exit(0), 100);
      }
    }
  });

  socket.on("error", () => {
    // Client disconnected unexpectedly
  });
}

function main(): void {
  const socketPath = getSocketPath();
  cleanupStaleSocket(socketPath);

  // Ensure parent directory exists
  const dir = dirname(socketPath);
  if (!socketPath.startsWith("\\\\.\\pipe\\")) {
    mkdirSync(dir, { recursive: true });
  }

  const server = createServer(handleConnection);

  server.listen(socketPath, () => {
    log(`Daemon listening on ${socketPath}`);
  });

  server.on("error", (error) => {
    log(`Server error: ${error.message}`);
    process.exit(1);
  });

  async function gracefulShutdown(signal: string): Promise<void> {
    log(`${signal} received, shutting down...`);
    await handleShutdown();
    server.close();
    cleanupStaleSocket(socketPath);
    process.exit(0);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

main();
