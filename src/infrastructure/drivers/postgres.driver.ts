import pg from "pg";
import {
  DatabaseDriver,
  DriverConnectionConfig,
  QueryExecutionResult,
  SchemaInfo,
  SchemaTable,
} from "./driver.interface.js";

export class PostgresDriver implements DatabaseDriver {
  private pool: pg.Pool | null = null;
  private disconnectCallback: (() => void) | null = null;
  private connected = false;

  constructor(private config: DriverConnectionConfig) {}

  async connect(): Promise<void> {
    this.pool = new pg.Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 0,
    });

    this.pool.on("error", () => {
      this.connected = false;
      this.disconnectCallback?.();
    });

    // Ping to verify connection
    const client = await this.pool.connect();
    await client.query("SELECT 1");
    client.release();
    this.connected = true;
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryExecutionResult> {
    if (!this.pool) throw new Error("Not connected");
    const result = await this.pool.query(sql, params);
    return {
      columns: result.fields?.map((f) => f.name) ?? [],
      rows: result.rows ?? [],
      rowCount: result.rowCount ?? 0,
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
    const tablesResult = await this.pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    const tables: SchemaTable[] = [];
    for (const row of tablesResult.rows) {
      const colsResult = await this.pool.query(`
        SELECT
          c.column_name, c.data_type, c.is_nullable, c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.column_name = c.column_name
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
      `, [row.table_schema, row.table_name]);

      const fksResult = await this.pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
      `, [row.table_schema, row.table_name]);

      tables.push({
        name: row.table_name,
        schema: row.table_schema,
        columns: colsResult.rows.map((c: any) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === "YES",
          defaultValue: c.column_default,
          isPrimaryKey: c.is_pk,
        })),
        foreignKeys: fksResult.rows.map((fk: any) => ({
          column: fk.column_name,
          referencedTable: fk.referenced_table,
          referencedColumn: fk.referenced_column,
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
