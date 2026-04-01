import mysql from "mysql2/promise";
import {
  DatabaseDriver,
  DriverConnectionConfig,
  QueryExecutionResult,
  SchemaInfo,
  SchemaTable,
} from "./driver.interface.js";

export class MysqlDriver implements DatabaseDriver {
  private pool: mysql.Pool | null = null;
  private disconnectCallback: (() => void) | null = null;
  private connected = false;

  constructor(private config: DriverConnectionConfig) {}

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5,
    });

    this.pool.on("connection", (conn) => {
      conn.on("error", () => {
        this.connected = false;
        this.disconnectCallback?.();
      });
    });

    // Ping to verify
    const conn = await this.pool.getConnection();
    await conn.ping();
    conn.release();
    this.connected = true;
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryExecutionResult> {
    if (!this.pool) throw new Error("Not connected");
    const [result, fields] = await this.pool.execute(sql, params as any[]);

    if (Array.isArray(result)) {
      return {
        columns: fields?.map((f: any) => f.name) ?? [],
        rows: result as Record<string, unknown>[],
        rowCount: result.length,
      };
    }

    // INSERT/UPDATE/DELETE
    const res = result as mysql.ResultSetHeader;
    return {
      columns: [],
      rows: [],
      rowCount: res.affectedRows,
    };
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error("Not connected");
    const [tablesRows] = await this.pool.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `);

    const tables: SchemaTable[] = [];
    for (const row of tablesRows as any[]) {
      const [colsRows] = await this.pool.query(`
        SELECT
          c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT, c.COLUMN_KEY
        FROM information_schema.columns c
        WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
        ORDER BY c.ORDINAL_POSITION
      `, [row.table_schema, row.table_name]);

      const [fksRows] = await this.pool.query(`
        SELECT
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME
        FROM information_schema.key_column_usage kcu
        WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ?
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      `, [row.table_schema, row.table_name]);

      tables.push({
        name: row.table_name,
        schema: row.table_schema,
        columns: (colsRows as any[]).map((c) => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          defaultValue: c.COLUMN_DEFAULT,
          isPrimaryKey: c.COLUMN_KEY === "PRI",
        })),
        foreignKeys: (fksRows as any[]).map((fk) => ({
          column: fk.COLUMN_NAME,
          referencedTable: fk.REFERENCED_TABLE_NAME,
          referencedColumn: fk.REFERENCED_COLUMN_NAME,
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
