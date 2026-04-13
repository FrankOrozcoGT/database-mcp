import type Database from "better-sqlite3";

export const up = (db: Database.Database): void => {
  db.exec(`
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
  `);
};

export const down = (db: Database.Database): void => {
  db.exec("DROP TABLE IF EXISTS terminals");
};
