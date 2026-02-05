import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { z } from "zod";

/**
 * MCP Server for Harvest using Personal Access Tokens (PAT)
 * Credentials can be provided via environment variables (HARVEST_ACCESS_TOKEN, HARVEST_ACCOUNT_ID)
 * or passed with each tool call for stateless operation.
 */

const server = new McpServer({
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

/**
 * Parse a relative date string and return YYYY-MM-DD format
 * Supports:
 * - "today" or "now"
 * - "yesterday"
 * - "tomorrow"
 * - "N days ago" (e.g., "3 days ago")
 * - "N weeks ago" (e.g., "2 weeks ago")
 * - "N months ago" (e.g., "1 month ago")
 * - "last monday", "last tuesday", etc.
 * - "this monday", "this tuesday", etc.
 * - Already formatted dates (YYYY-MM-DD) are returned as-is
 */
const parseRelativeDate = (input: string): string => {
  const normalized = input.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If it's already in YYYY-MM-DD format, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // Today / Now
  if (normalized === "today" || normalized === "now") {
    return formatDate(today);
  }

  // Yesterday
  if (normalized === "yesterday") {
    return formatDate(addDays(today, -1));
  }

  // Tomorrow
  if (normalized === "tomorrow") {
    return formatDate(addDays(today, 1));
  }

  // N days/weeks/months ago
  const agoMatch = normalized.match(/^(\d+)\s+(day|week|month)s?\s+ago$/);
  if (agoMatch) {
    const amount = parseInt(agoMatch[1]!);
    const unit = agoMatch[2]!;

    if (unit === "day") {
      return formatDate(addDays(today, -amount));
    } else if (unit === "week") {
      return formatDate(addDays(today, -amount * 7));
    } else if (unit === "month") {
      return formatDate(addMonths(today, -amount));
    }
  }

  // Last/This [weekday]
  const weekdayMatch = normalized.match(/^(last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (weekdayMatch) {
    const modifier = weekdayMatch[1]!;
    const targetDay = weekdayMatch[2]!;
    const targetDayIndex = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(targetDay);
    const currentDayIndex = today.getDay();

    if (modifier === "last") {
      // Find the most recent occurrence of this weekday
      let daysBack = currentDayIndex - targetDayIndex;
      if (daysBack <= 0) {
        daysBack += 7;
      }
      return formatDate(addDays(today, -daysBack));
    } else {
      // "this" - find the next occurrence (or today if it matches)
      let daysForward = targetDayIndex - currentDayIndex;
      if (daysForward < 0) {
        daysForward += 7;
      }
      return formatDate(addDays(today, daysForward));
    }
  }

  // If we can't parse it, return it as-is (will likely fail validation later)
  return input;
};

// Helper to format a Date object as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to add days to a date
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Helper to add months to a date
const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

// Helper function to get credentials from args or environment
const getCredentials = (args: any) => {
  const accessToken = args?.access_token || process.env.HARVEST_ACCESS_TOKEN;
  const accountId = args?.account_id || process.env.HARVEST_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    throw new Error("Missing required credentials: access_token and account_id must be provided either as arguments or via HARVEST_ACCESS_TOKEN and HARVEST_ACCOUNT_ID environment variables.");
  }

  return { accessToken, accountId };
};

// Register tools using the new McpServer API
server.registerTool("get_my_profile", {
  description: "Verify credentials and get details of the authenticated user",
  inputSchema: {
    access_token: z.string().optional().describe("Harvest Personal Access Token (optional if set via env)"),
    account_id: z.string().optional().describe("Harvest Account ID (optional if set via env)"),
  },
}, async (args) => {
  const { accessToken, accountId } = getCredentials(args);
  const client = createClient(accessToken, accountId);
  const res = await client.get("/users/me");
  return { content: [{ type: "text", text: `Authenticated as: ${res.data.first_name} ${res.data.last_name}` }] };
});

server.registerTool("list_active_projects", {
  description: "List all active projects and their associated tasks",
  inputSchema: {
    access_token: z.string().optional().describe("Harvest Personal Access Token (optional if set via env)"),
    account_id: z.string().optional().describe("Harvest Account ID (optional if set via env)"),
  },
}, async (args) => {
  const { accessToken, accountId } = getCredentials(args);
  const client = createClient(accessToken, accountId);
  const res = await client.get("/users/me/project_assignments");
  return { content: [{ type: "text", text: JSON.stringify(res.data.project_assignments, null, 2) }] };
});

server.registerTool("log_time", {
  description: "Log time for a specific project and task",
  inputSchema: {
    access_token: z.string().optional().describe("Harvest Personal Access Token (optional if set via env)"),
    account_id: z.string().optional().describe("Harvest Account ID (optional if set via env)"),
    project_id: z.number().describe("The ID of the project"),
    task_id: z.number().describe("The ID of the task"),
    hours: z.number().describe("Number of hours to log"),
    spent_date: z.string().optional().describe("Date in YYYY-MM-DD format or relative date (e.g., 'today', 'yesterday', '3 days ago', 'last monday')"),
    notes: z.string().optional().describe("Notes for the time entry"),
  },
}, async (args) => {
  const { accessToken, accountId } = getCredentials(args);
  const client = createClient(accessToken, accountId);

  const spentDate = args.spent_date
    ? parseRelativeDate(args.spent_date)
    : formatDate(new Date());

  const payload = {
    project_id: args.project_id,
    task_id: args.task_id,
    spent_date: spentDate,
    hours: args.hours,
    notes: args.notes,
  };

  const res = await client.post("/time_entries", payload);
  return { content: [{ type: "text", text: `Success! Time entry created with ID: ${res.data.id}` }] };
});

server.registerTool("get_time_entries", {
  description: "Get time entries for a specific date or date range. Defaults to today if no dates specified.",
  inputSchema: {
    access_token: z.string().optional().describe("Harvest Personal Access Token (optional if set via env)"),
    account_id: z.string().optional().describe("Harvest Account ID (optional if set via env)"),
    from: z.string().optional().describe("Start date in YYYY-MM-DD format or relative date (e.g., 'today', 'yesterday', '1 week ago', 'last monday'). Defaults to today."),
    to: z.string().optional().describe("End date in YYYY-MM-DD format or relative date (e.g., 'today', '3 days ago'). Defaults to 'from' date."),
    project_id: z.number().optional().describe("Filter by specific project ID (optional)"),
    user_id: z.number().optional().describe("Filter by specific user ID (optional, defaults to current user)"),
  },
}, async (args) => {
  const { accessToken, accountId } = getCredentials(args);
  const client = createClient(accessToken, accountId);

  const today = formatDate(new Date());
  const fromDate = args.from ? parseRelativeDate(args.from) : today;
  const toDate = args.to ? parseRelativeDate(args.to) : fromDate;

  const params: any = {
    from: fromDate,
    to: toDate,
  };

  if (args.project_id) {
    params.project_id = args.project_id;
  }

  if (args.user_id) {
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
});

server.registerTool("delete_time_entry", {
  description: "Delete a specific time entry",
  inputSchema: {
    access_token: z.string().optional().describe("Harvest Personal Access Token (optional if set via env)"),
    account_id: z.string().optional().describe("Harvest Account ID (optional if set via env)"),
    time_entry_id: z.number().describe("The ID of the time entry to delete"),
  },
}, async (args) => {
  const { accessToken, accountId } = getCredentials(args);
  const client = createClient(accessToken, accountId);
  await client.delete(`/time_entries/${args.time_entry_id}`);
  return { content: [{ type: "text", text: `Success! Time entry ${args.time_entry_id} has been deleted.` }] };
});

// 3. Start Server
const transport = new StdioServerTransport();
await server.connect(transport);