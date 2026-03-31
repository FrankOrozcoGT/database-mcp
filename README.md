# @fcoder/database-mcp

MCP (Model Context Protocol) server for database management. Connect Claude and other AI agents to your PostgreSQL and MySQL databases with real-time visualization via WebSocket.

## Features

- **Multi-driver support**: PostgreSQL, MySQL
- **Dev/Prod environments**: Free access for dev, write authorization required for prod
- **Real-time WebSocket**: Bidirectional communication with frontend for table visualization, query results, and interactive operations
- **Pre-connection commands**: Configure terminal commands (SSH tunnels, kops, etc.) that run before database connection
- **Up to 3 configurable terminals**: Persistent terminal sessions for tunnels and other services
- **Cross-platform**: Linux and Windows support
- **Local SQLite storage**: Connection configs, terminal configs, and query history stored locally
- **Query history**: Track all executed queries with duration and results

## Installation

```bash
npm install @fcoder/database-mcp
```

## Usage with Claude

Add to your Claude MCP configuration:

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["@fcoder/database-mcp"]
    }
  }
}
```

## Architecture

Clean Architecture with feature-based organization:

- **Tools**: MCP tool definitions (query, schema, connection, terminal)
- **UseCases**: Business flow orchestration
- **Domain**: Pure business logic and entities
- **Infrastructure**: Database drivers, SQLite, WebSocket, platform abstraction

## License

[MIT](LICENSE)
