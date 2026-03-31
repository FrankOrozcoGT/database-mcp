import { SpawnOptions } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { PlatformService } from "./platform.interface.js";

export class LinuxPlatform implements PlatformService {
  osType = "linux" as const;

  shell(): string {
    return process.env.SHELL || "/bin/bash";
  }

  shellArgs(): string[] {
    return ["-c"];
  }

  spawnOptions(): SpawnOptions {
    return {
      shell: this.shell(),
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
      process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
      appName,
    );
  }

  killProcess(pid: number): void {
    process.kill(pid, "SIGTERM");
  }

  pathSeparator(): string {
    return "/";
  }
}
