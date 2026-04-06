import { QueryType, ConnectionStatus } from "../../domain/types.js";
import { SchemaTable } from "../drivers/driver.interface.js";

// --- Client → Server events ---

export interface ClientEvents {
  "schema:get": { connId: string };
  "query:execute": { connId: string; sql: string };
  "auth:approve": { requestId: string };
  "auth:deny": { requestId: string };
  "connection:test": { connId: string };
}

export type ClientEventName = keyof ClientEvents;

export interface ClientMessage<T extends ClientEventName = ClientEventName> {
  event: T;
  data: ClientEvents[T];
}

// --- Server → Client events ---

export interface ServerEvents {
  "welcome": { projectId: string };
  "schema:tables": { connId: string; tables: SchemaTable[] };
  "query:result": { connId: string; columns: string[]; rows: Record<string, unknown>[]; rowCount: number; duration: number; type: QueryType };
  "query:error": { connId: string; error: string };
  "auth:request": { requestId: string; connId: string; sql: string; env: string };
  "auth:resolved": { requestId: string; approved: boolean };
  "connection:status": { connId: string; status: ConnectionStatus };
  "terminal:output": { connId: string; terminalId: string; data: string };
  "error": { message: string; code?: string };
}

export type ServerEventName = keyof ServerEvents;

export interface ServerMessage<T extends ServerEventName = ServerEventName> {
  event: T;
  data: ServerEvents[T];
}
