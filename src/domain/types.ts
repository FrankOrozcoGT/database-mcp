export type DbDriver = "postgres" | "mysql" | "mssql" | "sqlite";
export type ConnectionEnv = "dev" | "prod";
export type QueryType = "read" | "write";
export type TerminalStatus = "idle" | "running" | "stopped" | "error";
export type ConnectionStatus = "connected" | "disconnected" | "error";
