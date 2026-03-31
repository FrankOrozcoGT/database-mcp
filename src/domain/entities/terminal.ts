import { TerminalStatus } from "../types.js";

export interface TerminalConfig {
  id: string;
  connectionId: string;
  slot: number;
  command: string;
  label: string;
  order: number;
  status: TerminalStatus;
  createdAt: string;
  updatedAt: string;
}
