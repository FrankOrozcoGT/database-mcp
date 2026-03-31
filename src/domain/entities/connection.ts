import { ConnectionEnv, DbDriver } from "../types.js";

export interface ConnectionConfig {
  id: string;
  name: string;
  driver: DbDriver;
  env: ConnectionEnv;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  preCommands: string[];
  createdAt: string;
  updatedAt: string;
}
