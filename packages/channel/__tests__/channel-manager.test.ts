/**
 * Tests for ChannelManager.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelManager } from "../src/manager.js";
import type { Channel, ChannelMessage, ChannelStatus, MessageHandler, ErrorHandler } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock channel
// ---------------------------------------------------------------------------

function createMockChannel(name: string): Channel & {
  _messageHandlers: MessageHandler[];
  _errorHandlers: ErrorHandler[];
  _status: ChannelStatus;
  simulateMessage: (msg: ChannelMessage) => Promise<void>;
  simulateError: (err: Error) => void;
} {
  const _messageHandlers: MessageHandler[] = [];
  const _errorHandlers: ErrorHandler[] = [];

  const channel = {
    name,
    _status: "disconnected" as ChannelStatus,
    _messageHandlers,
    _errorHandlers,
    get status() {
      return this._status;
    },
    connect: vi.fn(async function (this: typeof channel) {
      this._status = "connected";
    }),
    disconnect: vi.fn(async function (this: typeof channel) {
      this._status = "disconnected";
    }),
    onMessage(handler: MessageHandler) {
      _messageHandlers.push(handler);
    },
    onError(handler: ErrorHandler) {
      _errorHandlers.push(handler);
    },
    send: vi.fn(async () => {}),
    async simulateMessage(msg: ChannelMessage) {
      for (const h of _messageHandlers) {
        await h(msg);
      }
    },
    simulateError(err: Error) {
      for (const h of _errorHandlers) {
        h(err);
      }
    },
  };
  return channel;
}

function makeMessage(text: string): ChannelMessage {
  return {
    id: "msg-1",
    role: "assistant",
    text,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChannelManager", () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  describe("add / remove / get / list", () => {
    it("should add a channel", () => {
      const ch = createMockChannel("slack");
      manager.add(ch);
      expect(manager.list()).toEqual(["slack"]);
    });

    it("should get a channel by name", () => {
      const ch = createMockChannel("discord");
      manager.add(ch);
      expect(manager.get("discord")).toBe(ch);
    });

    it("should return undefined for unknown channel", () => {
      expect(manager.get("nonexistent")).toBeUndefined();
    });

    it("should throw when adding duplicate channel name", () => {
      manager.add(createMockChannel("dup"));
      expect(() => manager.add(createMockChannel("dup"))).toThrow(
        'Channel "dup" is already registered',
      );
    });

    it("should remove a channel", async () => {
      const ch = createMockChannel("rm");
      manager.add(ch);
      await manager.remove("rm");
      expect(manager.list()).toEqual([]);
    });

    it("should disconnect channel on remove if connected", async () => {
      const ch = createMockChannel("active");
      manager.add(ch);
      await ch.connect();
      await manager.remove("active");
      expect(ch.disconnect).toHaveBeenCalled();
    });

    it("should throw when removing unknown channel", async () => {
      await expect(manager.remove("unknown")).rejects.toThrow(
        'Channel "unknown" is not registered',
      );
    });
  });

  describe("connectAll / disconnectAll", () => {
    it("should connect all channels", async () => {
      const ch1 = createMockChannel("a");
      const ch2 = createMockChannel("b");
      manager.add(ch1);
      manager.add(ch2);

      await manager.connectAll();
      expect(ch1.connect).toHaveBeenCalled();
      expect(ch2.connect).toHaveBeenCalled();
    });

    it("should disconnect all channels", async () => {
      const ch1 = createMockChannel("a");
      const ch2 = createMockChannel("b");
      manager.add(ch1);
      manager.add(ch2);

      await manager.disconnectAll();
      expect(ch1.disconnect).toHaveBeenCalled();
      expect(ch2.disconnect).toHaveBeenCalled();
    });
  });

  describe("message forwarding", () => {
    it("should forward messages from channels to manager handlers", async () => {
      const ch = createMockChannel("fwd");
      manager.add(ch);

      const handler = vi.fn();
      manager.onMessage(handler);

      const msg = makeMessage("hello");
      await ch.simulateMessage(msg);

      expect(handler).toHaveBeenCalledWith(msg);
    });
  });

  describe("error forwarding", () => {
    it("should forward errors from channels to manager handlers", () => {
      const ch = createMockChannel("err");
      manager.add(ch);

      const handler = vi.fn();
      manager.onError(handler);

      const err = new Error("channel error");
      ch.simulateError(err);

      expect(handler).toHaveBeenCalledWith(err);
    });
  });

  describe("broadcast", () => {
    it("should send message to all connected channels", async () => {
      const ch1 = createMockChannel("x");
      const ch2 = createMockChannel("y");
      manager.add(ch1);
      manager.add(ch2);

      await ch1.connect();
      await ch2.connect();

      const msg = makeMessage("broadcast");
      await manager.broadcast(msg);

      expect(ch1.send).toHaveBeenCalledWith(msg);
      expect(ch2.send).toHaveBeenCalledWith(msg);
    });

    it("should skip disconnected channels on broadcast", async () => {
      const ch1 = createMockChannel("connected");
      const ch2 = createMockChannel("disconnected");
      manager.add(ch1);
      manager.add(ch2);

      await ch1.connect();
      // ch2 stays disconnected

      const msg = makeMessage("partial");
      await manager.broadcast(msg);

      expect(ch1.send).toHaveBeenCalledWith(msg);
      expect(ch2.send).not.toHaveBeenCalled();
    });
  });

  describe("sendTo", () => {
    it("should send to a specific channel", async () => {
      const ch = createMockChannel("target");
      manager.add(ch);

      const msg = makeMessage("direct");
      await manager.sendTo("target", msg);

      expect(ch.send).toHaveBeenCalledWith(msg);
    });

    it("should throw for unknown channel", async () => {
      await expect(manager.sendTo("nope", makeMessage("fail"))).rejects.toThrow(
        'Channel "nope" is not registered',
      );
    });
  });
});
