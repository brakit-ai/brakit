import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BrakitClient } from "./client.js";
import { waitForBrakit } from "./discovery.js";
import { getToolDefinitions, handleToolCall } from "./tools/index.js";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  INITIAL_DISCOVERY_TIMEOUT_MS,
  LAZY_DISCOVERY_TIMEOUT_MS,
} from "../constants/mcp.js";
import { PROMPTS, PROMPT_MESSAGES } from "./prompts.js";

export async function startMcpServer(): Promise<void> {
  let discovery;
  try {
    discovery = await waitForBrakit(undefined, INITIAL_DISCOVERY_TIMEOUT_MS);
  } catch {
    discovery = null;
  }

  let cachedClient = discovery ? new BrakitClient(discovery.baseUrl) : null;

  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {}, prompts: {} } },
  );

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [...PROMPTS],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => ({
    description: PROMPTS.find((p) => p.name === request.params.name)?.description,
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: PROMPT_MESSAGES[request.params.name] ?? "Check my app for issues.",
      },
    }],
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefinitions(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    let activeClient = cachedClient;
    if (!activeClient) {
      try {
        const disc = await waitForBrakit(undefined, LAZY_DISCOVERY_TIMEOUT_MS);
        activeClient = new BrakitClient(disc.baseUrl);
        cachedClient = activeClient;
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "Brakit is not running. Start your app with brakit enabled first.",
          }],
          isError: true,
        };
      }
    }

    const alive = await activeClient.isAlive();
    if (!alive) {
      return {
        content: [{
          type: "text" as const,
          text: "Brakit appears to be down. Is your app still running?",
        }],
        isError: true,
      };
    }

    try {
      return await handleToolCall(activeClient, name, args ?? {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{
          type: "text" as const,
          text: `Error calling ${name}: ${message}`,
        }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
