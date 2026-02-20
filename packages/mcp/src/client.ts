/**
 * MCP Client for @openlinkos/mcp.
 *
 * Connects to MCP servers, discovers tools, and calls them.
 * Supports stdio and SSE transports.
 */

import type {
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPClientInterface,
  TransportHandler,
  MCPRequest,
  MCPResponse,
} from "./types.js";

// ---------------------------------------------------------------------------
// Stdio Transport
// ---------------------------------------------------------------------------

/**
 * Stdio transport: spawns a child process and communicates via stdin/stdout
 * using JSON-RPC over newline-delimited JSON.
 */
export class StdioTransport implements TransportHandler {
  private process: ReturnType<typeof import("child_process").spawn> | null = null;
  private _connected = false;
  private pending = new Map<number, { resolve: (v: MCPResponse) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private buffer = "";

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env?: Record<string, string>,
    private readonly requestTimeout: number = 30_000,
  ) {}

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    const { spawn } = await import("child_process");

    this.process = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.env },
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.on("error", (err) => {
      this._connected = false;
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(err);
      }
      this.pending.clear();
    });

    this.process.on("exit", (code) => {
      this._connected = false;
      const exitError = new Error(`MCP server process exited with code ${code ?? "unknown"}`);
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(exitError);
      }
      this.pending.clear();
    });

    this._connected = true;
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const response = JSON.parse(trimmed) as MCPResponse;
        const pending = this.pending.get(response.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(response.id);
          pending.resolve(response);
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  async send(message: MCPRequest): Promise<MCPResponse> {
    if (!this._connected || !this.process?.stdin) {
      throw new Error("Not connected");
    }

    return new Promise<MCPResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.id);
        reject(new Error(`Request ${message.method} (id=${message.id}) timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pending.set(message.id, { resolve, reject, timer });
      this.process!.stdin!.write(JSON.stringify(message) + "\n");
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this._connected = false;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
    }
    this.pending.clear();
  }
}

// ---------------------------------------------------------------------------
// SSE Transport
// ---------------------------------------------------------------------------

/**
 * SSE transport: communicates with an MCP server over HTTP Server-Sent Events.
 */
export class SSETransport implements TransportHandler {
  private _connected = false;
  private baseUrl: string;
  private authToken?: string;
  private requestTimeout: number;

  constructor(
    url: string,
    authToken?: string,
    requestTimeout: number = 30_000,
  ) {
    this.baseUrl = url.replace(/\/$/, "");
    this.authToken = authToken;
    this.requestTimeout = requestTimeout;
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    // For SSE, we validate the server is reachable
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(this.requestTimeout),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (err) {
      // Network-level failure means the server is unreachable — re-throw.
      // Non-network errors (404, etc.) are swallowed because some servers
      // don't have health endpoints; we proceed and mark as connected.
      if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) {
        throw new Error(`Cannot reach MCP server at ${this.baseUrl}`);
      }
    }

    this._connected = true;
  }

  async send(message: MCPRequest): Promise<MCPResponse> {
    if (!this._connected) {
      throw new Error("Not connected");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(this.requestTimeout),
    });

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}`);
    }

    return (await response.json()) as MCPResponse;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }
}

// ---------------------------------------------------------------------------
// MCP Client
// ---------------------------------------------------------------------------

/**
 * MCP Client that connects to an MCP server, discovers tools, and calls them.
 */
export class MCPClient implements MCPClientInterface {
  private transport: TransportHandler;
  private requestId = 0;
  private cachedTools: MCPTool[] | null = null;

  constructor(config: MCPServerConfig) {
    switch (config.transport) {
      case "stdio":
        this.transport = new StdioTransport(
          config.server,
          config.args,
          config.env,
          config.requestTimeout,
        );
        break;
      case "sse":
      case "streamable-http":
        this.transport = new SSETransport(
          config.server,
          config.authToken,
          config.requestTimeout,
        );
        break;
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  get connected(): boolean {
    return this.transport.connected;
  }

  async connect(): Promise<void> {
    await this.transport.connect();

    // Send initialize request
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "openlinkos-mcp-client",
        version: "0.1.0",
      },
    });

    // Send initialized notification per MCP spec
    await this.sendNotification("notifications/initialized");
  }

  async listTools(): Promise<MCPTool[]> {
    if (this.cachedTools) {
      return this.cachedTools;
    }

    const response = await this.sendRequest("tools/list", {});

    const result = response.result as { tools: MCPTool[] } | undefined;
    if (!result?.tools) {
      return [];
    }

    this.cachedTools = result.tools;
    return result.tools;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    const response = await this.sendRequest("tools/call", {
      name,
      arguments: params,
    });

    if (response.error) {
      return {
        content: response.error.message,
        isError: true,
      };
    }

    const result = response.result as MCPToolResult | undefined;
    return result ?? { content: null };
  }

  async disconnect(): Promise<void> {
    this.cachedTools = null;
    await this.transport.disconnect();
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<MCPResponse> {
    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return this.transport.send(request);
  }

  /**
   * Send a JSON-RPC notification (no id, no response expected).
   * Per MCP spec, notifications like "notifications/initialized" are fire-and-forget.
   */
  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    // Notifications in JSON-RPC 2.0 have no id and expect no response.
    // We use the transport's send but with a synthetic id, then ignore the response.
    // A cleaner approach would be a separate write-only method, but for compatibility
    // with the current TransportHandler interface we fire-and-forget a request.
    const id = ++this.requestId;
    const notification: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? {},
    };

    // Best-effort: don't fail connect() if notification delivery fails
    try {
      await this.transport.send(notification);
    } catch {
      // Notifications are fire-and-forget; swallow errors
    }
  }
}

/**
 * Create an MCP client for the given server configuration.
 */
export function createMCPClient(config: MCPServerConfig): MCPClientInterface {
  return new MCPClient(config);
}
