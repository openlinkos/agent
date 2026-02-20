/**
 * Tests for SlackChannel.
 *
 * All Slack API calls are mocked — no real network requests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as http from "node:http";
import * as crypto from "node:crypto";
import { SlackChannel } from "../src/index.js";
import type { SlackClient } from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let portCounter = 19400;
function nextPort(): number {
  return portCounter++;
}

function createMockClient(): SlackClient & { postMessage: ReturnType<typeof vi.fn> } {
  return {
    postMessage: vi.fn(async () => {}),
  };
}

function makeSlackSignature(signingSecret: string, body: string, timestamp: string): string {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");
  return `v0=${hmac}`;
}

function postToSlack(
  port: number,
  body: string,
  headers?: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method: "POST",
        path: "/",
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlackChannel", () => {
  let channel: SlackChannel;
  let mockClient: ReturnType<typeof createMockClient>;
  let port: number;
  const signingSecret = "test-signing-secret";

  beforeEach(() => {
    port = nextPort();
    mockClient = createMockClient();
    channel = new SlackChannel({
      name: "test-slack",
      botToken: "xoxb-test-token",
      signingSecret,
      port,
      host: "127.0.0.1",
      client: mockClient,
      verifySignatures: false, // Disabled for most tests
      autoReconnect: false,
    });
  });

  afterEach(async () => {
    if (channel.status === "connected") {
      await channel.disconnect();
    }
  });

  describe("connect / disconnect", () => {
    it("should connect and listen", async () => {
      await channel.connect();
      expect(channel.status).toBe("connected");
    });

    it("should disconnect cleanly", async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.status).toBe("disconnected");
    });
  });

  describe("URL verification", () => {
    it("should respond to url_verification challenge", async () => {
      await channel.connect();

      const body = JSON.stringify({
        type: "url_verification",
        challenge: "test-challenge-123",
      });

      const res = await postToSlack(port, body);
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.challenge).toBe("test-challenge-123");
    });
  });

  describe("receiving messages", () => {
    it("should emit channel messages from Slack events", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      const body = JSON.stringify({
        type: "event_callback",
        team_id: "T123",
        event: {
          type: "message",
          channel: "C123",
          user: "U456",
          text: "hello from slack",
          ts: "1234567890.123456",
        },
      });

      const res = await postToSlack(port, body);
      expect(res.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      const msg = handler.mock.calls[0][0];
      expect(msg.text).toBe("hello from slack");
      expect(msg.role).toBe("user");
      expect(msg.metadata?.platform).toBe("slack");
      expect(msg.metadata?.channelId).toBe("C123");
      expect(msg.metadata?.userId).toBe("U456");
    });

    it("should ignore bot messages", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      const body = JSON.stringify({
        type: "event_callback",
        event: {
          type: "message",
          channel: "C123",
          bot_id: "B123",
          text: "bot message",
          ts: "1234567890.123456",
        },
      });

      await postToSlack(port, body);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).not.toHaveBeenCalled();
    });

    it("should ignore message subtypes", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      const body = JSON.stringify({
        type: "event_callback",
        event: {
          type: "message",
          subtype: "channel_join",
          channel: "C123",
          user: "U456",
          text: "joined",
          ts: "1234567890.123456",
        },
      });

      await postToSlack(port, body);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("sending messages", () => {
    it("should send messages via client", async () => {
      await channel.connect();

      await channel.send({
        id: "out-1",
        role: "assistant",
        text: "Hello Slack!",
        timestamp: new Date().toISOString(),
        metadata: { channelId: "C123" },
      });

      expect(mockClient.postMessage).toHaveBeenCalledWith("C123", "Hello Slack!", {});
    });

    it("should throw if channelId is missing", async () => {
      await channel.connect();
      await expect(
        channel.send({
          id: "out-2",
          role: "assistant",
          text: "No channel",
          timestamp: new Date().toISOString(),
        }),
      ).rejects.toThrow("channelId");
    });

    it("should support thread_ts for threaded replies", async () => {
      await channel.connect();

      await channel.send({
        id: "out-3",
        role: "assistant",
        text: "Thread reply",
        timestamp: new Date().toISOString(),
        metadata: { channelId: "C123", threadTs: "1234567890.123456" },
      });

      expect(mockClient.postMessage).toHaveBeenCalledWith(
        "C123",
        "Thread reply",
        expect.objectContaining({ thread_ts: "1234567890.123456" }),
      );
    });

    it("should support blocks", async () => {
      await channel.connect();

      const blocks = [
        { type: "section", text: { type: "mrkdwn" as const, text: "*Bold*" } },
      ];

      await channel.send({
        id: "out-4",
        role: "assistant",
        text: "With blocks",
        timestamp: new Date().toISOString(),
        metadata: { channelId: "C123", blocks },
      });

      expect(mockClient.postMessage).toHaveBeenCalledWith(
        "C123",
        "With blocks",
        expect.objectContaining({ blocks }),
      );
    });
  });

  describe("signature verification", () => {
    it("should reject requests with invalid signatures when verification is enabled", async () => {
      const securePort = nextPort();
      const secureChannel = new SlackChannel({
        name: "secure-slack",
        botToken: "xoxb-test-token",
        signingSecret,
        port: securePort,
        host: "127.0.0.1",
        client: mockClient,
        verifySignatures: true,
        autoReconnect: false,
      });

      await secureChannel.connect();

      const body = JSON.stringify({ type: "event_callback", event: { type: "message" } });
      const res = await postToSlack(securePort, body, {
        "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-slack-signature": "v0=invalid",
      });

      expect(res.status).toBe(401);

      await secureChannel.disconnect();
    });

    it("should accept requests with valid signatures", async () => {
      const securePort = nextPort();
      const secureChannel = new SlackChannel({
        name: "secure-slack-valid",
        botToken: "xoxb-test-token",
        signingSecret,
        port: securePort,
        host: "127.0.0.1",
        client: mockClient,
        verifySignatures: true,
        autoReconnect: false,
      });

      await secureChannel.connect();

      const body = JSON.stringify({
        type: "url_verification",
        challenge: "valid-test",
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = makeSlackSignature(signingSecret, body, timestamp);

      const res = await postToSlack(securePort, body, {
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signature,
      });

      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).challenge).toBe("valid-test");

      await secureChannel.disconnect();
    });
  });

  describe("HTTP method filtering", () => {
    it("should reject non-POST requests", async () => {
      await channel.connect();

      const res = await new Promise<{ status: number }>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port, method: "GET", path: "/" },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
          },
        );
        req.on("error", reject);
        req.end();
      });

      expect(res.status).toBe(405);
    });
  });
});
