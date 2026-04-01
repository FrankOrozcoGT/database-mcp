import type Database from "better-sqlite3";

export const up = (db: Database.Database): void => {
  db.exec(`
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
  `);
};

export const down = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE connections_old (
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
    );
    INSERT INTO connections_old SELECT id, name, driver, env, host, port, database_name, username, password, ssl, pre_commands, created_at, updated_at FROM connections;
    DROP TABLE connections;
    ALTER TABLE connections_old RENAME TO connections;
  `);
};
