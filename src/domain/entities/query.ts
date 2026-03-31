import { QueryType } from "../types.js";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
  type: QueryType;
}
