import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createConnection,
  listConnections,
  getConnection,
  editConnection,
  removeConnection,
  connectToDatabase,
  disconnectFromDatabase,
} from "../usecases/manageConnection.js";

const driverEnum = z.enum(["postgres", "mysql", "mssql", "sqlite"]);
const envEnum = z.enum(["dev", "prod"]);

export function registerConnectionTools(server: McpServer): void {
  server.tool(
    "create_connection",
    "Create a new database connection configuration. Password is encrypted before storage.",
    {
      name: z.string().describe("Connection display name"),
      driver: driverEnum.describe("Database driver"),
      env: envEnum.describe("Environment: dev or prod"),
      host: z.string().describe("Database host"),
      port: z.number().describe("Database port"),
      database: z.string().describe("Database name"),
      username: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      ssl: z.boolean().optional().describe("Enable SSL (default: false)"),
      preCommands: z.array(z.string()).optional().describe("Commands to run before connecting"),
    },
    async (params) => {
      try {
        const conn = createConnection(params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(conn, null, 2) }],
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
    "list_connections",
    "List all database connections for the current project with their real-time status.",
    {},
    async () => {
      try {
        const connections = await listConnections();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(connections, null, 2) }],
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
    "get_connection",
    "Get a specific database connection by ID with its real-time status.",
    {
      id: z.string().describe("Connection ID"),
    },
    async ({ id }) => {
      try {
        const conn = await getConnection(id);
        if (!conn) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Connection not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(conn, null, 2) }],
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
    "update_connection",
    "Update a database connection configuration. Cannot update if connection is active — disconnect first.",
    {
      id: z.string().describe("Connection ID"),
      name: z.string().optional().describe("New display name"),
      driver: driverEnum.optional().describe("New database driver"),
      env: envEnum.optional().describe("New environment"),
      host: z.string().optional().describe("New host"),
      port: z.number().optional().describe("New port"),
      database: z.string().optional().describe("New database name"),
      username: z.string().optional().describe("New username"),
      password: z.string().optional().describe("New password"),
      ssl: z.boolean().optional().describe("New SSL setting"),
      preCommands: z.array(z.string()).optional().describe("New pre-commands"),
    },
    async ({ id, ...updates }) => {
      try {
        const conn = await editConnection(id, updates);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(conn, null, 2) }],
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
    "delete_connection",
    "Delete a database connection. If active, disconnects first. CASCADE deletes associated terminals.",
    {
      id: z.string().describe("Connection ID"),
    },
    async ({ id }) => {
      try {
        const deleted = await removeConnection(id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted, id }),
            },
          ],
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
    "connect_to_database",
    "Connect to a database. Opens a persistent connection that stays alive for queries. Reuses if already connected.",
    {
      id: z.string().describe("Connection ID"),
    },
    async ({ id }) => {
      try {
        const result = await connectToDatabase(id);
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
    "disconnect_from_database",
    "Disconnect from a database. Closes driver, kills associated terminals, removes from pool.",
    {
      id: z.string().describe("Connection ID"),
    },
    async ({ id }) => {
      try {
        const result = await disconnectFromDatabase(id);
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
}
