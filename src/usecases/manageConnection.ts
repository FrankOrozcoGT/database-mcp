import { randomUUID } from "crypto";
import { ConnectionConfig, ConnectionWithStatus } from "../domain/entities/connection.js";
import { DbDriver, ConnectionEnv, ConnectionStatus } from "../domain/types.js";
import { getProjectId } from "../domain/services/projectContext.js";
import { encrypt, decrypt } from "../domain/services/crypto.js";
import {
  saveConnection,
  findAllByProject,
  findById,
  updateConnection,
  deleteConnection,
} from "../infrastructure/repositories/connection.repo.js";
import { ConnectionAlreadyActiveError } from "../shared/errors.js";

// Pool will be implemented in Task 2, stub for now
function getConnectionStatus(_connId: string): ConnectionStatus {
  return "disconnected";
}

function isConnectionActive(_connId: string): boolean {
  return false;
}

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

export function listConnections(): ConnectionWithStatus[] {
  const projectId = getProjectId();
  const connections = findAllByProject(projectId);

  return connections.map((conn) => ({
    ...conn,
    password: "***",
    status: getConnectionStatus(conn.id),
  }));
}

export function getConnection(id: string): ConnectionWithStatus | null {
  const projectId = getProjectId();
  const conn = findById(projectId, id);
  if (!conn) return null;

  return {
    ...conn,
    password: "***",
    status: getConnectionStatus(conn.id),
  };
}

export function editConnection(id: string, input: UpdateConnectionInput): ConnectionConfig {
  const projectId = getProjectId();
  const existing = findById(projectId, id);
  if (!existing) {
    throw new Error(`Connection ${id} not found`);
  }

  if (isConnectionActive(id)) {
    throw new ConnectionAlreadyActiveError(id);
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

export function removeConnection(id: string): boolean {
  const projectId = getProjectId();

  // If active, disconnect first (Task 2 will implement real disconnect)
  // For now just remove from DB (CASCADE deletes terminals)
  return deleteConnection(projectId, id);
}
