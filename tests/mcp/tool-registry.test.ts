import { describe, it, expect } from "vitest";
import { getToolDefinitions, handleToolCall } from "../../src/mcp/tools/index.js";
import { makeMockClient } from "../helpers/mcp-factories.js";

const EXPECTED_TOOL_NAMES = [
  "get_findings", "get_endpoints", "get_request_detail",
  "verify_fix", "get_report", "clear_findings", "report_fix", "report_fixes",
];

describe("getToolDefinitions", () => {
  it("returns all registered tools", () => {
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(EXPECTED_TOOL_NAMES.length);
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
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(names).toContain(name);
    }
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
