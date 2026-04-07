import { io, Socket } from "socket.io-client";
import { randomUUID } from "crypto";
import { getProjectId } from "../../domain/services/projectContext.js";
import { Notifier } from "../../domain/services/notifier.js";
import { send } from "../ipc/client.js";
import { executeQuery } from "../../usecases/executeQuery.js";

let socket: Socket | null = null;

// --- Pending auth requests ---
interface PendingAuth {
  resolve: (approved: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingAuths = new Map<string, PendingAuth>();

// --- Notifier implementation ---

export const socketNotifier: Notifier = {
  emit(event: string, data: Record<string, unknown>): void {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  },

  requestAuth(connId: string, sql: string, env: string, timeoutMs: number = 60000): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = randomUUID();

      const timeout = setTimeout(() => {
        pendingAuths.delete(requestId);
        resolve(false);
      }, timeoutMs);

      pendingAuths.set(requestId, { resolve, timeout });

      socketNotifier.emit("auth:request", { type: "auth", requestId, connId, sql, env });
    });
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },
};

// --- Incoming event handlers (from wrapper/frontend) ---

function handleAuthApprove(data: { requestId: string }): void {
  const pending = pendingAuths.get(data.requestId);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingAuths.delete(data.requestId);
  pending.resolve(true);
  socketNotifier.emit("auth:resolved", { type: "auth", requestId: data.requestId, approved: true });
}

function handleAuthDeny(data: { requestId: string }): void {
  const pending = pendingAuths.get(data.requestId);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingAuths.delete(data.requestId);
  pending.resolve(false);
  socketNotifier.emit("auth:resolved", { type: "auth", requestId: data.requestId, approved: false });
}

async function handleSchemaGet(data: { connId: string }): Promise<void> {
  try {
    const response = await send({ action: "getSchema", payload: { connId: data.connId } });
    if (!response.ok) {
      socketNotifier.emit("error", { type: "display", message: response.error ?? "Schema error", code: "SCHEMA_ERROR" });
      return;
    }
    const result = response.data as { tables: Record<string, unknown>[] };
    socketNotifier.emit("schema:tables", { type: "display", connId: data.connId, tables: result.tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    socketNotifier.emit("error", { type: "display", message, code: "SCHEMA_ERROR" });
  }
}

async function handleQueryExecute(data: { connId: string; sql: string }): Promise<void> {
  try {
    const result = await executeQuery(data.connId, data.sql);
    socketNotifier.emit("query:result", {
      type: "display",
      connId: data.connId,
      columns: result.columns,
      rows: result.rows as unknown as Record<string, unknown>[],
      rowCount: result.rowCount,
      duration: result.duration,
      queryType: result.type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    socketNotifier.emit("query:error", { type: "display", connId: data.connId, error: message });
  }
}

async function handleConnectionTest(data: { connId: string }): Promise<void> {
  try {
    const response = await send({ action: "status", payload: { connId: data.connId } });
    const status = response.ok
      ? (response.data as { status: string }).status
      : "disconnected";
    socketNotifier.emit("connection:status", { type: "display", connId: data.connId, status });
  } catch {
    socketNotifier.emit("connection:status", { type: "display", connId: data.connId, status: "disconnected" });
  }
}

// --- Connect / Disconnect ---

export function connect(url: string = "http://localhost:3050", namespace: string = "/mcp"): Socket {
  socket = io(`${url}${namespace}`, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    const projectId = getProjectId();
    socket!.emit("welcome", { projectId, mcpType: "database" });
    console.error(`[database-mcp] Connected to wrapper at ${url}${namespace}`);
  });

  socket.on("disconnect", (reason) => {
    console.error(`[database-mcp] Disconnected from wrapper: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    console.error(`[database-mcp] Connection error: ${error.message}`);
  });

  // Register incoming event listeners
  socket.on("auth:approve", handleAuthApprove);
  socket.on("auth:deny", handleAuthDeny);
  socket.on("schema:get", handleSchemaGet);
  socket.on("query:execute", handleQueryExecute);
  socket.on("connection:test", handleConnectionTest);

  socket.on("error", (data: { message: string }) => {
    console.error(`[database-mcp] Wrapper error: ${data.message}`);
  });

  return socket;
}

export function disconnect(): Promise<void> {
  return new Promise((resolve) => {
    for (const [, pending] of pendingAuths) {
      clearTimeout(pending.timeout);
      pending.resolve(false);
    }
    pendingAuths.clear();

    if (socket) {
      socket.disconnect();
      socket = null;
    }
    resolve();
  });
}
