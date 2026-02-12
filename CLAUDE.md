# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for the Harvest time tracking API. It supports two credential modes:
1. **Environment variables**: Set `HARVEST_ACCESS_TOKEN` and `HARVEST_ACCOUNT_ID` once (recommended for MCP integration)
2. **Per-call credentials**: Pass credentials with each tool invocation (stateless mode)

## Development Commands

Build TypeScript to JavaScript:
```bash
npm run build
```

Run the compiled server:
```bash
npm start
```

Development mode (with ts-node):
```bash
npm run dev
```

TypeScript compilation (for type checking):
```bash
npx tsc --noEmit
```

## Architecture

### MCP Server Implementation

The server is built using `@modelcontextprotocol/sdk` and runs over stdio transport. Key architectural decisions:

- **Flexible credential handling**: Credentials can be provided via environment variables or per-call arguments (lines 81-82)
- **Single-file structure**: All server logic lives in `index.ts`, compiled to `build/index.js`
- **Dynamic client creation**: Each tool call creates a fresh axios client with the credentials using `createClient()`
- **ES modules**: The project uses `"type": "module"` in package.json and ES module syntax throughout

### Tool Structure

All tools follow the same pattern:
1. Validate credentials in the request handler (lines 79-84)
2. Create an axios client with the provided token and account ID
3. Execute the Harvest API request
4. Return formatted response or error

Available tools:
- `get_my_profile`: Verify credentials and retrieve authenticated user info
- `list_active_projects`: Get user's project assignments with associated tasks
- `log_time`: Create a time entry for a specific project/task with hours specified
- `get_time_entries`: Retrieve time entries for a date or date range
- `delete_time_entry`: Delete a specific time entry
- `start_timer`: Start a running timer for a project/task (tracks time until stopped)
- `stop_timer`: Stop a running timer using the /stop endpoint and finalize the hours
- `restart_timer`: Restart a previously stopped timer using the /restart endpoint
- `get_running_timer`: Check if a timer is currently running and see elapsed time

### Harvest API Integration

- Base URL: `https://api.harvestapp.com/v2`
- Authentication: Bearer token + `Harvest-Account-Id` header
- User-Agent is set to `MCP-Harvest-PAT (your-email@example.com)` (should be customized)

### Error Handling

Errors from the Harvest API are caught and returned as MCP error responses with the message extracted from either `error.response.data.message` or `error.message` (lines 116-122).

## MCP Configuration

In Claude Code's config (`~/.claude.json`), the server should be configured as:

```json
{
  "mcpServers": {
    "harvest": {
      "command": "node",
      "args": ["/path/to/harvest-mcp/build/index.js"],
      "env": {
        "HARVEST_ACCESS_TOKEN": "your-token-here",
        "HARVEST_ACCOUNT_ID": "your-account-id"
      }
    }
  }
}
```

## Configuration Notes

- The server must be built (`npm run build`) before use - the MCP config points to the compiled JavaScript in `build/index.js`, not the TypeScript source
- The `User-Agent` header in `createClient()` (line 24) includes a placeholder email that should be updated to match the actual user/organization deploying this server
- After rebuilding, restart Claude Code to pick up the new compiled version