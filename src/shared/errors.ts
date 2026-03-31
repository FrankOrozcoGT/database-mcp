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
