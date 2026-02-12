# Harvest MCP Server

A Model Context Protocol (MCP) server that integrates with the [Harvest](https://www.getharvest.com/) time tracking API. This server enables AI assistants like Claude to interact with your Harvest account to check projects, tasks, and log time entries.

## Features

- **Verify credentials** and retrieve authenticated user information
- **List active projects** with their associated tasks
- **Retrieve time entries** for any date or date range with optional project/user filtering
- **Log time entries** for specific projects and tasks
- **Start/stop/restart timers** to track time in real-time
- **Delete time entries** when needed
- **Flexible authentication**: Supports both environment variables and per-call credentials

## Prerequisites

- Node.js (v16 or higher recommended)
- A Harvest account with API access
- Harvest Personal Access Token and Account ID

### Getting Harvest Credentials

1. Log in to your Harvest account
2. Go to **Settings** → **Developers**
3. Create a new **Personal Access Token**
4. Note your **Account ID** (visible in the URL or the token creation page)

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd harvest-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Configuration

### Option 1: Environment Variables (Recommended for MCP)

Configure the server in your MCP client (e.g., Claude Desktop):

**Claude Desktop** (`~/.claude.json` or `%APPDATA%/Claude/config.json` on Windows):

```json
{
  "mcpServers": {
    "harvest": {
      "command": "node",
      "args": ["/absolute/path/to/harvest-mcp/build/index.js"],
      "env": {
        "HARVEST_ACCESS_TOKEN": "your-token-here",
        "HARVEST_ACCOUNT_ID": "your-account-id"
      }
    }
  }
}
```

**Important**:
- Use the absolute path to `build/index.js`
- Restart Claude Desktop after modifying the config
- Rebuild the project (`npm run build`) after any code changes

### Option 2: Per-Call Credentials (Stateless Mode)

If you prefer not to use environment variables, you can pass credentials with each tool invocation:

```typescript
{
  "access_token": "your-token-here",
  "account_id": "your-account-id"
}
```

## Available Tools

### `get_my_profile`

Verify credentials and retrieve information about the authenticated user.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID

**Example Response:**
```
Authenticated as: John Doe
```

### `get_time_entries`

Retrieve time entries for a specific date or date range. Supports filtering by project and user.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `from` (optional): Start date in YYYY-MM-DD format (defaults to today)
- `to` (optional): End date in YYYY-MM-DD format (defaults to the `from` date)
- `project_id` (optional): Filter entries for a specific project
- `user_id` (optional): Filter entries for a specific user (defaults to current user)

**Example Usage:**

Get today's entries:
```json
{}
```

Get entries for a specific date:
```json
{
  "from": "2026-02-01"
}
```

Get entries for a date range:
```json
{
  "from": "2026-02-01",
  "to": "2026-02-05"
}
```

Get this week's entries for a specific project:
```json
{
  "from": "2026-02-03",
  "to": "2026-02-07",
  "project_id": 67890
}
```

**Example Response:**
```
Found 3 time entries for 2026-02-04:

Total hours: 6.50

[
  {
    "id": 123456789,
    "spent_date": "2026-02-04",
    "hours": 2.5,
    "notes": "Implemented user authentication",
    "project": {
      "id": 67890,
      "name": "My Project"
    },
    "task": {
      "id": 222,
      "name": "Development"
    }
  },
  ...
]
```

### `list_active_projects`

List all active projects assigned to the authenticated user, including their associated tasks. Returns a concise, readable format by default to minimize context usage.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `format` (optional): Output format - `'compact'` (default) for concise view or `'full'` for complete JSON

**Example Response (Compact Format - Default):**
```
Client: Acme Corp
  → Website Redesign (project_id: 14308070)
     Tasks: Design (8083367), Development (8083368), Testing (8083369)

Client: 123 Industries
  → Online Store - Phase 1 (project_id: 14308069)
     Tasks: Graphic Design (8083365), Programming (8083366)
```

**Example Response (Full Format):**
```json
[
  {
    "id": 12345,
    "project": {
      "id": 67890,
      "name": "My Project",
      "code": "PROJ"
    },
    "task_assignments": [
      {
        "id": 111,
        "task": {
          "id": 222,
          "name": "Development"
        }
      }
    ],
    "is_project_manager": false,
    "budget": null,
    ...
  }
]
```

### `log_time`

Create a time entry for a specific project and task.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `project_id` (required): Project ID
- `task_id` (required): Task ID
- `hours` (required): Number of hours to log
- `spent_date` (optional): Date in YYYY-MM-DD format (defaults to today)
- `notes` (optional): Description of the work performed

**Example Usage:**
```json
{
  "project_id": 67890,
  "task_id": 222,
  "hours": 2.5,
  "spent_date": "2026-02-04",
  "notes": "Implemented user authentication"
}
```

**Example Response:**
```
Success! Time entry created with ID: 123456789
```

### `start_timer`

Start a running timer for a specific project and task. The timer will track time until stopped.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `project_id` (required): Project ID
- `task_id` (required): Task ID
- `spent_date` (optional): Date in YYYY-MM-DD format or relative date (defaults to today)
- `notes` (optional): Description of the work being performed

**Example Usage:**
```json
{
  "project_id": 67890,
  "task_id": 222,
  "notes": "Working on user authentication"
}
```

**Example Response:**
```
Success! Timer started with ID: 123456789
```

### `stop_timer`

Stop a running timer. This uses Harvest's dedicated `/stop` endpoint to calculate hours based on elapsed time.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `time_entry_id` (required): The ID of the running timer to stop

**Example Usage:**
```json
{
  "time_entry_id": 123456789
}
```

**Example Response:**
```
Success! Timer stopped.

Project: My Project
Task: Development
Total time logged: 2.5 hours
Date: 2026-02-12
```

### `restart_timer`

Restart a previously stopped timer. This uses Harvest's dedicated `/restart` endpoint to resume tracking.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `time_entry_id` (required): The ID of the stopped timer to restart

**Example Usage:**
```json
{
  "time_entry_id": 123456789
}
```

**Example Response:**
```
Success! Timer restarted.

ID: 123456789
Project: My Project
Task: Development
Date: 2026-02-12
```

### `get_running_timer`

Check if there's a timer currently running and see elapsed time.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID

**Example Response:**
```
Timer is running:

ID: 123456789
Project: My Project
Task: Development
Notes: Working on user authentication
Elapsed: 1h 23m

[detailed JSON data]
```

### `delete_time_entry`

Delete a specific time entry.

**Parameters:**
- `access_token` (optional): Harvest Personal Access Token
- `account_id` (optional): Harvest Account ID
- `time_entry_id` (required): The ID of the time entry to delete

**Example Usage:**
```json
{
  "time_entry_id": 123456789
}
```

**Example Response:**
```
Success! Time entry 123456789 has been deleted.
```

## Development

### Build the project
```bash
npm run build
```

### Run in development mode (with ts-node)
```bash
npm run dev
```

### Type checking only
```bash
npx tsc --noEmit
```

### Project Structure

```
harvest-mcp/
├── index.ts          # Main server implementation
├── build/            # Compiled JavaScript output
│   └── index.js      # Entry point for MCP clients
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## Usage with Claude Desktop

Once configured, you can use natural language to interact with Harvest:

**Example interactions:**
- "What projects am I assigned to in Harvest?"
- "Show me my time entries for today"
- "How many hours have I logged today?"
- "Show me my time entries for last Monday" (2026-02-03)
- "Get all time entries from February 1st to February 5th"
- "Show me time entries for project 67890 this week"
- "Log 3 hours to project 12345, task 222 with notes 'Fixed authentication bug'"
- "Start a timer for project 67890, task 222"
- "Is a timer running?"
- "Stop my current timer"
- "Restart timer 123456789"
- "Delete time entry 123456789"
- "Show me my Harvest profile"

## Troubleshooting

### Server not connecting
- Ensure the build step completed successfully (`npm run build`)
- Verify the absolute path in your MCP config points to `build/index.js`
- Restart your MCP client after configuration changes

### Authentication errors
- Double-check your Personal Access Token and Account ID
- Ensure credentials are correctly set in environment variables or passed with tool calls
- Verify your Harvest account has API access enabled

### Missing projects or tasks
- Ensure you're assigned to the projects in Harvest
- Only active projects are returned by `list_active_projects`
- Check that your user has the necessary permissions

## API Reference

This server uses the [Harvest API v2](https://help.getharvest.com/api-v2/). Key endpoints:

- `GET /users/me` - Current user information
- `GET /users/me/project_assignments` - User's project assignments
- `GET /time_entries` - Retrieve time entries
- `POST /time_entries` - Create a time entry or start a timer
- `PATCH /time_entries/{id}/stop` - Stop a running timer
- `PATCH /time_entries/{id}/restart` - Restart a stopped timer
- `DELETE /time_entries/{id}` - Delete a time entry

## License

ISC

## Author

Sebastiaan Pfennigwerth

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.