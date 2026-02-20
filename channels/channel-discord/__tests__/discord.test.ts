/**
 * Tests for DiscordChannel.
 *
 * All Discord API calls are mocked via an injected gateway.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiscordChannel } from "../src/index.js";
import type { DiscordGateway, DiscordMessageData, DiscordInteraction } from "../src/index.js";

// ---------------------------------------------------------------------------
// Mock gateway
// ---------------------------------------------------------------------------

function createMockGateway(): DiscordGateway & {
  simulateMessage: (msg: DiscordMessageData) => void;
  simulateInteraction: (interaction: DiscordInteraction) => void;
} {
  let messageHandler: ((msg: DiscordMessageData) => void) | null = null;
  let interactionHandler: ((interaction: DiscordInteraction) => void) | null = null;

  return {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    onMessage(handler) {
      messageHandler = handler;
    },
    onInteraction(handler) {
      interactionHandler = handler;
    },
    sendMessage: vi.fn(async () => {}),
    sendInteractionResponse: vi.fn(async () => {}),
    addReaction: vi.fn(async () => {}),
    simulateMessage(msg) {
      messageHandler?.(msg);
    },
    simulateInteraction(interaction) {
      interactionHandler?.(interaction);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DiscordChannel", () => {
  let channel: DiscordChannel;
  let gateway: ReturnType<typeof createMockGateway>;

  beforeEach(() => {
    gateway = createMockGateway();
    channel = new DiscordChannel({
      name: "test-discord",
      botToken: "test-token",
      autoReconnect: false,
      gateway,
    });
  });

  afterEach(async () => {
    if (channel.status === "connected") {
      await channel.disconnect();
    }
  });

  describe("connect / disconnect", () => {
    it("should connect via gateway", async () => {
      await channel.connect();
      expect(channel.status).toBe("connected");
      expect(gateway.connect).toHaveBeenCalled();
    });

    it("should disconnect via gateway", async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.status).toBe("disconnected");
      expect(gateway.disconnect).toHaveBeenCalled();
    });
  });

  describe("receiving messages", () => {
    it("should emit channel messages from Discord messages", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      gateway.simulateMessage({
        id: "msg-1",
        channel_id: "ch-1",
        guild_id: "guild-1",
        author: { id: "user-1", username: "testuser", discriminator: "0001" },
        content: "hello bot",
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      const msg = handler.mock.calls[0][0];
      expect(msg.text).toBe("hello bot");
      expect(msg.role).toBe("user");
      expect(msg.metadata?.platform).toBe("discord");
      expect(msg.metadata?.channelId).toBe("ch-1");
    });

    it("should skip bot messages", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      gateway.simulateMessage({
        id: "msg-2",
        channel_id: "ch-1",
        author: { id: "bot-1", username: "bot", discriminator: "0000", bot: true },
        content: "I am a bot",
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).not.toHaveBeenCalled();
    });

    it("should filter by guildId when set", async () => {
      const guildChannel = new DiscordChannel({
        name: "guild-discord",
        botToken: "test-token",
        guildId: "guild-1",
        autoReconnect: false,
        gateway,
      });

      const handler = vi.fn();
      guildChannel.onMessage(handler);
      await guildChannel.connect();

      // Message from wrong guild
      gateway.simulateMessage({
        id: "msg-3",
        channel_id: "ch-1",
        guild_id: "guild-2",
        author: { id: "user-1", username: "user", discriminator: "0001" },
        content: "wrong guild",
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).not.toHaveBeenCalled();

      // Message from correct guild
      gateway.simulateMessage({
        id: "msg-4",
        channel_id: "ch-1",
        guild_id: "guild-1",
        author: { id: "user-1", username: "user", discriminator: "0001" },
        content: "right guild",
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);

      await guildChannel.disconnect();
    });
  });

  describe("slash commands", () => {
    it("should emit channel messages from slash command interactions", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      gateway.simulateInteraction({
        id: "int-1",
        type: 2, // APPLICATION_COMMAND
        channel_id: "ch-1",
        guild_id: "guild-1",
        member: {
          user: { id: "user-1", username: "user", discriminator: "0001" },
        },
        data: {
          name: "ask",
          options: [{ name: "question", value: "What is AI?" }],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      const msg = handler.mock.calls[0][0];
      expect(msg.text).toBe("/ask question=What is AI?");
      expect(msg.metadata?.isSlashCommand).toBe(true);
      expect(msg.metadata?.commandName).toBe("ask");
    });

    it("should ignore non-slash-command interactions", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      await channel.connect();

      gateway.simulateInteraction({
        id: "int-2",
        type: 1, // PING
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("sending messages", () => {
    it("should send messages via gateway", async () => {
      await channel.connect();

      await channel.send({
        id: "out-1",
        role: "assistant",
        text: "Hello!",
        timestamp: new Date().toISOString(),
        metadata: { channelId: "ch-1" },
      });

      expect(gateway.sendMessage).toHaveBeenCalledWith("ch-1", "Hello!", undefined);
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

    it("should send with embeds", async () => {
      await channel.connect();

      const embeds = [{ title: "Test", description: "Embed" }];
      await channel.send({
        id: "out-3",
        role: "assistant",
        text: "With embed",
        timestamp: new Date().toISOString(),
        metadata: { channelId: "ch-1", embeds },
      });

      expect(gateway.sendMessage).toHaveBeenCalledWith("ch-1", "With embed", embeds);
    });
  });

  describe("reactions", () => {
    it("should add reactions via gateway", async () => {
      await channel.connect();
      await channel.addReaction("ch-1", "msg-1", "👍");
      expect(gateway.addReaction).toHaveBeenCalledWith("ch-1", "msg-1", "👍");
    });
  });

  describe("interaction responses", () => {
    it("should respond to interactions via gateway", async () => {
      await channel.connect();
      await channel.respondToInteraction("int-1", "token-1", "Response");
      expect(gateway.sendInteractionResponse).toHaveBeenCalledWith("int-1", "token-1", "Response");
    });
  });
});
