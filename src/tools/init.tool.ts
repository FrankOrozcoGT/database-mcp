import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { setProjectId, isInitialized } from "../domain/services/projectContext.js";

interface FcoderConfig {
  projectId: string;
  projectName?: string;
}

function loadProjectId(projectPath: string): string {
  const configPath = join(projectPath, ".fcoder", "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  const raw = readFileSync(configPath, "utf-8");
  const config: FcoderConfig = JSON.parse(raw);
  if (!config.projectId) {
    throw new Error("projectId not found in .fcoder/config.json");
  }
  return config.projectId;
}

export function registerInitTool(server: McpServer): void {
  server.tool(
    "init",
    "Initialize the MCP with a project path. Reads .fcoder/config.json to load projectId.",
    { path: z.string().describe("Absolute path to the project directory") },
    async ({ path }) => {
      try {
        const projectId = loadProjectId(path);
        setProjectId(projectId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ projectId, initialized: true }),
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
}

export function tryInitFromArgs(args: string[]): boolean {
  const idx = args.indexOf("--project-path");
  if (idx === -1 || idx + 1 >= args.length) return false;

  const projectPath = args[idx + 1];
  try {
    const projectId = loadProjectId(projectPath);
    setProjectId(projectId);
    return true;
  } catch {
    return false;
  }
}
