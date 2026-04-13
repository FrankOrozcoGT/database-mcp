import { NotInitializedError } from "../../shared/errors.js";

let projectId: string | null = null;

export function setProjectId(id: string): void {
  projectId = id;
}

export function getProjectId(): string {
  if (!projectId) {
    throw new NotInitializedError();
  }
  return projectId;
}

export function isInitialized(): boolean {
  return projectId !== null;
}
