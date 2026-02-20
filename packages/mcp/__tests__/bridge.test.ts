/**
 * Tests for the MCP-to-Agent bridge.
 */

import { describe, it, expect, vi } from "vitest";
import { mcpToolToAgentTool, mcpToolsToAgentTools } from "../src/bridge.js";
import type { MCPClientInterface, MCPTool, MCPToolResult } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock MCP client
// ---------------------------------------------------------------------------

function createMockMCPClient(
  toolResults: Record<string, MCPToolResult> = {},
): MCPClientInterface {
  let _connected = false;

  return {
    get connected() {
      return _connected;
    },
    async connect() {
      _connected = true;
    },
    async listTools(): Promise<MCPTool[]> {
      return [];
    },
    async callTool(name: string, _params: Record<string, unknown>): Promise<MCPToolResult> {
      if (toolResults[name]) {
        return toolResults[name];
      }
      return { content: null };
    },
    async disconnect() {
      _connected = false;
    },
  };
}

// ---------------------------------------------------------------------------
// mcpToolToAgentTool tests
// ---------------------------------------------------------------------------

describe("mcpToolToAgentTool", () => {
  it("should convert MCP tool to Agent ToolDefinition", () => {
    const mcpTool: MCPTool = {
      name: "get_weather",
      description: "Get weather for a city",
      inputSchema: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      },
    };

    const client = createMockMCPClient();
    const agentTool = mcpToolToAgentTool(mcpTool, client);

    expect(agentTool.name).toBe("get_weather");
    expect(agentTool.description).toBe("Get weather for a city");
    expect(agentTool.parameters.type).toBe("object");
    expect(agentTool.parameters.properties).toHaveProperty("city");
    expect(agentTool.parameters.required).toEqual(["city"]);
    expect(typeof agentTool.execute).toBe("function");
  });

  it("should call MCP server when execute is called", async () => {
    const mcpTool: MCPTool = {
      name: "search",
      description: "Search the web",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
      },
    };

    const client = createMockMCPClient({
      search: { content: [{ title: "Result 1" }] },
    });

    const agentTool = mcpToolToAgentTool(mcpTool, client);
    const result = await agentTool.execute({ query: "test" });

    expect(result).toEqual([{ title: "Result 1" }]);
  });

  it("should throw when MCP tool call returns error", async () => {
    const mcpTool: MCPTool = {
      name: "fail_tool",
      description: "A tool that fails",
      inputSchema: { type: "object" },
    };

    const client = createMockMCPClient({
      fail_tool: { content: "Something went wrong", isError: true },
    });

    const agentTool = mcpToolToAgentTool(mcpTool, client);

    await expect(agentTool.execute({})).rejects.toThrow("Something went wrong");
  });

  it("should handle MCP tools with no properties", () => {
    const mcpTool: MCPTool = {
      name: "no_params",
      description: "A tool with no parameters",
      inputSchema: { type: "object" },
    };

    const client = createMockMCPClient();
    const agentTool = mcpToolToAgentTool(mcpTool, client);

    expect(agentTool.parameters.properties).toEqual({});
    expect(agentTool.parameters.required).toEqual([]);
  });

  it("should handle non-string error content", async () => {
    const mcpTool: MCPTool = {
      name: "error_obj",
      description: "Error with object",
      inputSchema: { type: "object" },
    };

    const client = createMockMCPClient({
      error_obj: { content: { code: 500, message: "Internal error" }, isError: true },
    });

    const agentTool = mcpToolToAgentTool(mcpTool, client);

    await expect(agentTool.execute({})).rejects.toThrow("Internal error");
  });
});

// ---------------------------------------------------------------------------
// mcpToolsToAgentTools tests
// ---------------------------------------------------------------------------

describe("mcpToolsToAgentTools", () => {
  it("should convert multiple MCP tools", () => {
    const mcpTools: MCPTool[] = [
      {
        name: "tool_a",
        description: "Tool A",
        inputSchema: { type: "object", properties: { x: { type: "number" } } },
      },
      {
        name: "tool_b",
        description: "Tool B",
        inputSchema: { type: "object", properties: { y: { type: "string" } } },
      },
    ];

    const client = createMockMCPClient();
    const agentTools = mcpToolsToAgentTools(mcpTools, client);

    expect(agentTools).toHaveLength(2);
    expect(agentTools[0].name).toBe("tool_a");
    expect(agentTools[1].name).toBe("tool_b");
  });

  it("should handle empty tool list", () => {
    const client = createMockMCPClient();
    const agentTools = mcpToolsToAgentTools([], client);
    expect(agentTools).toEqual([]);
  });

  it("should create independent execute functions for each tool", async () => {
    const mcpTools: MCPTool[] = [
      {
        name: "add",
        description: "Add numbers",
        inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } },
      },
      {
        name: "multiply",
        description: "Multiply numbers",
        inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } },
      },
    ];

    const client = createMockMCPClient({
      add: { content: 5 },
      multiply: { content: 6 },
    });

    const agentTools = mcpToolsToAgentTools(mcpTools, client);

    const addResult = await agentTools[0].execute({ a: 2, b: 3 });
    const multiplyResult = await agentTools[1].execute({ a: 2, b: 3 });

    expect(addResult).toBe(5);
    expect(multiplyResult).toBe(6);
  });
});
