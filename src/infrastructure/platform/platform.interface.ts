import { SpawnOptions } from "child_process";

export interface PlatformService {
  osType: "linux" | "windows";
  shell(): string;
  shellArgs(): string[];
  spawnOptions(): SpawnOptions;
  resolvePath(...segments: string[]): string;
  homeDir(): string;
  dataDir(appName: string): string;
  killProcess(pid: number): void;
  pathSeparator(): string;
}
