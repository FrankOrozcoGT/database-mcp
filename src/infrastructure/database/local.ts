import Database from "better-sqlite3";
import { Umzug } from "umzug";
import { getPlatform } from "../platform/index.js";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

import { up as up001, down as down001 } from "./migrations/001_connections.js";
import { up as up002, down as down002 } from "./migrations/002_terminals.js";
import { up as up003, down as down003 } from "./migrations/003_query_history.js";
import { up as up004, down as down004 } from "./migrations/004_connections_project_id_and_drivers.js";
import { up as up005, down as down005 } from "./migrations/005_terminals_project_id.js";
import { up as up006, down as down006 } from "./migrations/006_query_history_project_id.js";

let db: Database.Database | null = null;

function getDbPath(): string {
  const platform = getPlatform();
  const dataDir = platform.dataDir("database-mcp");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "database-mcp.db");
}

const migrationsList = [
  { name: "001_connections", up: up001, down: down001 },
  { name: "002_terminals", up: up002, down: down002 },
  { name: "003_query_history", up: up003, down: down003 },
  { name: "004_connections_project_id_and_drivers", up: up004, down: down004 },
  { name: "005_terminals_project_id", up: up005, down: down005 },
  { name: "006_query_history_project_id", up: up006, down: down006 },
];

function createUmzug(database: Database.Database): Umzug<Database.Database> {
  return new Umzug<Database.Database>({
    migrations: migrationsList.map((m) => ({
      name: m.name,
      up: async () => m.up(database),
      down: async () => m.down(database),
    })),
    context: database,
    storage: {
      async executed() {
        database.exec(`
          CREATE TABLE IF NOT EXISTS migrations (
            name TEXT PRIMARY KEY
          )
        `);
        const rows = database.prepare("SELECT name FROM migrations ORDER BY name").all() as { name: string }[];
        return rows.map((r) => r.name);
      },
      async logMigration({ name }) {
        database.prepare("INSERT INTO migrations (name) VALUES (?)").run(name);
      },
      async unlogMigration({ name }) {
        database.prepare("DELETE FROM migrations WHERE name = ?").run(name);
      },
    },
    logger: undefined,
  });
}

export async function runMigrations(): Promise<void> {
  const database = getDb();
  const umzug = createUmzug(database);
  await umzug.up();
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
