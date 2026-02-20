/**
 * Tests for TelegramChannel.
 *
 * All Telegram API calls are mocked — no real network requests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelegramChannel } from "../src/index.js";
import type { TelegramUpdate } from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApiCall() {
  return vi.fn(async (_method: string, _body: Record<string, unknown>) => {
    return { ok: true, result: [] };
  });
}

function makeUpdate(text: string, chatId = 123, updateId = 1): TelegramUpdate {
  return {
    update_id: updateId,
    message: {
      message_id: 1,
      chat: { id: chatId, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text,
      from: { id: 456, is_bot: false, first_name: "Test" },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TelegramChannel", () => {
  let channel: TelegramChannel;
  let mockApi: ReturnType<typeof createMockApiCall>;

  beforeEach(() => {
    mockApi = createMockApiCall();
    channel = new TelegramChannel({
      name: "test-telegram",
      botToken: "test-token",
      pollingInterval: 50,
      autoReconnect: false,
      apiCall: mockApi,
    });
  });

  afterEach(async () => {
    if (channel.status === "connected") {
      await channel.disconnect();
    }
  });

  describe("connect / disconnect (polling mode)", () => {
    it("should connect in polling mode", async () => {
      await channel.connect();
      expect(channel.status).toBe("connected");
    });

    it("should call getUpdates when polling", async () => {
      await channel.connect();
      // Wait for at least one poll cycle
      await new Promise((resolve) => setTimeout(resolve, 100));
      await channel.disconnect();

      expect(mockApi).toHaveBeenCalledWith("getUpdates", expect.objectContaining({
        offset: expect.any(Number),
      }));
    });

    it("should disconnect cleanly", async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.status).toBe("disconnected");
    });
  });

  describe("connect / disconnect (webhook mode)", () => {
    let webhookChannel: TelegramChannel;

    beforeEach(() => {
      webhookChannel = new TelegramChannel({
        name: "test-telegram-webhook",
        botToken: "test-token",
        webhookUrl: "https://example.com/webhook",
        webhookPort: 19200 + Math.floor(Math.random() * 100),
        autoReconnect: false,
        apiCall: mockApi,
      });
    });

    afterEach(async () => {
      if (webhookChannel.status === "connected") {
        await webhookChannel.disconnect();
      }
    });

    it("should register webhook on connect", async () => {
      await webhookChannel.connect();
      expect(mockApi).toHaveBeenCalledWith("setWebhook", {
        url: "https://example.com/webhook",
      });
      expect(webhookChannel.status).toBe("connected");
    });

    it("should disconnect webhook server cleanly", async () => {
      await webhookChannel.connect();
      await webhookChannel.disconnect();
      expect(webhookChannel.status).toBe("disconnected");
    });
  });

  describe("receiving messages (polling)", () => {
    it("should emit channel messages from polling updates", async () => {
      const update = makeUpdate("hello bot");

      // First call returns the update, subsequent calls return empty
      let callCount = 0;
      mockApi.mockImplementation(async (method: string) => {
        if (method === "getUpdates") {
          callCount++;
          if (callCount === 1) {
            return { ok: true, result: [update] };
          }
          return { ok: true, result: [] };
        }
        return { ok: true };
      });

      const handler = vi.fn();
      channel.onMessage(handler);

      await channel.connect();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await channel.disconnect();

      expect(handler).toHaveBeenCalled();
      const msg = handler.mock.calls[0][0];
      expect(msg.text).toBe("hello bot");
      expect(msg.role).toBe("user");
      expect(msg.metadata?.platform).toBe("telegram");
      expect(msg.metadata?.chatId).toBe(123);
    });
  });

  describe("sending messages", () => {
    it("should call sendMessage API with correct params", async () => {
      await channel.connect();

      await channel.send({
        id: "out-1",
        role: "assistant",
        text: "Hello user!",
        timestamp: new Date().toISOString(),
        metadata: { chatId: 123 },
      });

      expect(mockApi).toHaveBeenCalledWith("sendMessage", expect.objectContaining({
        chat_id: 123,
        text: "Hello user!",
      }));
    });

    it("should throw if chatId is missing", async () => {
      await channel.connect();
      await expect(
        channel.send({
          id: "out-2",
          role: "assistant",
          text: "No chat ID",
          timestamp: new Date().toISOString(),
        }),
      ).rejects.toThrow("chatId");
    });

    it("should send inline keyboard when provided", async () => {
      await channel.connect();

      const replyMarkup = {
        inline_keyboard: [[{ text: "Yes", callback_data: "yes" }]],
      };

      await channel.send({
        id: "out-3",
        role: "assistant",
        text: "Choose:",
        timestamp: new Date().toISOString(),
        metadata: { chatId: 123, replyMarkup },
      });

      expect(mockApi).toHaveBeenCalledWith("sendMessage", expect.objectContaining({
        reply_markup: replyMarkup,
      }));
    });

    it("should support parse mode", async () => {
      await channel.connect();

      await channel.send({
        id: "out-4",
        role: "assistant",
        text: "<b>Bold</b>",
        timestamp: new Date().toISOString(),
        metadata: { chatId: 123, parseMode: "HTML" },
      });

      expect(mockApi).toHaveBeenCalledWith("sendMessage", expect.objectContaining({
        parse_mode: "HTML",
      }));
    });
  });

  describe("callApi", () => {
    it("should forward arbitrary API calls", async () => {
      await channel.connect();
      await channel.callApi("getMe", {});
      expect(mockApi).toHaveBeenCalledWith("getMe", {});
    });
  });
});
