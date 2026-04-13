import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProjectId } from "../domain/services/projectContext.js";
import { send } from "../infrastructure/ipc/client.js";
import { SchemaTable } from "../infrastructure/drivers/driver.interface.js";

export function registerSchemaTools(server: McpServer): void {
  server.tool(
    "get_tables",
    "Get all tables with their columns, types, and foreign keys from an active database connection.",
    {
      connectionId: z.string().describe("Connection ID (must be connected)"),
    },
    async ({ connectionId }) => {
      try {
        getProjectId(); // Ensure initialized
        const response = await send({ action: "getSchema", payload: { connId: connectionId } });
        if (!response.ok) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: response.error }) }],
            isError: true,
          };
        }

        const data = response.data as { tables: SchemaTable[] };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data.tables.map((t) => ({ name: t.name, schema: t.schema, columnCount: t.columns.length, fkCount: t.foreignKeys.length })), null, 2) }],
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
    "get_table_detail",
    "Get detailed schema information for a specific table: columns, types, nullable, defaults, primary keys, foreign keys.",
    {
      connectionId: z.string().describe("Connection ID (must be connected)"),
      tableName: z.string().describe("Table name to get details for"),
    },
    async ({ connectionId, tableName }) => {
      try {
        getProjectId(); // Ensure initialized
        const response = await send({ action: "getSchema", payload: { connId: connectionId } });
        if (!response.ok) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: response.error }) }],
            isError: true,
          };
        }

        const data = response.data as { tables: SchemaTable[] };
        const table = data.tables.find((t) => t.name === tableName);
        if (!table) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Table ${tableName} not found` }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(table, null, 2) }],
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
