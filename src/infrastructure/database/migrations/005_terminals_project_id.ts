import type Database from "better-sqlite3";

export const up = (db: Database.Database): void => {
  db.exec(`
    ALTER TABLE terminals ADD COLUMN project_id TEXT NOT NULL DEFAULT '';
    CREATE TABLE terminals_new (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
      command TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      UNIQUE(connection_id, slot)
    );
    INSERT INTO terminals_new SELECT id, project_id, connection_id, slot, command, label, sort_order, created_at, updated_at FROM terminals;
    DROP TABLE terminals;
    ALTER TABLE terminals_new RENAME TO terminals;
    CREATE INDEX idx_terminals_project_id ON terminals(project_id);
    CREATE INDEX idx_terminals_connection_id ON terminals(connection_id);
  `);
};

export const down = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE terminals_old (
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
    );
    INSERT INTO terminals_old SELECT id, connection_id, slot, command, label, sort_order, created_at, updated_at FROM terminals;
    DROP TABLE terminals;
    ALTER TABLE terminals_old RENAME TO terminals;
  `);
};
