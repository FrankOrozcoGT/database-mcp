import { getDb } from "../database/local.js";
import { TerminalConfig } from "../../domain/entities/terminal.js";

interface TerminalRow {
  id: string;
  project_id: string;
  connection_id: string;
  slot: number;
  command: string;
  label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToEntity(row: TerminalRow): TerminalConfig {
  return {
    id: row.id,
    projectId: row.project_id,
    connectionId: row.connection_id,
    slot: row.slot,
    command: row.command,
    label: row.label,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveTerminal(terminal: TerminalConfig): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO terminals (id, project_id, connection_id, slot, command, label, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    terminal.id,
    terminal.projectId,
    terminal.connectionId,
    terminal.slot,
    terminal.command,
    terminal.label,
    terminal.order,
    terminal.createdAt,
    terminal.updatedAt,
  );
}

export function saveBulk(terminals: TerminalConfig[]): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO terminals (id, project_id, connection_id, slot, command, label, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: TerminalConfig[]) => {
    for (const t of items) {
      insert.run(t.id, t.projectId, t.connectionId, t.slot, t.command, t.label, t.order, t.createdAt, t.updatedAt);
    }
  });

  insertMany(terminals);
}

export function findByConnection(projectId: string, connectionId: string): TerminalConfig[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM terminals WHERE project_id = ? AND connection_id = ? ORDER BY sort_order ASC",
  ).all(projectId, connectionId) as TerminalRow[];
  return rows.map(rowToEntity);
}

export function deleteTerminal(projectId: string, id: string): boolean {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM terminals WHERE project_id = ? AND id = ?",
  ).run(projectId, id);
  return result.changes > 0;
}

export function deleteByConnection(projectId: string, connectionId: string): number {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM terminals WHERE project_id = ? AND connection_id = ?",
  ).run(projectId, connectionId);
  return result.changes;
}
