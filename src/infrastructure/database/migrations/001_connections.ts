import type Database from "better-sqlite3";

export const up = (db: Database.Database): void => {
  db.exec(`
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
  `);
};

export const down = (db: Database.Database): void => {
  db.exec("DROP TABLE IF EXISTS connections");
};
