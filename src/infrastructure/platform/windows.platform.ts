import { SpawnOptions } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { PlatformService } from "./platform.interface.js";

export class WindowsPlatform implements PlatformService {
  osType = "windows" as const;

  shell(): string {
    return process.env.COMSPEC || "cmd.exe";
  }

  shellArgs(): string[] {
    return ["/c"];
  }

  spawnOptions(): SpawnOptions {
    return {
      shell: true,
      stdio: "pipe",
    };
  }

  resolvePath(...segments: string[]): string {
    return join(...segments);
  }

  homeDir(): string {
    return homedir();
  }

  dataDir(appName: string): string {
    return join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      appName,
    );
  }

  killProcess(pid: number): void {
    const { execSync } = require("child_process");
    execSync(`taskkill /PID ${pid} /T /F`);
  }

  pathSeparator(): string {
    return "\\";
  }
}
