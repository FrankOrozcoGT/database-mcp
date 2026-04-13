import type Database from "better-sqlite3";

export const up = (db: Database.Database): void => {
  db.exec(`
    ALTER TABLE query_history ADD COLUMN project_id TEXT NOT NULL DEFAULT '';
    CREATE TABLE query_history_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      sql_text TEXT NOT NULL,
      query_type TEXT NOT NULL CHECK(query_type IN ('read', 'write')),
      duration_ms INTEGER NOT NULL DEFAULT 0,
      row_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
    INSERT INTO query_history_new SELECT id, project_id, connection_id, sql_text, query_type, duration_ms, row_count, error, executed_at FROM query_history;
    DROP TABLE query_history;
    ALTER TABLE query_history_new RENAME TO query_history;
    CREATE INDEX idx_query_history_project_id ON query_history(project_id);
    CREATE INDEX idx_query_history_connection_id ON query_history(connection_id);
  `);
};

export const down = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE query_history_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT NOT NULL,
      sql_text TEXT NOT NULL,
      query_type TEXT NOT NULL CHECK(query_type IN ('read', 'write')),
      duration_ms INTEGER NOT NULL DEFAULT 0,
      row_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
    INSERT INTO query_history_old SELECT id, connection_id, sql_text, query_type, duration_ms, row_count, error, executed_at FROM query_history;
    DROP TABLE query_history;
    ALTER TABLE query_history_old RENAME TO query_history;
  `);
};
