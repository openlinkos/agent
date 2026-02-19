/**
 * @openlinkos/mcp — Model Context Protocol client and server.
 *
 * Connect to MCP-compatible tool servers or expose agents and tools
 * as MCP endpoints. Supports stdio, HTTP/SSE, and WebSocket transports.
 *
 * @packageDocumentation
 */

export type MCPTransport = "stdio" | "http-sse" | "websocket";

export interface MCPClientConfig {
  /** URL or command for the MCP server. */
  server: string;
  /** Transport protocol to use. */
  transport: MCPTransport;
  /** Optional authentication token. */
  authToken?: string;
}

export interface MCPTool {
  /** The tool's unique name. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
}

export interface MCPClient {
  /** Connect to the MCP server. */
  connect(): Promise<void>;
  /** List available tools from the server. */
  listTools(): Promise<MCPTool[]>;
  /** Call a tool on the server. */
  callTool(name: string, params: Record<string, unknown>): Promise<unknown>;
  /** Disconnect from the server. */
  disconnect(): Promise<void>;
}

export interface MCPServerConfig {
  /** Transport protocol to use. */
  transport: MCPTransport;
  /** Port for HTTP/WebSocket transports. */
  port?: number;
}

export interface MCPServer {
  /** Register a tool with the server. */
  registerTool(tool: MCPTool & { handler: (params: Record<string, unknown>) => Promise<unknown> }): void;
  /** Start the server. */
  start(): Promise<void>;
  /** Stop the server. */
  stop(): Promise<void>;
}

/**
 * Create an MCP client to connect to a tool server.
 *
 * @param config - Client configuration.
 * @returns An MCPClient instance.
 *
 * @example
 * ```typescript
 * import { createMCPClient } from "@openlinkos/mcp";
 *
 * const client = createMCPClient({
 *   server: "npx some-mcp-server",
 *   transport: "stdio",
 * });
 *
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool("search", { query: "OpenLinkOS" });
 * await client.disconnect();
 * ```
 */
export function createMCPClient(_config: MCPClientConfig): MCPClient {
  throw new Error(
    "MCPClient is not yet implemented. This is a scaffold — MCP support is coming in Phase 2."
  );
}

/**
 * Create an MCP server to expose tools.
 *
 * @param config - Server configuration.
 * @returns An MCPServer instance.
 *
 * @example
 * ```typescript
 * import { createMCPServer } from "@openlinkos/mcp";
 *
 * const server = createMCPServer({ transport: "stdio" });
 *
 * server.registerTool({
 *   name: "get_weather",
 *   description: "Get weather for a location",
 *   inputSchema: { type: "object", properties: { city: { type: "string" } } },
 *   handler: async ({ city }) => ({ temp: 22, city }),
 * });
 *
 * await server.start();
 * ```
 */
export function createMCPServer(_config: MCPServerConfig): MCPServer {
  throw new Error(
    "MCPServer is not yet implemented. This is a scaffold — MCP support is coming in Phase 2."
  );
}
