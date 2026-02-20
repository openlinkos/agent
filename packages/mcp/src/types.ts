/**
 * Core types for @openlinkos/mcp.
 *
 * Defines MCP server configuration, tool definitions,
 * transport types, and client/bridge interfaces.
 */

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** Supported MCP transport protocols. */
export type MCPTransport = "stdio" | "sse" | "streamable-http";

// ---------------------------------------------------------------------------
// MCP Server configuration
// ---------------------------------------------------------------------------

/** Configuration for connecting to an MCP server. */
export interface MCPServerConfig {
  /** The server command (for stdio) or URL (for SSE/HTTP). */
  server: string;
  /** Arguments for the server command (stdio transport). */
  args?: string[];
  /** Transport protocol to use. */
  transport: MCPTransport;
  /** Optional authentication token. */
  authToken?: string;
  /** Connection timeout in milliseconds. Default: 10000. */
  connectTimeout?: number;
  /** Request timeout in milliseconds. Default: 30000. */
  requestTimeout?: number;
  /** Environment variables to pass to stdio child process. */
  env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// MCP Tool
// ---------------------------------------------------------------------------

/** A tool definition discovered from an MCP server. */
export interface MCPTool {
  /** The tool's unique name. */
  name: string;
  /** Human-readable description of the tool. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// MCP Tool result
// ---------------------------------------------------------------------------

/** Result from calling an MCP tool. */
export interface MCPToolResult {
  /** The tool result content. */
  content: unknown;
  /** Whether the tool call was successful. */
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// MCP Client interface
// ---------------------------------------------------------------------------

/** Client interface for communicating with an MCP server. */
export interface MCPClientInterface {
  /** Connect to the MCP server. */
  connect(): Promise<void>;
  /** List available tools from the server. */
  listTools(): Promise<MCPTool[]>;
  /** Call a tool on the server. */
  callTool(name: string, params: Record<string, unknown>): Promise<MCPToolResult>;
  /** Disconnect from the server. */
  disconnect(): Promise<void>;
  /** Whether the client is currently connected. */
  readonly connected: boolean;
}

// ---------------------------------------------------------------------------
// Transport handler interface (internal)
// ---------------------------------------------------------------------------

/** Internal interface for transport implementations. */
export interface TransportHandler {
  connect(): Promise<void>;
  send(message: MCPRequest): Promise<MCPResponse>;
  disconnect(): Promise<void>;
  readonly connected: boolean;
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC protocol types
// ---------------------------------------------------------------------------

/** An MCP JSON-RPC request. */
export interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** An MCP JSON-RPC response. */
export interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
