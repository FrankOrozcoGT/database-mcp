import { DbDriver, ConnectionEnv } from "../domain/types.js";

export type DaemonAction =
  | "connect"
  | "disconnect"
  | "execute"
  | "getSchema"
  | "status"
  | "statusAll"
  | "shutdown";

export interface ConnectPayload {
  connId: string;
  driver: DbDriver;
  env: ConnectionEnv;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  terminals: TerminalPayload[];
}

export interface TerminalPayload {
  id: string;
  label: string;
  command: string;
  slot: number;
  order: number;
}

export interface ExecutePayload {
  connId: string;
  sql: string;
}

export interface ConnIdPayload {
  connId: string;
}

export type DaemonRequest =
  | { action: "connect"; payload: ConnectPayload }
  | { action: "disconnect"; payload: ConnIdPayload }
  | { action: "execute"; payload: ExecutePayload }
  | { action: "getSchema"; payload: ConnIdPayload }
  | { action: "status"; payload: ConnIdPayload }
  | { action: "statusAll" }
  | { action: "shutdown" };

export interface DaemonResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}
