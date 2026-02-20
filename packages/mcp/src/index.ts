/**
 * @openlinkos/mcp — Model Context Protocol tool integration.
 *
 * Connect to MCP servers, discover tools, and use them seamlessly
 * within the agent framework.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  MCPTransport,
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPClientInterface,
  MCPRequest,
  MCPResponse,
} from "./types.js";

// --- Client ---
export {
  MCPClient,
  StdioTransport,
  SSETransport,
  createMCPClient,
} from "./client.js";

// --- Bridge ---
export {
  mcpToolToAgentTool,
  mcpToolsToAgentTools,
  createMCPTools,
} from "./bridge.js";
