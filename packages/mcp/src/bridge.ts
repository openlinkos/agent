/**
 * MCP-to-Agent bridge for @openlinkos/mcp.
 *
 * Converts MCP tools to Agent ToolDefinition format so agents
 * can use MCP tools seamlessly.
 */

import type { ToolDefinition } from "@openlinkos/agent";
import type { MCPClientInterface, MCPServerConfig, MCPTool } from "./types.js";
import { createMCPClient } from "./client.js";

// ---------------------------------------------------------------------------
// Tool conversion
// ---------------------------------------------------------------------------

/**
 * Convert a single MCP tool to an Agent ToolDefinition.
 *
 * The returned ToolDefinition's execute function calls the MCP server
 * via the provided client.
 */
export function mcpToolToAgentTool(
  tool: MCPTool,
  client: MCPClientInterface,
): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: (tool.inputSchema.type as string) ?? "object",
      properties: (tool.inputSchema.properties as Record<string, { type: string; description?: string }>) ?? {},
      required: (tool.inputSchema.required as string[]) ?? [],
    },
    execute: async (params: Record<string, unknown>): Promise<unknown> => {
      const result = await client.callTool(tool.name, params);
      if (result.isError) {
        throw new Error(typeof result.content === "string" ? result.content : JSON.stringify(result.content));
      }
      return result.content;
    },
  };
}

/**
 * Convert multiple MCP tools to Agent ToolDefinitions.
 */
export function mcpToolsToAgentTools(
  tools: MCPTool[],
  client: MCPClientInterface,
): ToolDefinition[] {
  return tools.map((tool) => mcpToolToAgentTool(tool, client));
}

// ---------------------------------------------------------------------------
// High-level bridge
// ---------------------------------------------------------------------------

/**
 * Connect to an MCP server and return Agent-compatible ToolDefinitions
 * for all tools available on the server.
 *
 * The returned tools' execute functions will call the MCP server.
 * The caller is responsible for disconnecting the client when done.
 *
 * @param serverConfig - Configuration for the MCP server.
 * @returns The connected client and the converted tool definitions.
 */
export async function createMCPTools(
  serverConfig: MCPServerConfig,
): Promise<{
  client: MCPClientInterface;
  tools: ToolDefinition[];
}> {
  const client = createMCPClient(serverConfig);
  await client.connect();

  const mcpTools = await client.listTools();
  const tools = mcpToolsToAgentTools(mcpTools, client);

  return { client, tools };
}
