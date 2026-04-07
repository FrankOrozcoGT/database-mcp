import { ConnectPayload, ConnIdPayload, ExecutePayload, DaemonResponse } from "./protocol.js";
import { DatabaseDriver } from "../infrastructure/drivers/driver.interface.js";
import { PostgresDriver } from "../infrastructure/drivers/postgres.driver.js";
import { MysqlDriver } from "../infrastructure/drivers/mysql.driver.js";
import { MssqlDriver } from "../infrastructure/drivers/mssql.driver.js";
import { SqliteDriver } from "../infrastructure/drivers/sqlite.driver.js";
import * as pool from "../domain/services/connectionPool.js";
import * as terminalManager from "../infrastructure/terminals/manager.js";
import { DbDriver } from "../domain/types.js";
import { TerminalConfig } from "../domain/entities/terminal.js";

function createDriver(driver: DbDriver, config: ConnectPayload): DatabaseDriver {
  const driverConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
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
      throw new Error(`Driver not found: ${driver}`);
  }
}

export async function handleConnect(payload: ConnectPayload): Promise<DaemonResponse> {
  // Already active? Reuse
  if (pool.isActive(payload.connId)) {
    return { ok: true, data: { status: "connected", reused: true } };
  }

  const driver = createDriver(payload.driver, payload);

  // Launch terminals
  let terminalPids: number[] = [];
  if (payload.terminals.length > 0) {
    const terminalConfigs: TerminalConfig[] = payload.terminals.map((t) => ({
      id: t.id,
      projectId: "",
      connectionId: payload.connId,
      slot: t.slot,
      command: t.command,
      label: t.label,
      order: t.order,
      createdAt: "",
      updatedAt: "",
    }));

    try {
      terminalPids = terminalManager.launchAll(payload.connId, terminalConfigs);
    } catch (error) {
      return { ok: false, error: `Failed to launch terminals: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // Connect driver
  try {
    await driver.connect();
  } catch (error) {
    terminalManager.killAll(payload.connId);
    return { ok: false, error: `Failed to connect: ${error instanceof Error ? error.message : String(error)}` };
  }

  // Register onDisconnect callback
  driver.onDisconnect(() => {
    terminalManager.killAll(payload.connId);
    pool.removeConnection(payload.connId);
  });

  pool.registerConnection(payload.connId, driver, terminalPids);
  return { ok: true, data: { status: "connected", reused: false } };
}

export async function handleDisconnect(payload: ConnIdPayload): Promise<DaemonResponse> {
  const entry = pool.getConnection(payload.connId);
  if (!entry) {
    return { ok: true, data: { status: "disconnected" } };
  }

  entry.driver.disconnect().catch(() => {});
  terminalManager.killAll(payload.connId);
  pool.removeConnection(payload.connId);

  return { ok: true, data: { status: "disconnected" } };
}

export async function handleExecute(payload: ExecutePayload): Promise<DaemonResponse> {
  const entry = pool.getConnection(payload.connId);
  if (!entry || !entry.driver.isConnected()) {
    return { ok: false, error: `Connection ${payload.connId} is not active.` };
  }

  try {
    const result = await entry.driver.execute(payload.sql);
    return { ok: true, data: { columns: result.columns, rows: result.rows, rowCount: result.rowCount } };
  } catch (error) {
    return { ok: false, error: `Query error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function handleGetSchema(payload: ConnIdPayload): Promise<DaemonResponse> {
  const entry = pool.getConnection(payload.connId);
  if (!entry || !entry.driver.isConnected()) {
    return { ok: false, error: `Connection ${payload.connId} is not active.` };
  }

  try {
    const schema = await entry.driver.getSchema();
    return { ok: true, data: { tables: schema.tables } };
  } catch (error) {
    return { ok: false, error: `Schema error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function handleStatus(payload: ConnIdPayload): DaemonResponse {
  const status = pool.getStatus(payload.connId);
  return { ok: true, data: { connId: payload.connId, status } };
}

export function handleStatusAll(): DaemonResponse {
  const active = pool.getAllActive();
  const connections = active.map((entry) => ({
    connId: entry.connectionId,
    status: "connected",
    terminalPids: entry.terminalPids,
  }));
  return { ok: true, data: { connections } };
}

export async function handleShutdown(): Promise<DaemonResponse> {
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
  return { ok: true, data: { message: "Shutdown complete" } };
}
