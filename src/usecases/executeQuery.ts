import { getProjectId } from "../domain/services/projectContext.js";
import { parseQueryType } from "../domain/services/queryParser.js";
import { requiresAuth } from "../domain/services/authGuard.js";
import * as pool from "../domain/services/connectionPool.js";
import { findById } from "../infrastructure/repositories/connection.repo.js";
import {
  saveQueryHistory,
  findByConnection,
  clearByConnection,
  QueryHistoryEntry,
} from "../infrastructure/repositories/queryHistory.repo.js";
import { QueryResult } from "../domain/entities/query.js";
import { ConnectionError, AuthRequiredError } from "../shared/errors.js";

export async function executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
  const projectId = getProjectId();

  // Get active driver from pool
  const entry = pool.getConnection(connectionId);
  if (!entry || !entry.driver.isConnected()) {
    throw new ConnectionError(`Connection ${connectionId} is not active. Connect first.`);
  }

  // Get connection config for env check
  const connConfig = findById(projectId, connectionId);
  if (!connConfig) {
    throw new ConnectionError(`Connection ${connectionId} not found.`);
  }

  // Parse query type and check auth
  const queryType = parseQueryType(sql);

  if (requiresAuth(connConfig.env, queryType)) {
    // WS auth flow comes in Task 4 — for now, block with error
    throw new AuthRequiredError();
  }

  // Execute with timing
  const startTime = Date.now();
  let historyEntry: QueryHistoryEntry;

  try {
    const result = await entry.driver.execute(sql);
    const durationMs = Date.now() - startTime;

    historyEntry = {
      projectId,
      connectionId,
      sqlText: sql,
      queryType,
      durationMs,
      rowCount: result.rowCount,
      error: null,
      executedAt: new Date().toISOString(),
    };
    saveQueryHistory(historyEntry);

    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      duration: durationMs,
      type: queryType,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

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
}

export function getQueryHistory(connectionId: string, limit?: number): QueryHistoryEntry[] {
  const projectId = getProjectId();
  return findByConnection(projectId, connectionId, limit);
}

export function clearQueryHistory(connectionId: string): number {
  const projectId = getProjectId();
  return clearByConnection(projectId, connectionId);
}
