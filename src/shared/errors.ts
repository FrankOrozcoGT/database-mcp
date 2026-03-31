export class DatabaseMcpError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "DatabaseMcpError";
  }
}

export class ConnectionError extends DatabaseMcpError {
  constructor(message: string) {
    super(message, "CONNECTION_ERROR");
    this.name = "ConnectionError";
  }
}

export class AuthRequiredError extends DatabaseMcpError {
  constructor(message: string = "Write operations on production require authorization") {
    super(message, "AUTH_REQUIRED");
    this.name = "AuthRequiredError";
  }
}

export class DriverNotFoundError extends DatabaseMcpError {
  constructor(driver: string) {
    super(`Driver not found: ${driver}`, "DRIVER_NOT_FOUND");
    this.name = "DriverNotFoundError";
  }
}

export class NotInitializedError extends DatabaseMcpError {
  constructor() {
    super("Project not initialized. Run init(path) first or use --project-path", "NOT_INITIALIZED");
    this.name = "NotInitializedError";
  }
}

export class ConnectionAlreadyActiveError extends DatabaseMcpError {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} is active. Disconnect first before editing`, "CONNECTION_ALREADY_ACTIVE");
    this.name = "ConnectionAlreadyActiveError";
  }
}
