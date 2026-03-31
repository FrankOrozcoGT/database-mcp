import Database from "better-sqlite3";
import { getPlatform } from "../platform/index.js";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

let db: Database.Database | null = null;

function getDbPath(): string {
  const platform = getPlatform();
  const dataDir = platform.dataDir("database-mcp");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "database-mcp.db");
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare("SELECT name FROM migrations").all()
      .map((row: any) => row.name),
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      db.transaction(() => {
        db.exec(migration.sql);
        db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
      })();
    }
  }
}

const migrations = [
  {
    name: "001_connections",
    sql: `
      CREATE TABLE connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        driver TEXT NOT NULL CHECK(driver IN ('postgres', 'mysql')),
        env TEXT NOT NULL CHECK(env IN ('dev', 'prod')),
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        database_name TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL DEFAULT '',
        ssl INTEGER NOT NULL DEFAULT 0,
        pre_commands TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
  },
  {
    name: "002_terminals",
    sql: `
      CREATE TABLE terminals (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
        command TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
        UNIQUE(connection_id, slot)
      )
    `,
  },
  {
    name: "003_query_history",
    sql: `
      CREATE TABLE query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        sql_text TEXT NOT NULL,
        query_type TEXT NOT NULL CHECK(query_type IN ('read', 'write')),
        duration_ms INTEGER NOT NULL DEFAULT 0,
        row_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        executed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )
    `,
  },
  {
    name: "004_connections_project_id_and_drivers",
    sql: `
      ALTER TABLE connections ADD COLUMN project_id TEXT NOT NULL DEFAULT '';
      CREATE TABLE connections_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        driver TEXT NOT NULL CHECK(driver IN ('postgres', 'mysql', 'mssql', 'sqlite')),
        env TEXT NOT NULL CHECK(env IN ('dev', 'prod')),
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        database_name TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL DEFAULT '',
        ssl INTEGER NOT NULL DEFAULT 0,
        pre_commands TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO connections_new SELECT id, project_id, name, driver, env, host, port, database_name, username, password, ssl, pre_commands, created_at, updated_at FROM connections;
      DROP TABLE connections;
      ALTER TABLE connections_new RENAME TO connections;
      CREATE INDEX idx_connections_project_id ON connections(project_id);
    `,
  },
];

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
