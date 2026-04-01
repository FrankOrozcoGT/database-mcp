import { spawn, ChildProcess } from "child_process";
import { getPlatform } from "../platform/index.js";
import { TerminalConfig } from "../../domain/entities/terminal.js";

interface RunningTerminal {
  config: TerminalConfig;
  process: ChildProcess;
  pid: number;
}

const runningTerminals = new Map<string, RunningTerminal[]>();

export function launchAll(
  connectionId: string,
  terminals: TerminalConfig[],
): number[] {
  const platform = getPlatform();
  const sorted = [...terminals].sort((a, b) => a.order - b.order);
  const pids: number[] = [];
  const running: RunningTerminal[] = [];

  for (const terminal of sorted) {
    const child = spawn(platform.shell(), [...platform.shellArgs(), terminal.command], {
      stdio: "pipe",
      detached: false,
    });

    if (!child.pid) {
      // Failed to spawn — kill any already launched
      for (const r of running) {
        safeKill(r.pid);
      }
      throw new Error(`Failed to spawn terminal "${terminal.label}" (slot ${terminal.slot})`);
    }

    pids.push(child.pid);
    running.push({ config: terminal, process: child, pid: child.pid });

    child.on("exit", () => {
      const current = runningTerminals.get(connectionId);
      if (current) {
        const idx = current.findIndex((r) => r.pid === child.pid);
        if (idx !== -1) current.splice(idx, 1);
        if (current.length === 0) runningTerminals.delete(connectionId);
      }
    });
  }

  runningTerminals.set(connectionId, running);
  return pids;
}

export function killAll(connectionId: string): void {
  const running = runningTerminals.get(connectionId);
  if (!running) return;

  // Kill in reverse order
  const reversed = [...running].reverse();
  for (const r of reversed) {
    safeKill(r.pid);
  }
  runningTerminals.delete(connectionId);
}

export function killOne(connectionId: string, terminalId: string): void {
  const running = runningTerminals.get(connectionId);
  if (!running) return;

  const idx = running.findIndex((r) => r.config.id === terminalId);
  if (idx !== -1) {
    safeKill(running[idx].pid);
    running.splice(idx, 1);
    if (running.length === 0) runningTerminals.delete(connectionId);
  }
}

export function restart(connectionId: string, terminalId: string): number | null {
  const running = runningTerminals.get(connectionId);
  if (!running) return null;

  const idx = running.findIndex((r) => r.config.id === terminalId);
  if (idx === -1) return null;

  const terminal = running[idx];
  safeKill(terminal.pid);

  const platform = getPlatform();
  const child = spawn(platform.shell(), [...platform.shellArgs(), terminal.config.command], {
    stdio: "pipe",
    detached: false,
  });

  if (!child.pid) return null;

  running[idx] = { config: terminal.config, process: child, pid: child.pid };

  child.on("exit", () => {
    const current = runningTerminals.get(connectionId);
    if (current) {
      const i = current.findIndex((r) => r.pid === child.pid);
      if (i !== -1) current.splice(i, 1);
      if (current.length === 0) runningTerminals.delete(connectionId);
    }
  });

  return child.pid;
}

export function getRunningPids(connectionId: string): number[] {
  const running = runningTerminals.get(connectionId);
  return running?.map((r) => r.pid) ?? [];
}

export function killAllConnections(): void {
  for (const [connId] of runningTerminals) {
    killAll(connId);
  }
}

function safeKill(pid: number): void {
  try {
    getPlatform().killProcess(pid);
  } catch {
    // Process already dead
  }
}
