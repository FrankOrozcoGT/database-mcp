import sql from "mssql";
import {
  DatabaseDriver,
  DriverConnectionConfig,
  QueryExecutionResult,
  SchemaInfo,
  SchemaTable,
} from "./driver.interface.js";

export class MssqlDriver implements DatabaseDriver {
  private pool: sql.ConnectionPool | null = null;
  private disconnectCallback: (() => void) | null = null;
  private connected = false;

  constructor(private config: DriverConnectionConfig) {}

  async connect(): Promise<void> {
    this.pool = new sql.ConnectionPool({
      server: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      options: {
        encrypt: this.config.ssl,
        trustServerCertificate: true,
      },
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    });

    this.pool.on("error", () => {
      this.connected = false;
      this.disconnectCallback?.();
    });

    await this.pool.connect();
    // Ping
    await this.pool.request().query("SELECT 1");
    this.connected = true;
  }

  async execute(sql_text: string, params?: unknown[]): Promise<QueryExecutionResult> {
    if (!this.pool) throw new Error("Not connected");
    const request = this.pool.request();

    if (params) {
      params.forEach((p, i) => {
        request.input(`p${i}`, p);
      });
    }

    const result = await request.query(sql_text);
    return {
      columns: result.recordset?.columns
        ? Object.keys(result.recordset.columns)
        : [],
      rows: result.recordset ?? [],
      rowCount: result.rowsAffected.reduce((a: number, b: number) => a + b, 0),
    };
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      this.connected = false;
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error("Not connected");
    const tablesResult = await this.pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    const tables: SchemaTable[] = [];
    for (const row of tablesResult.recordset) {
      const colsResult = await this.pool.request()
        .input("schema", row.TABLE_SCHEMA)
        .input("table", row.TABLE_NAME)
        .query(`
          SELECT
            c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PK
          FROM INFORMATION_SCHEMA.COLUMNS c
          LEFT JOIN (
            SELECT ku.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
            WHERE tc.TABLE_SCHEMA = @schema AND tc.TABLE_NAME = @table AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
          WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
          ORDER BY c.ORDINAL_POSITION
        `);

      const fksResult = await this.pool.request()
        .input("schema", row.TABLE_SCHEMA)
        .input("table", row.TABLE_NAME)
        .query(`
          SELECT
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
            OBJECT_NAME(fkc.referenced_object_id) AS referenced_table,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
          FROM sys.foreign_key_columns fkc
          JOIN sys.tables t ON fkc.parent_object_id = t.object_id
          JOIN sys.schemas s ON t.schema_id = s.schema_id
          WHERE s.name = @schema AND t.name = @table
        `);

      tables.push({
        name: row.TABLE_NAME,
        schema: row.TABLE_SCHEMA,
        columns: colsResult.recordset.map((c: any) => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          defaultValue: c.COLUMN_DEFAULT,
          isPrimaryKey: c.IS_PK === 1,
        })),
        foreignKeys: fksResult.recordset.map((fk: any) => ({
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
