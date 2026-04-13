export interface DatabaseDriver {
  connect(): Promise<void>;
  execute(sql: string, params?: unknown[]): Promise<QueryExecutionResult>;
  disconnect(): Promise<void>;
  getSchema(): Promise<SchemaInfo>;
  onDisconnect(callback: () => void): void;
  isConnected(): boolean;
}

export interface QueryExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface SchemaForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface SchemaInfo {
  tables: SchemaTable[];
}

export interface DriverConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}
