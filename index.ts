import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

/**
 * MCP Server for Harvest using Personal Access Tokens (PAT)
 * Credentials can be provided via environment variables (HARVEST_ACCESS_TOKEN, HARVEST_ACCOUNT_ID)
 * or passed with each tool call for stateless operation.
 */

const server = new Server({
  name: "harvest-mcp",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
});

// Helper to create the Harvest API client dynamically
const createClient = (token: string, accountId: string) => axios.create({
  baseURL: "https://api.harvestapp.com/v2",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Harvest-Account-Id": accountId,
    "User-Agent": "MCP-Harvest-PAT (your-email@example.com)",
  },
});

// 1. Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_my_profile",
      description: "Verify credentials and get details of the authenticated user",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Harvest Personal Access Token (optional if set via env)" },
          account_id: { type: "string", description: "Harvest Account ID (optional if set via env)" },
        },
        required: [],
      },
    },
    {
      name: "list_active_projects",
      description: "List all active projects and their associated tasks",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Harvest Personal Access Token (optional if set via env)" },
          account_id: { type: "string", description: "Harvest Account ID (optional if set via env)" },
        },
        required: [],
      },
    },
    {
      name: "log_time",
      description: "Log time for a specific project and task",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Harvest Personal Access Token (optional if set via env)" },
          account_id: { type: "string", description: "Harvest Account ID (optional if set via env)" },
          project_id: { type: "number" },
          task_id: { type: "number" },
          hours: { type: "number", description: "Number of hours to log" },
          spent_date: { type: "string", description: "YYYY-MM-DD" },
          notes: { type: "string" },
        },
        required: ["project_id", "task_id", "hours"],
      },
    },
    {
      name: "get_time_entries",
      description: "Get time entries for a specific date or date range. Defaults to today if no dates specified.",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Harvest Personal Access Token (optional if set via env)" },
          account_id: { type: "string", description: "Harvest Account ID (optional if set via env)" },
          from: { type: "string", description: "Start date in YYYY-MM-DD format (defaults to today)" },
          to: { type: "string", description: "End date in YYYY-MM-DD format (defaults to 'from' date)" },
          project_id: { type: "number", description: "Filter by specific project ID (optional)" },
          user_id: { type: "number", description: "Filter by specific user ID (optional, defaults to current user)" },
        },
        required: [],
      },
    }
  ],
}));

// 2. Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Support both: credentials passed per-call OR from environment variables
  const accessToken = (args?.access_token as string) || process.env.HARVEST_ACCESS_TOKEN;
  const accountId = (args?.account_id as string) || process.env.HARVEST_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    return {
      isError: true,
      content: [{ type: "text", text: "Missing required credentials: access_token and account_id must be provided either as arguments or via HARVEST_ACCESS_TOKEN and HARVEST_ACCOUNT_ID environment variables." }]
    };
  }

  const client = createClient(accessToken, accountId);

  try {
    switch (name) {
      case "get_my_profile": {
        const res = await client.get("/users/me");
        return { content: [{ type: "text", text: `Authenticated as: ${res.data.first_name} ${res.data.last_name}` }] };
      }

      case "list_active_projects": {
        // Fetches project assignments for the user
        const res = await client.get("/users/me/project_assignments");
        return { content: [{ type: "text", text: JSON.stringify(res.data.project_assignments, null, 2) }] };
      }

      case "log_time": {
        const payload = {
          project_id: args?.project_id,
          task_id: args?.task_id,
          spent_date: args?.spent_date || new Date().toISOString().split('T')[0],
          hours: args?.hours,
          notes: args?.notes,
        };
        const res = await client.post("/time_entries", payload);
        return { content: [{ type: "text", text: `Success! Time entry created with ID: ${res.data.id}` }] };
      }

      case "get_time_entries": {
        const today = new Date().toISOString().split('T')[0];
        const fromDate = (args?.from as string) || today;
        const toDate = (args?.to as string) || fromDate;

        const params: any = {
          from: fromDate,
          to: toDate,
        };

        if (args?.project_id) {
          params.project_id = args.project_id;
        }

        if (args?.user_id) {
          params.user_id = args.user_id;
        }

        const res = await client.get("/time_entries", { params });

        const entries = res.data.time_entries;
        if (!entries || entries.length === 0) {
          const dateRange = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
          return { content: [{ type: "text", text: `No time entries found for ${dateRange}.` }] };
        }

        const totalHours = entries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
        const dateRange = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
        const summary = `Found ${entries.length} time ${entries.length === 1 ? 'entry' : 'entries'} for ${dateRange}:\n\nTotal hours: ${totalHours.toFixed(2)}\n\n${JSON.stringify(entries, null, 2)}`;

        return { content: [{ type: "text", text: summary }] };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
    const message = error.response?.data?.message || error.message;
    return {
      isError: true,
      content: [{ type: "text", text: `Harvest API Error: ${message}` }],
    };
  }
});

// 3. Start Server
const transport = new StdioServerTransport();
await server.connect(transport);