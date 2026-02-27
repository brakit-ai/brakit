# MCP Server

Brakit ships an MCP (Model Context Protocol) server so that AI assistants —
Claude, Cursor, Copilot, and others — can talk directly to your running app.
Instead of copy-pasting terminal output or describing bugs in chat, the AI
reads brakit's findings and performance data itself, then fixes your code.

This document covers how the MCP server works, what tools it exposes, and how
to add new ones.

## Table of contents

- [What is MCP?](#what-is-mcp)
- [How it connects](#how-it-connects)
- [The tools](#the-tools)
- [Finding lifecycle](#finding-lifecycle)
- [Architecture](#architecture)
- [Adding a new MCP tool](#adding-a-new-mcp-tool)
- [Constants](#constants)
- [Testing](#testing)

---

## What is MCP?

MCP is a standard protocol that lets AI tools call functions on external
servers. Think of it like a REST API, but designed for AI assistants instead
of browsers. The AI asks "what security issues exist?", brakit answers with
structured data, and the AI acts on it.

Brakit's MCP server runs as a separate process (via stdio), not inside your
app. It connects to your running app's dashboard API to fetch data.

---

## How it connects

The MCP server needs to find your running app. Here's the flow:

```
Your app (with brakit)           MCP server              AI assistant
         |                           |                        |
    writes .brakit/port              |                        |
         |                           |                        |
         |              reads .brakit/port                    |
         |              polls until app responds              |
         |                           |                        |
         |<--- HTTP to dashboard API |                        |
         |--- JSON response -------->|                        |
         |                           |--- tool result ------->|
```

1. When brakit starts inside your app, it writes the dashboard port to
   `.brakit/port` (e.g., `3000`).
2. The MCP server reads that file to learn where to send requests.
3. It makes HTTP calls to the same dashboard API that powers the browser UI
   (e.g., `http://localhost:3000/__brakit/api/requests`).
4. It formats the response and hands it to the AI assistant.

If brakit isn't running yet, the MCP server waits up to 5 seconds on startup,
polling every 500ms. If a tool is called later and there's still no connection,
it waits 2 seconds and tries again.

---

## The tools

The MCP server exposes 6 tools. Each tool is a single function the AI can
call.

| Tool | What it does | Parameters |
|------|-------------|------------|
| `get_findings` | Lists security issues and performance problems | `severity` (optional), `state` (optional) |
| `get_endpoints` | Shows all observed API endpoints with performance stats | `sort_by` (optional: `p95`, `error_rate`, `query_count`, `requests`) |
| `get_request_detail` | Deep-dives into a specific request — queries, fetches, timeline | `request_id` or `endpoint` |
| `verify_fix` | Checks whether a previously reported issue is resolved | `finding_id` or `endpoint` |
| `get_report` | Full status report — open/resolved counts, top issues, endpoint health | none |
| `clear_findings` | Resets all stored findings (fresh start) | none |

### How a typical AI conversation goes

1. AI calls `get_findings` — sees 3 security issues.
2. AI calls `get_request_detail` on the worst one — sees the exact SQL query
   that's vulnerable.
3. AI fixes the code.
4. User re-triggers the endpoint.
5. AI calls `verify_fix` — confirms the issue is gone.

### Prompts

The server also registers two prompts that give AI assistants a starting
point:

- **check-app** — "Check my running app for security and performance issues."
  The AI calls `get_findings`, then `get_endpoints`, then drills into anything
  critical.
- **fix-findings** — "Find all open findings and fix them one by one." The AI
  iterates through issues, reads source code, makes fixes, and verifies each
  one.

---

## Finding lifecycle

Brakit doesn't just detect issues — it tracks them over time. Every finding
goes through a lifecycle:

```
  new issue detected
         |
         v
      [ open ] ──── user starts fixing ───> [ fixing ]
         ^                                       |
         |                                       v
    re-detected                             [ resolved ]
         |                                       |
         +───────── issue comes back ────────────+
```

### States

| State | Meaning |
|-------|---------|
| `open` | The issue was detected and hasn't been fixed |
| `fixing` | Someone is working on it (set by the AI or user) |
| `resolved` | The issue is no longer detected in live traffic |

### Stable finding IDs

Each finding gets a deterministic ID based on three things: the rule that
caught it, the endpoint it was found on, and the description. Brakit hashes
these with SHA-256 and truncates to 16 hex characters. This means:

- The same issue always gets the same ID, even across restarts.
- The AI can refer to a finding by ID and it won't change.
- Different issues on the same endpoint get different IDs.

### Auto-resolution

When brakit re-scans your traffic and a previously-detected issue is no
longer present, it automatically moves to `resolved`. If the issue reappears
later, it moves back to `open` — so you know a fix didn't stick.

### Persistence

Findings are saved to `.brakit/findings.json` and survive app restarts. The
store flushes periodically and does an atomic write (write to temp file, then
rename) to avoid corruption.

---

## Architecture

The MCP server is built from four pieces:

```
src/mcp/
  server.ts        Wires everything together, connects to MCP SDK
  discovery.ts     Finds the running brakit instance via .brakit/port
  client.ts        HTTP client for the brakit dashboard API
  enrichment.ts    Transforms raw API data into AI-friendly formats
  prompts.ts       Built-in prompt definitions
  types.ts         TypeScript interfaces for all MCP-related data
  tools/           One file per tool
    index.ts       Tool registry (Map-based dispatch)
    get-findings.ts
    get-endpoints.ts
    get-request-detail.ts
    verify-fix.ts
    get-report.ts
    clear-findings.ts
```

Supporting files in other directories:

```
src/store/
  finding-store.ts   Stateful finding storage with lifecycle transitions
  finding-id.ts      Stable finding ID computation (SHA-256)

src/types/
  finding-lifecycle.ts   FindingState, StatefulFinding, FindingsData types

src/constants/
  mcp.ts   Timeouts, limits, and configuration for the MCP server
```

### Data flow

```
AI calls tool ──> server.ts ──> client.ts ──> dashboard API ──> stores
                      |
                      v
                enrichment.ts (format data for AI)
                      |
                      v
                tool handler (build response text)
                      |
                      v
                AI reads result
```

### Build entry point

The MCP server builds to `dist/mcp/server.js` (configured in `tsup.config.ts`).
AI tools reference this path in their MCP configuration. For example, in
Claude's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "brakit": {
      "command": "node",
      "args": ["path/to/brakit/dist/mcp/server.js"]
    }
  }
}
```

---

## Adding a new MCP tool

Each tool is one file and one object. Here's how to add one.

### 1. Create the tool file

Create `src/mcp/tools/<your-tool>.ts`:

```typescript
import type { BrakitClient } from "../client.js";
import type { McpTool, McpToolResult } from "../types.js";

export const myTool: McpTool = {
  name: "my_tool",
  description: "One sentence explaining what this tool does.",
  inputSchema: {
    type: "object",
    properties: {
      some_param: {
        type: "string",
        description: "What this parameter controls.",
      },
    },
    required: [],
  },

  async handler(client: BrakitClient, args: Record<string, unknown>): Promise<McpToolResult> {
    // Validate inputs
    const param = args.some_param as string | undefined;

    // Call the brakit API via the client
    const data = await client.getRequests();

    // Format for the AI
    const text = `Found ${data.total} requests.`;

    return {
      content: [{ type: "text", text }],
    };
  },
};
```

### 2. Register it

Add your tool to the `TOOL_MAP` in `src/mcp/tools/index.ts`:

```typescript
import { myTool } from "./my-tool.js";

const TOOL_MAP = new Map<string, McpTool>(
  [getFindings, getEndpoints, getRequestDetail, verifyFix, getReport, clearFindings, myTool]
    .map((t) => [t.name, t] as const),
);
```

That's it. The registry handles `ListTools` and `CallTool` dispatch
automatically.

### 3. Add tests

Add test cases in `tests/mcp/tools.test.ts` following the existing pattern.
Create a mock client, call your handler, and assert on the response text:

```typescript
describe("my_tool", () => {
  it("returns expected output", async () => {
    const client = makeMockClient({
      getRequests: vi.fn().mockResolvedValue({ total: 5, requests: [] }),
    });
    const result = await myTool.handler(client, {});
    expect(result.content[0].text).toContain("5 requests");
  });
});
```

### Conventions

- **Tool names** use `snake_case` (MCP convention).
- **One file, one tool.** Keep handlers focused.
- **Validate inputs early.** Return `{ isError: true }` for bad parameters.
- **Format for readability.** The AI reads the text, so make it structured
  but not verbose. Tables and bullet points work well.
- **Use constants** from `src/constants/mcp.ts` for timeouts and limits.
  No hardcoded numbers in tool files.

---

## Constants

All MCP-related constants live in `src/constants/mcp.ts`:

| Constant | Value | What it controls |
|----------|-------|-----------------|
| `INITIAL_DISCOVERY_TIMEOUT_MS` | 5000 | How long to wait for brakit on MCP server startup |
| `LAZY_DISCOVERY_TIMEOUT_MS` | 2000 | How long to wait if discovery is needed during a tool call |
| `CLIENT_FETCH_TIMEOUT_MS` | 10000 | Timeout for each HTTP request to the dashboard API |
| `HEALTH_CHECK_TIMEOUT_MS` | 3000 | Timeout for the `isAlive` health check |
| `DISCOVERY_POLL_INTERVAL_MS` | 500 | How often to check for the port file during discovery |
| `MAX_TIMELINE_EVENTS` | 20 | Maximum timeline events returned in request detail |
| `MAX_RESOLVED_DISPLAY` | 5 | Maximum resolved findings shown in reports |
| `ENRICHMENT_SEVERITY_FILTER` | `["critical", "warning"]` | Which insight severities to surface as findings |

---

## Testing

MCP tests live in `tests/mcp/` and `tests/store/`:

| File | What it tests |
|------|--------------|
| `tests/mcp/tools.test.ts` | All 6 tool handlers — happy paths, edge cases, input validation |
| `tests/mcp/tool-registry.test.ts` | Tool registration, dispatch, unknown tool handling |
| `tests/mcp/enrichment.test.ts` | Data enrichment — finding mapping, endpoint sorting, context |
| `tests/mcp/discovery.test.ts` | Port file discovery — reading, validation, error cases |
| `tests/store/finding-store.test.ts` | Finding lifecycle — upsert, transitions, persistence, reconciliation |

Test helpers in `tests/helpers/mcp-factories.ts` provide factory functions:
`makeSecurityFinding()`, `makeStatefulFinding()`, `makeEnrichedFinding()`,
`makeEndpointSummary()`.
