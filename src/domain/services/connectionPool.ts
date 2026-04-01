import { DatabaseDriver } from "../../infrastructure/drivers/driver.interface.js";
import { ConnectionStatus } from "../types.js";

export interface PoolEntry {
  connectionId: string;
  driver: DatabaseDriver;
  terminalPids: number[];
}

const pool = new Map<string, PoolEntry>();

export function registerConnection(
  connectionId: string,
  driver: DatabaseDriver,
  terminalPids: number[],
): void {
  pool.set(connectionId, { connectionId, driver, terminalPids });
}

export function removeConnection(connectionId: string): PoolEntry | undefined {
  const entry = pool.get(connectionId);
  pool.delete(connectionId);
  return entry;
}

export function getConnection(connectionId: string): PoolEntry | undefined {
  return pool.get(connectionId);
}

export function isActive(connectionId: string): boolean {
  const entry = pool.get(connectionId);
  return entry?.driver.isConnected() ?? false;
}

export function getStatus(connectionId: string): ConnectionStatus {
  const entry = pool.get(connectionId);
  if (!entry) return "disconnected";
  return entry.driver.isConnected() ? "connected" : "error";
}

export function getAllActive(): PoolEntry[] {
  return Array.from(pool.values()).filter((e) => e.driver.isConnected());
}

export function updateTerminalPids(connectionId: string, pids: number[]): void {
  const entry = pool.get(connectionId);
  if (entry) {
    entry.terminalPids = pids;
  }
}

export function clearPool(): void {
  pool.clear();
}
