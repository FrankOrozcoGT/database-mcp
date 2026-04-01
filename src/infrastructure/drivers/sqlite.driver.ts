import Database from "better-sqlite3";
import {
  DatabaseDriver,
  DriverConnectionConfig,
  QueryExecutionResult,
  SchemaInfo,
  SchemaTable,
} from "./driver.interface.js";

export class SqliteDriver implements DatabaseDriver {
  private db: Database.Database | null = null;
  private disconnectCallback: (() => void) | null = null;
  private connected = false;

  constructor(private config: DriverConnectionConfig) {}

  async connect(): Promise<void> {
    // For SQLite, database field is the file path
    this.db = new Database(this.config.database);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.connected = true;
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryExecutionResult> {
    if (!this.db) throw new Error("Not connected");

    const isRead = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH\s)/i.test(sql.trim());

    if (isRead) {
      const rows = this.db.prepare(sql).all(...(params ?? [])) as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { columns, rows, rowCount: rows.length };
    }

    const result = this.db.prepare(sql).run(...(params ?? []));
    return {
      columns: [],
      rows: [],
      rowCount: result.changes,
    };
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Already closed
      }
      this.db = null;
      this.connected = false;
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.db) throw new Error("Not connected");
    const tablesRows = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all() as { name: string }[];

    const tables: SchemaTable[] = [];
    for (const tableRow of tablesRows) {
      const columns = this.db.prepare(`PRAGMA table_info("${tableRow.name}")`).all() as any[];
      const fks = this.db.prepare(`PRAGMA foreign_key_list("${tableRow.name}")`).all() as any[];

      tables.push({
        name: tableRow.name,
        schema: "main",
        columns: columns.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.notnull === 0,
          defaultValue: c.dflt_value,
          isPrimaryKey: c.pk === 1,
        })),
        foreignKeys: fks.map((fk) => ({
          column: fk.from,
          referencedTable: fk.table,
          referencedColumn: fk.to,
        })),
      });
    }

    return { tables };
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
