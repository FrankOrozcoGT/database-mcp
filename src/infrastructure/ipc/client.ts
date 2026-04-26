import { connect as netConnect, Socket } from "net";
import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getPlatform } from "../platform/index.js";
import { DaemonRequest, DaemonResponse } from "../../daemon/protocol.js";
import { getProjectId, isInitialized } from "../../domain/services/projectContext.js";

const REQUEST_TIMEOUT = 30000;
const SPAWN_MAX_RETRIES = 5;
const SPAWN_RETRY_DELAY = 1000;

function getSocketPath(): string {
  const platform = getPlatform();
  const projectId = isInitialized() ? getProjectId() : "default";
  if (platform.osType === "windows") {
    return `\\\\.\\pipe\\database-mcp-daemon-${projectId}`;
  }
  const dataDir = platform.dataDir("database-mcp");
  mkdirSync(dataDir, { recursive: true });
  return `${dataDir}/daemon-${projectId}.sock`;
}

function getDaemonInfo(): { execPath: string; args: string[] } {
  const currentFile = new URL(import.meta.url).pathname;
  const isDist = currentFile.includes("/dist/");

  if (isDist) {
    const daemonPath = join(dirname(currentFile), "../../daemon/index.js");
    return { execPath: process.execPath, args: [daemonPath] };
  }

  // Dev mode: use tsx
  const daemonPath = join(dirname(currentFile), "../../daemon/index.ts");
  return { execPath: process.execPath, args: [join(dirname(currentFile), "../../../node_modules/.bin/tsx"), daemonPath] };
}

function spawnDaemon(): void {
  const { execPath, args } = getDaemonInfo();
  const projectId = isInitialized() ? getProjectId() : "default";
  const child = spawn(execPath, [...args, "--project-id", projectId], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function sendRaw(socketPath: string, request: DaemonRequest): Promise<DaemonResponse> {
  return new Promise((resolve, reject) => {
    const socket = netConnect(socketPath, () => {
      socket.write(JSON.stringify(request) + "\n");
    });

    let buffer = "";
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Daemon request timeout"));
    }, REQUEST_TIMEOUT);

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const newlineIdx = buffer.indexOf("\n");
      if (newlineIdx !== -1) {
        clearTimeout(timeout);
        const line = buffer.slice(0, newlineIdx);
        socket.end();
        try {
          resolve(JSON.parse(line));
        } catch {
          reject(new Error(`Invalid daemon response: ${line}`));
        }
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on("end", () => {
      clearTimeout(timeout);
      if (!buffer.includes("\n")) {
        reject(new Error("Daemon closed connection without response"));
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDaemon(socketPath: string): Promise<void> {
  // Try connecting first
  try {
    await sendRaw(socketPath, { action: "statusAll" });
    return; // Daemon already running
  } catch {
    // Not running, spawn it
  }

  spawnDaemon();

  for (let i = 0; i < SPAWN_MAX_RETRIES; i++) {
    await sleep(SPAWN_RETRY_DELAY);
    try {
      await sendRaw(socketPath, { action: "statusAll" });
      return; // Daemon is up
    } catch {
      // Not ready yet
    }
  }

  throw new Error(`Daemon failed to start after ${SPAWN_MAX_RETRIES} attempts`);
}

let initialized = false;

export async function send(request: DaemonRequest): Promise<DaemonResponse> {
  const socketPath = getSocketPath();

  if (!initialized) {
    await ensureDaemon(socketPath);
    initialized = true;
  }

  try {
    return await sendRaw(socketPath, request);
  } catch {
    // Daemon might have died, try to respawn once
    initialized = false;
    await ensureDaemon(socketPath);
    initialized = true;
    return sendRaw(socketPath, request);
  }
}

export async function syncActiveConnections(): Promise<{ connId: string; status: string }[]> {
  const response = await send({ action: "statusAll" });
  if (!response.ok) return [];
  const data = response.data as { connections: { connId: string; status: string }[] };
  return data.connections;
}
