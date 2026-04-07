import { getProjectId } from "../domain/services/projectContext.js";
import { parseQueryType } from "../domain/services/queryParser.js";
import { requiresAuth } from "../domain/services/authGuard.js";
import { findById } from "../infrastructure/repositories/connection.repo.js";
import {
  saveQueryHistory,
  findByConnection,
  clearByConnection,
  QueryHistoryEntry,
} from "../infrastructure/repositories/queryHistory.repo.js";
import { QueryResult } from "../domain/entities/query.js";
import { ConnectionError, AuthRequiredError } from "../shared/errors.js";
import { getNotifier } from "../domain/services/notifier.js";
import { send } from "../infrastructure/ipc/client.js";

export async function executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
  const projectId = getProjectId();

  // Get connection config for env check
  const connConfig = findById(projectId, connectionId);
  if (!connConfig) {
    throw new ConnectionError(`Connection ${connectionId} not found.`);
  }

  // Parse query type and check auth
  const queryType = parseQueryType(sql);

  if (requiresAuth(connConfig.env, queryType)) {
    const notifier = getNotifier();
    if (!notifier.isConnected()) {
      throw new AuthRequiredError("Write operations on production require authorization. Not connected to wrapper.");
    }

    const approved = await notifier.requestAuth(connectionId, sql, connConfig.env);
    if (!approved) {
      throw new AuthRequiredError("Write operation on production was denied or timed out.");
    }
  }

  // Execute via daemon
  const startTime = Date.now();
  let historyEntry: QueryHistoryEntry;

  const response = await send({ action: "execute", payload: { connId: connectionId, sql } });
  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errorMessage = response.error ?? "Query execution failed";

    historyEntry = {
      projectId,
      connectionId,
      sqlText: sql,
      queryType,
      durationMs,
      rowCount: 0,
      error: errorMessage,
      executedAt: new Date().toISOString(),
    };
    saveQueryHistory(historyEntry);

    throw new ConnectionError(`Query error: ${errorMessage}`);
  }

  const data = response.data as { columns: string[]; rows: Record<string, unknown>[]; rowCount: number };

  historyEntry = {
    projectId,
    connectionId,
    sqlText: sql,
    queryType,
    durationMs,
    rowCount: data.rowCount,
    error: null,
    executedAt: new Date().toISOString(),
  };
  saveQueryHistory(historyEntry);

  return {
    columns: data.columns,
    rows: data.rows,
    rowCount: data.rowCount,
    duration: durationMs,
    type: queryType,
  };
}

export function getQueryHistory(connectionId: string, limit?: number): QueryHistoryEntry[] {
  const projectId = getProjectId();
  return findByConnection(projectId, connectionId, limit);
}

export function clearQueryHistory(connectionId: string): number {
  const projectId = getProjectId();
  return clearByConnection(projectId, connectionId);
}
