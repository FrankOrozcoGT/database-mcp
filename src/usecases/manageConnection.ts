import { randomUUID } from "crypto";
import { ConnectionConfig, ConnectionWithStatus } from "../domain/entities/connection.js";
import { DbDriver, ConnectionEnv } from "../domain/types.js";
import { getProjectId } from "../domain/services/projectContext.js";
import { encrypt, decrypt } from "../domain/services/crypto.js";
import * as pool from "../domain/services/connectionPool.js";
import {
  saveConnection,
  findAllByProject,
  findById,
  updateConnection,
  deleteConnection,
} from "../infrastructure/repositories/connection.repo.js";
import { findByConnection } from "../infrastructure/repositories/terminal.repo.js";
import { ConnectionAlreadyActiveError, ConnectionError, DriverNotFoundError } from "../shared/errors.js";
import { DatabaseDriver } from "../infrastructure/drivers/driver.interface.js";
import { PostgresDriver } from "../infrastructure/drivers/postgres.driver.js";
import { MysqlDriver } from "../infrastructure/drivers/mysql.driver.js";
import { MssqlDriver } from "../infrastructure/drivers/mssql.driver.js";
import { SqliteDriver } from "../infrastructure/drivers/sqlite.driver.js";
import * as terminalManager from "../infrastructure/terminals/manager.js";
import { getNotifier } from "../domain/services/notifier.js";

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

function createDriver(driver: DbDriver, config: ConnectionConfig, decryptedPassword: string): DatabaseDriver {
  const driverConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: decryptedPassword,
    ssl: config.ssl,
  };

  switch (driver) {
    case "postgres":
      return new PostgresDriver(driverConfig);
    case "mysql":
      return new MysqlDriver(driverConfig);
    case "mssql":
      return new MssqlDriver(driverConfig);
    case "sqlite":
      return new SqliteDriver(driverConfig);
    default:
      throw new DriverNotFoundError(driver);
  }
}

// --- CRUD (Task 1) ---

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
    status: pool.getStatus(conn.id),
  }));
}

export function getConnection(id: string): ConnectionWithStatus | null {
  const projectId = getProjectId();
  const conn = findById(projectId, id);
  if (!conn) return null;

  return {
    ...conn,
    password: "***",
    status: pool.getStatus(conn.id),
  };
}

export function editConnection(id: string, input: UpdateConnectionInput): ConnectionConfig {
  const projectId = getProjectId();
  const existing = findById(projectId, id);
  if (!existing) {
    throw new Error(`Connection ${id} not found`);
  }

  if (pool.isActive(id)) {
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

  // If active, disconnect first
  if (pool.isActive(id)) {
    disconnectFromDatabase(id);
  }

  return deleteConnection(projectId, id);
}

// --- Connect/Disconnect (Task 2) ---

export async function connectToDatabase(connectionId: string): Promise<{ status: string; reused: boolean }> {
  const projectId = getProjectId();

  // Already active? Reuse
  if (pool.isActive(connectionId)) {
    return { status: "connected", reused: true };
  }

  const conn = findById(projectId, connectionId);
  if (!conn) {
    throw new ConnectionError(`Connection ${connectionId} not found`);
  }

  const decryptedPassword = decrypt(conn.password);
  const driver = createDriver(conn.driver, conn, decryptedPassword);

  // Launch pre-configured terminals
  const terminals = findByConnection(projectId, connectionId);
  let terminalPids: number[] = [];

  if (terminals.length > 0) {
    try {
      terminalPids = terminalManager.launchAll(connectionId, terminals);
    } catch (error) {
      throw new ConnectionError(
        `Failed to launch terminals: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Connect driver
  try {
    await driver.connect();
  } catch (error) {
    // Kill terminals if driver fails
    terminalManager.killAll(connectionId);
    throw new ConnectionError(
      `Failed to connect to ${conn.driver}://${conn.host}:${conn.port}/${conn.database}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Register onDisconnect callback
  driver.onDisconnect(() => {
    terminalManager.killAll(connectionId);
    pool.removeConnection(connectionId);
    getNotifier().emit("connection:status", { type: "display", connId: connectionId, status: "disconnected" });
  });

  pool.registerConnection(connectionId, driver, terminalPids);
  getNotifier().emit("connection:status", { type: "display", connId: connectionId, status: "connected" });
  return { status: "connected", reused: false };
}

export function disconnectFromDatabase(connectionId: string): { status: string } {
  const entry = pool.getConnection(connectionId);
  if (!entry) {
    return { status: "disconnected" };
  }

  // Disconnect driver (fire and forget for sync cleanup)
  entry.driver.disconnect().catch(() => {});

  // Kill terminals in reverse order
  terminalManager.killAll(connectionId);

  // Remove from pool
  pool.removeConnection(connectionId);

  getNotifier().emit("connection:status", { type: "display", connId: connectionId, status: "disconnected" });
  return { status: "disconnected" };
}

export async function shutdownAll(): Promise<void> {
  const active = pool.getAllActive();
  for (const entry of active) {
    try {
      await entry.driver.disconnect();
    } catch {
      // Best effort
    }
    terminalManager.killAll(entry.connectionId);
  }
  terminalManager.killAllConnections();
  pool.clearPool();
}
