/**
 * Tests for the MCP client.
 */

import { describe, it, expect, vi } from "vitest";
import { MCPClient } from "../src/client.js";
import type {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  TransportHandler,
} from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock transport
// ---------------------------------------------------------------------------

function createMockTransport(responses: Record<string, unknown> = {}): TransportHandler & { sentRequests: MCPRequest[] } {
  let _connected = false;
  const sentRequests: MCPRequest[] = [];

  return {
    sentRequests,
    get connected() {
      return _connected;
    },
    async connect() {
      _connected = true;
    },
    async send(message: MCPRequest): Promise<MCPResponse> {
      sentRequests.push(message);

      if (responses[message.method]) {
        return {
          jsonrpc: "2.0",
          id: message.id,
          result: responses[message.method],
        };
      }

      // Default: return empty result
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {},
      };
    },
    async disconnect() {
      _connected = false;
    },
  };
}

/**
 * Create an MCPClient with a mock transport injected.
 * We use the class directly and override the transport.
 */
function createClientWithMock(
  responses: Record<string, unknown> = {},
): { client: MCPClient; transport: TransportHandler & { sentRequests: MCPRequest[] } } {
  const transport = createMockTransport(responses);
  const client = new MCPClient({
    server: "mock-server",
    transport: "stdio",
  });

  // Inject mock transport
  (client as unknown as { transport: TransportHandler }).transport = transport;

  return { client, transport };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCPClient", () => {
  it("should connect and send initialize request", async () => {
    const { client, transport } = createClientWithMock();

    await client.connect();

    expect(client.connected).toBe(true);
    expect(transport.sentRequests).toHaveLength(1);
    expect(transport.sentRequests[0].method).toBe("initialize");
    expect(transport.sentRequests[0].params).toHaveProperty("protocolVersion");
    expect(transport.sentRequests[0].params).toHaveProperty("clientInfo");

    await client.disconnect();
  });

  it("should list tools from server", async () => {
    const mockTools = [
      {
        name: "get_weather",
        description: "Get weather for a city",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
      {
        name: "search",
        description: "Search the web",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
        },
      },
    ];

    const { client } = createClientWithMock({
      "tools/list": { tools: mockTools },
    });

    await client.connect();
    const tools = await client.listTools();

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe("get_weather");
    expect(tools[0].description).toBe("Get weather for a city");
    expect(tools[1].name).toBe("search");

    await client.disconnect();
  });

  it("should cache tools after first list", async () => {
    const { client, transport } = createClientWithMock({
      "tools/list": {
        tools: [
          { name: "tool1", description: "Tool 1", inputSchema: { type: "object" } },
        ],
      },
    });

    await client.connect();

    const tools1 = await client.listTools();
    const tools2 = await client.listTools();

    expect(tools1).toEqual(tools2);
    // Only 1 initialize + 1 tools/list request (not 2 tools/list)
    const toolListRequests = transport.sentRequests.filter(
      (r) => r.method === "tools/list",
    );
    expect(toolListRequests).toHaveLength(1);

    await client.disconnect();
  });

  it("should clear tool cache on disconnect", async () => {
    const { client, transport } = createClientWithMock({
      "tools/list": {
        tools: [
          { name: "tool1", description: "Tool 1", inputSchema: { type: "object" } },
        ],
      },
    });

    await client.connect();
    await client.listTools();
    await client.disconnect();

    // Re-connect and list again — should make a new request
    await client.connect();
    await client.listTools();

    const toolListRequests = transport.sentRequests.filter(
      (r) => r.method === "tools/list",
    );
    expect(toolListRequests).toHaveLength(2);

    await client.disconnect();
  });

  it("should call a tool successfully", async () => {
    const { client } = createClientWithMock({
      "tools/call": {
        content: { temperature: 72, unit: "F" },
        isError: false,
      },
    });

    await client.connect();
    const result = await client.callTool("get_weather", { city: "Tokyo" });

    expect(result.content).toEqual({ temperature: 72, unit: "F" });
    expect(result.isError).toBe(false);

    await client.disconnect();
  });

  it("should handle tool call errors from server", async () => {
    const { client, transport } = createClientWithMock();

    // Override send to return an error response
    const originalSend = transport.send.bind(transport);
    transport.send = async (message: MCPRequest): Promise<MCPResponse> => {
      if (message.method === "tools/call") {
        return {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32600,
            message: "Tool not found: nonexistent",
          },
        };
      }
      return originalSend(message);
    };

    await client.connect();
    const result = await client.callTool("nonexistent", {});

    expect(result.isError).toBe(true);
    expect(result.content).toBe("Tool not found: nonexistent");

    await client.disconnect();
  });

  it("should return empty tools list when server returns none", async () => {
    const { client } = createClientWithMock({
      "tools/list": {},
    });

    await client.connect();
    const tools = await client.listTools();

    expect(tools).toEqual([]);

    await client.disconnect();
  });

  it("should track connected state", async () => {
    const { client } = createClientWithMock();

    expect(client.connected).toBe(false);
    await client.connect();
    expect(client.connected).toBe(true);
    await client.disconnect();
    expect(client.connected).toBe(false);
  });

  it("should send correct JSON-RPC format", async () => {
    const { client, transport } = createClientWithMock();

    await client.connect();

    const initRequest = transport.sentRequests[0];
    expect(initRequest.jsonrpc).toBe("2.0");
    expect(typeof initRequest.id).toBe("number");
    expect(initRequest.method).toBe("initialize");

    await client.disconnect();
  });

  it("should increment request IDs", async () => {
    const { client, transport } = createClientWithMock({
      "tools/list": { tools: [] },
    });

    await client.connect();
    await client.listTools();

    const ids = transport.sentRequests.map((r) => r.id);
    expect(ids[0]).toBeLessThan(ids[1]);

    await client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Constructor transport selection
// ---------------------------------------------------------------------------

describe("MCPClient constructor", () => {
  it("should throw for unsupported transport", () => {
    expect(
      () =>
        new MCPClient({
          server: "test",
          transport: "websocket" as never,
        }),
    ).toThrow("Unsupported transport");
  });

  it("should accept stdio transport", () => {
    const client = new MCPClient({
      server: "test-cmd",
      transport: "stdio",
    });
    expect(client).toBeDefined();
  });

  it("should accept sse transport", () => {
    const client = new MCPClient({
      server: "http://localhost:3000",
      transport: "sse",
    });
    expect(client).toBeDefined();
  });

  it("should accept streamable-http transport", () => {
    const client = new MCPClient({
      server: "http://localhost:3000",
      transport: "streamable-http",
    });
    expect(client).toBeDefined();
  });
});
