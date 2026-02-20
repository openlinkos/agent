/**
 * Tests for WebChannel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as http from "node:http";
import { WebChannel } from "../src/web.js";

// Use a random high port to avoid conflicts
let portCounter = 19100;
function nextPort(): number {
  return portCounter++;
}

function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, method, path, headers: { "Content-Type": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("WebChannel", () => {
  let channel: WebChannel;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    channel = new WebChannel({
      name: "test-web",
      port,
      host: "127.0.0.1",
      autoReconnect: false,
    });
  });

  afterEach(async () => {
    if (channel.status === "connected") {
      await channel.disconnect();
    }
  });

  describe("connect / disconnect", () => {
    it("should connect and listen on configured port", async () => {
      await channel.connect();
      expect(channel.status).toBe("connected");
    });

    it("should disconnect cleanly", async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.status).toBe("disconnected");
    });
  });

  describe("POST /message", () => {
    it("should accept messages and emit them", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      const res = await makeRequest(port, "POST", "/message", JSON.stringify({ text: "hello" }));

      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.status).toBe("received");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].text).toBe("hello");
      expect(handler.mock.calls[0][0].role).toBe("user");
      expect(handler.mock.calls[0][0].metadata?.transport).toBe("http");
    });

    it("should reject missing text field", async () => {
      await channel.connect();
      const res = await makeRequest(port, "POST", "/message", JSON.stringify({ foo: "bar" }));
      expect(res.status).toBe(400);
    });

    it("should reject invalid JSON", async () => {
      await channel.connect();
      const res = await makeRequest(port, "POST", "/message", "not json");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      await channel.connect();
      const res = await makeRequest(port, "GET", "/health");
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.status).toBe("ok");
      expect(parsed.channel).toBe("test-web");
    });
  });

  describe("GET /sse", () => {
    it("should establish SSE connection and receive messages", async () => {
      await channel.connect();

      // Open SSE connection
      const events = await new Promise<string[]>((resolve) => {
        const collected: string[] = [];
        const req = http.get(
          { hostname: "127.0.0.1", port, path: "/sse" },
          (res) => {
            expect(res.headers["content-type"]).toBe("text/event-stream");

            res.on("data", (chunk: Buffer) => {
              collected.push(chunk.toString());
              // After receiving one message, clean up
              if (collected.length >= 1) {
                req.destroy();
                resolve(collected);
              }
            });
          },
        );

        // Wait a bit then send a message through the channel
        setTimeout(() => {
          channel.send({
            id: "sse-1",
            role: "assistant",
            text: "sse broadcast",
            timestamp: new Date().toISOString(),
          });
        }, 50);
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toContain("sse broadcast");
    });
  });

  describe("404 for unknown routes", () => {
    it("should return 404 for unmatched routes", async () => {
      await channel.connect();
      const res = await makeRequest(port, "GET", "/unknown");
      expect(res.status).toBe(404);
    });
  });

  describe("CORS", () => {
    it("should handle OPTIONS preflight requests", async () => {
      await channel.connect();
      const res = await makeRequest(port, "OPTIONS", "/message");
      expect(res.status).toBe(204);
    });
  });
});
