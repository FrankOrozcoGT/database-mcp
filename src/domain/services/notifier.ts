export interface Notifier {
  emit(event: string, data: Record<string, unknown>): void;
  requestAuth(connId: string, sql: string, env: string, timeoutMs?: number): Promise<boolean>;
  isConnected(): boolean;
}

let instance: Notifier | null = null;

export function setNotifier(notifier: Notifier): void {
  instance = notifier;
}

export function getNotifier(): Notifier {
  if (!instance) {
    return noopNotifier;
  }
  return instance;
}

const noopNotifier: Notifier = {
  emit() {},
  requestAuth() {
    return Promise.resolve(false);
  },
  isConnected() {
    return false;
  },
};
