import { randomUUID } from "crypto";
import { ConnectionConfig, ConnectionWithStatus } from "../domain/entities/connection.js";
import { DbDriver, ConnectionEnv } from "../domain/types.js";
import { getProjectId } from "../domain/services/projectContext.js";
import { encrypt, decrypt } from "../domain/services/crypto.js";
import {
  saveConnection,
  findAllByProject,
  findById,
  updateConnection,
  deleteConnection,
} from "../infrastructure/repositories/connection.repo.js";
import { findByConnection } from "../infrastructure/repositories/terminal.repo.js";
import { ConnectionAlreadyActiveError, ConnectionError } from "../shared/errors.js";
import { getNotifier } from "../domain/services/notifier.js";
import { send } from "../infrastructure/ipc/client.js";
import { ConnectPayload } from "../daemon/protocol.js";

export interface CreateConnectionInput {
  name: string;
  driver: DbDriver;
  env: ConnectionEnv;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  preCommands?: string[];
}

export interface UpdateConnectionInput {
  name?: string;
  driver?: DbDriver;
  env?: ConnectionEnv;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  preCommands?: string[];
}

// --- CRUD ---

export function createConnection(input: CreateConnectionInput): ConnectionConfig {
  const projectId = getProjectId();
  const now = new Date().toISOString();

  const conn: ConnectionConfig = {
    id: randomUUID(),
    projectId,
    name: input.name,
    driver: input.driver,
    env: input.env,
    host: input.host,
    port: input.port,
    database: input.database,
    username: input.username,
    password: encrypt(input.password),
    ssl: input.ssl ?? false,
    preCommands: input.preCommands ?? [],
    createdAt: now,
    updatedAt: now,
  };

  saveConnection(conn);
  return { ...conn, password: "***" };
}

export async function listConnections(): Promise<ConnectionWithStatus[]> {
  const projectId = getProjectId();
  const connections = findAllByProject(projectId);

  // Get status from daemon for all connections
  const statusResponse = await send({ action: "statusAll" });
  const activeMap = new Map<string, string>();
  if (statusResponse.ok) {
    const data = statusResponse.data as { connections: { connId: string; status: string }[] };
    for (const c of data.connections) {
      activeMap.set(c.connId, c.status);
    }
  }

  return connections.map((conn) => ({
    ...conn,
    password: "***",
    status: (activeMap.get(conn.id) as "connected" | "disconnected" | "error") ?? "disconnected",
  }));
}

export async function getConnection(id: string): Promise<ConnectionWithStatus | null> {
  const projectId = getProjectId();
  const conn = findById(projectId, id);
  if (!conn) return null;

  const statusResponse = await send({ action: "status", payload: { connId: id } });
  const status = statusResponse.ok
    ? (statusResponse.data as { status: string }).status as "connected" | "disconnected" | "error"
    : "disconnected";

  return {
    ...conn,
    password: "***",
    status,
  };
}

export async function editConnection(id: string, input: UpdateConnectionInput): Promise<ConnectionConfig> {
  const projectId = getProjectId();
  const existing = findById(projectId, id);
  if (!existing) {
    throw new Error(`Connection ${id} not found`);
  }

  // Check if active in daemon
  const statusResponse = await send({ action: "status", payload: { connId: id } });
  if (statusResponse.ok) {
    const data = statusResponse.data as { status: string };
    if (data.status === "connected") {
      throw new ConnectionAlreadyActiveError(id);
    }
  }

  const updated: ConnectionConfig = {
    ...existing,
    name: input.name ?? existing.name,
    driver: input.driver ?? existing.driver,
    env: input.env ?? existing.env,
    host: input.host ?? existing.host,
    port: input.port ?? existing.port,
    database: input.database ?? existing.database,
    username: input.username ?? existing.username,
    password: input.password ? encrypt(input.password) : existing.password,
    ssl: input.ssl ?? existing.ssl,
    preCommands: input.preCommands ?? existing.preCommands,
    updatedAt: new Date().toISOString(),
  };

  updateConnection(updated);
  return { ...updated, password: "***" };
}

export async function removeConnection(id: string): Promise<boolean> {
  const projectId = getProjectId();

  // If active in daemon, disconnect first
  const statusResponse = await send({ action: "status", payload: { connId: id } });
  if (statusResponse.ok) {
    const data = statusResponse.data as { status: string };
    if (data.status === "connected") {
      await disconnectFromDatabase(id);
    }
  }

  return deleteConnection(projectId, id);
}

// --- Connect/Disconnect via Daemon ---

export async function connectToDatabase(connectionId: string): Promise<{ status: string; reused: boolean }> {
  const projectId = getProjectId();

  const conn = findById(projectId, connectionId);
  if (!conn) {
    throw new ConnectionError(`Connection ${connectionId} not found`);
  }

  const decryptedPassword = decrypt(conn.password);

  // Get terminals for this connection
  const terminals = findByConnection(projectId, connectionId);

  const payload: ConnectPayload = {
    connId: connectionId,
    driver: conn.driver,
    env: conn.env,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password: decryptedPassword,
    ssl: conn.ssl,
    terminals: terminals.map((t) => ({
      id: t.id,
      label: t.label,
      command: t.command,
      slot: t.slot,
      order: t.order,
    })),
  };

  const response = await send({ action: "connect", payload });
  if (!response.ok) {
    throw new ConnectionError(response.error ?? "Failed to connect");
  }

  const data = response.data as { status: string; reused: boolean };
  if (!data.reused) {
    getNotifier().emit("connection:status", { type: "display", connId: connectionId, status: "connected" });
  }
  return data;
}

export async function disconnectFromDatabase(connectionId: string): Promise<{ status: string }> {
  const response = await send({ action: "disconnect", payload: { connId: connectionId } });
  if (!response.ok) {
    throw new ConnectionError(response.error ?? "Failed to disconnect");
  }

  getNotifier().emit("connection:status", { type: "display", connId: connectionId, status: "disconnected" });
  return { status: "disconnected" };
}

export async function shutdownAll(): Promise<void> {
  // MCP shutdown — we don't kill the daemon, connections persist
  // Just cleanup local resources
}
