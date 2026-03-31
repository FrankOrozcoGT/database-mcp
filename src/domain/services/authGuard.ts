import { ConnectionEnv, QueryType } from "../types.js";

export function requiresAuth(env: ConnectionEnv, queryType: QueryType): boolean {
  return env === "prod" && queryType === "write";
}
