import { getDb } from "../database/local.js";
import { QueryType } from "../../domain/types.js";

export interface QueryHistoryEntry {
  id?: number;
  projectId: string;
  connectionId: string;
  sqlText: string;
  queryType: QueryType;
  durationMs: number;
  rowCount: number;
  error: string | null;
  executedAt: string;
}

interface QueryHistoryRow {
  id: number;
  project_id: string;
  connection_id: string;
  sql_text: string;
  query_type: string;
  duration_ms: number;
  row_count: number;
  error: string | null;
  executed_at: string;
}

function rowToEntry(row: QueryHistoryRow): QueryHistoryEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    connectionId: row.connection_id,
    sqlText: row.sql_text,
    queryType: row.query_type as QueryType,
    durationMs: row.duration_ms,
    rowCount: row.row_count,
    error: row.error,
    executedAt: row.executed_at,
  };
}

export function saveQueryHistory(entry: QueryHistoryEntry): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO query_history (project_id, connection_id, sql_text, query_type, duration_ms, row_count, error, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.projectId,
    entry.connectionId,
    entry.sqlText,
    entry.queryType,
    entry.durationMs,
    entry.rowCount,
    entry.error,
    entry.executedAt,
  );
}

export function findByConnection(projectId: string, connectionId: string, limit: number = 50): QueryHistoryEntry[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM query_history WHERE project_id = ? AND connection_id = ? ORDER BY executed_at DESC LIMIT ?",
  ).all(projectId, connectionId, limit) as QueryHistoryRow[];
  return rows.map(rowToEntry);
}

export function clearByConnection(projectId: string, connectionId: string): number {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM query_history WHERE project_id = ? AND connection_id = ?",
  ).run(projectId, connectionId);
  return result.changes;
}
