import { getDb } from "../database/local.js";
import { ConnectionConfig } from "../../domain/entities/connection.js";
import { DbDriver, ConnectionEnv } from "../../domain/types.js";

interface ConnectionRow {
  id: string;
  project_id: string;
  name: string;
  driver: string;
  env: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
  ssl: number;
  pre_commands: string;
  created_at: string;
  updated_at: string;
}

function rowToEntity(row: ConnectionRow): ConnectionConfig {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    driver: row.driver as DbDriver,
    env: row.env as ConnectionEnv,
    host: row.host,
    port: row.port,
    database: row.database_name,
    username: row.username,
    password: row.password,
    ssl: row.ssl === 1,
    preCommands: JSON.parse(row.pre_commands),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveConnection(conn: ConnectionConfig): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO connections (id, project_id, name, driver, env, host, port, database_name, username, password, ssl, pre_commands, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conn.id,
    conn.projectId,
    conn.name,
    conn.driver,
    conn.env,
    conn.host,
    conn.port,
    conn.database,
    conn.username,
    conn.password,
    conn.ssl ? 1 : 0,
    JSON.stringify(conn.preCommands),
    conn.createdAt,
    conn.updatedAt,
  );
}

export function findAllByProject(projectId: string): ConnectionConfig[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM connections WHERE project_id = ? ORDER BY created_at DESC",
  ).all(projectId) as ConnectionRow[];
  return rows.map(rowToEntity);
}

export function findById(projectId: string, id: string): ConnectionConfig | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM connections WHERE id = ? AND project_id = ?",
  ).get(id, projectId) as ConnectionRow | undefined;
  return row ? rowToEntity(row) : null;
}

export function updateConnection(conn: ConnectionConfig): void {
  const db = getDb();
  db.prepare(`
    UPDATE connections
    SET name = ?, driver = ?, env = ?, host = ?, port = ?, database_name = ?, username = ?, password = ?, ssl = ?, pre_commands = ?, updated_at = ?
    WHERE id = ? AND project_id = ?
  `).run(
    conn.name,
    conn.driver,
    conn.env,
    conn.host,
    conn.port,
    conn.database,
    conn.username,
    conn.password,
    conn.ssl ? 1 : 0,
    JSON.stringify(conn.preCommands),
    conn.updatedAt,
    conn.id,
    conn.projectId,
  );
}

export function deleteConnection(projectId: string, id: string): boolean {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM connections WHERE id = ? AND project_id = ?",
  ).run(id, projectId);
  return result.changes > 0;
}
