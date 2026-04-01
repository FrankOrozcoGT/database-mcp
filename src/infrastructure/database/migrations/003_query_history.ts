import type Database from "better-sqlite3";

export const up = (db: Database.Database): void => {
  db.exec(`
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
  `);
};

export const down = (db: Database.Database): void => {
  db.exec("DROP TABLE IF EXISTS query_history");
};
