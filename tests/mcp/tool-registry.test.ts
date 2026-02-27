import { describe, it, expect, vi } from "vitest";
import { getToolDefinitions, handleToolCall } from "../../src/mcp/tools/index.js";
import type { BrakitClient } from "../../src/mcp/client.js";

function makeMockClient(): BrakitClient {
  return {
    getRequests: vi.fn(),
    getSecurityFindings: vi.fn(),
    getInsights: vi.fn(),
    getQueries: vi.fn(),
    getFetches: vi.fn(),
    getErrors: vi.fn(),
    getActivity: vi.fn(),
    getLiveMetrics: vi.fn(),
    getFindings: vi.fn(),
    clearAll: vi.fn(),
    isAlive: vi.fn(),
  } as unknown as BrakitClient;
}

describe("getToolDefinitions", () => {
  it("returns all 6 tools", () => {
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(6);
  });

  it("each tool has name, description, and inputSchema", () => {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      expect(tool.name).toBeTypeOf("string");
      expect(tool.description).toBeTypeOf("string");
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it("contains expected tool names", () => {
    const names = getToolDefinitions().map((t) => t.name);
    expect(names).toContain("get_findings");
    expect(names).toContain("get_endpoints");
    expect(names).toContain("get_request_detail");
    expect(names).toContain("verify_fix");
    expect(names).toContain("get_report");
    expect(names).toContain("clear_findings");
  });
});

describe("handleToolCall", () => {
  it("returns error for unknown tool", async () => {
    const client = makeMockClient();
    const result = await handleToolCall(client, "nonexistent_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });
});
