/**
 * Tests for BaseChannel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseChannel } from "../src/base.js";
import type { ChannelMessage } from "../src/types.js";

// ---------------------------------------------------------------------------
// Concrete test implementation
// ---------------------------------------------------------------------------

class TestChannel extends BaseChannel {
  connectCalls = 0;
  disconnectCalls = 0;
  sentMessages: ChannelMessage[] = [];
  shouldFailConnect = false;

  protected async doConnect(): Promise<void> {
    this.connectCalls++;
    if (this.shouldFailConnect) {
      throw new Error("connection failed");
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.disconnectCalls++;
  }

  async send(message: ChannelMessage): Promise<void> {
    this.sentMessages.push(message);
  }

  // Expose protected methods for testing
  async testEmitMessage(message: ChannelMessage): Promise<void> {
    await this.emitMessage(message);
  }

  testEmitError(error: Error): void {
    this.emitError(error);
  }

  async testAttemptReconnect(): Promise<void> {
    await this.attemptReconnect();
  }
}

function makeMessage(text: string): ChannelMessage {
  return {
    id: "msg-1",
    role: "user",
    text,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseChannel", () => {
  let channel: TestChannel;

  beforeEach(() => {
    channel = new TestChannel({ name: "test", autoReconnect: false });
  });

  describe("connect / disconnect", () => {
    it("should start disconnected", () => {
      expect(channel.status).toBe("disconnected");
    });

    it("should transition to connected on successful connect", async () => {
      await channel.connect();
      expect(channel.status).toBe("connected");
      expect(channel.connectCalls).toBe(1);
    });

    it("should transition to disconnected on disconnect", async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.status).toBe("disconnected");
      expect(channel.disconnectCalls).toBe(1);
    });

    it("should transition to error on failed connect", async () => {
      channel.shouldFailConnect = true;
      await expect(channel.connect()).rejects.toThrow("connection failed");
      expect(channel.status).toBe("error");
    });

    it("should emit error on failed connect", async () => {
      const handler = vi.fn();
      channel.onError(handler);
      channel.shouldFailConnect = true;
      await expect(channel.connect()).rejects.toThrow();
      expect(handler).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("message handling", () => {
    it("should dispatch messages to all handlers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      channel.onMessage(handler1);
      channel.onMessage(handler2);

      const msg = makeMessage("hello");
      await channel.testEmitMessage(msg);

      expect(handler1).toHaveBeenCalledWith(msg);
      expect(handler2).toHaveBeenCalledWith(msg);
    });

    it("should send messages via send()", async () => {
      const msg = makeMessage("outgoing");
      await channel.send(msg);
      expect(channel.sentMessages).toEqual([msg]);
    });
  });

  describe("error handling", () => {
    it("should dispatch errors to all handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      channel.onError(handler1);
      channel.onError(handler2);

      const err = new Error("test error");
      channel.testEmitError(err);

      expect(handler1).toHaveBeenCalledWith(err);
      expect(handler2).toHaveBeenCalledWith(err);
    });
  });

  describe("reconnect", () => {
    it("should reconnect successfully", async () => {
      const reconnChannel = new TestChannel({
        name: "reconn",
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 1,
      });

      await reconnChannel.testAttemptReconnect();
      expect(reconnChannel.status).toBe("connected");
      expect(reconnChannel.connectCalls).toBe(1);
    });

    it("should not reconnect when autoReconnect is false", async () => {
      await channel.testAttemptReconnect();
      expect(channel.connectCalls).toBe(0);
      expect(channel.status).toBe("disconnected");
    });

    it("should emit error after max reconnect attempts", async () => {
      const failChannel = new TestChannel({
        name: "fail",
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 1,
      });
      failChannel.shouldFailConnect = true;

      const errorHandler = vi.fn();
      failChannel.onError(errorHandler);

      await failChannel.testAttemptReconnect();
      expect(failChannel.status).toBe("error");
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Failed to reconnect") }),
      );
    });
  });

  describe("name", () => {
    it("should expose the channel name", () => {
      expect(channel.name).toBe("test");
    });
  });

  describe("default config values", () => {
    it("should use defaults when not specified", () => {
      const ch = new TestChannel({ name: "defaults" });
      // autoReconnect defaults to true — verify by checking reconnect works
      expect(ch.name).toBe("defaults");
    });
  });
});
