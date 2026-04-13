import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeQuery, getQueryHistory, clearQueryHistory } from "../usecases/executeQuery.js";

export function registerQueryTools(server: McpServer): void {
  server.tool(
    "execute_query",
    "Execute a SQL query on an active database connection. READ queries execute directly. WRITE queries on prod require authorization (via WebSocket).",
    {
      connectionId: z.string().describe("Connection ID (must be connected)"),
      sql: z.string().describe("SQL query to execute"),
    },
    async ({ connectionId, sql }) => {
      try {
        const result = await executeQuery(connectionId, sql);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_query_history",
    "Get query execution history for a connection. Returns most recent queries first.",
    {
      connectionId: z.string().describe("Connection ID"),
      limit: z.number().optional().describe("Max number of entries to return (default: 50)"),
    },
    async ({ connectionId, limit }) => {
      try {
        const history = getQueryHistory(connectionId, limit);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "clear_query_history",
    "Clear query execution history for a connection.",
    {
      connectionId: z.string().describe("Connection ID"),
    },
    async ({ connectionId }) => {
      try {
        const deleted = clearQueryHistory(connectionId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ cleared: deleted }) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}
