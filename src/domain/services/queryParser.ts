import { QueryType } from "../types.js";

const WRITE_PATTERNS = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE)\b/i;

export function parseQueryType(sql: string): QueryType {
  return WRITE_PATTERNS.test(sql.trim()) ? "write" : "read";
}
