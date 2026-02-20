/**
 * Tests for TerminalChannel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PassThrough } from "node:stream";
import { TerminalChannel } from "../src/terminal.js";
import type { ChannelMessage } from "@openlinkos/channel";

describe("TerminalChannel", () => {
  let input: PassThrough;
  let output: PassThrough;
  let channel: TerminalChannel;

  beforeEach(() => {
    input = new PassThrough();
    output = new PassThrough();
    channel = new TerminalChannel({
      name: "test-terminal",
      input,
      output,
      prompt: "> ",
      autoReconnect: false,
    });
  });

  afterEach(async () => {
    if (channel.status === "connected") {
      await channel.disconnect();
    }
  });

  describe("connect / disconnect", () => {
    it("should connect and set status to connected", async () => {
      await channel.connect();
      expect(channel.status).toBe("connected");
    });

    it("should disconnect and set status to disconnected", async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.status).toBe("disconnected");
    });
  });

  describe("receiving input", () => {
    it("should emit messages for user input lines", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);

      await channel.connect();

      input.write("hello world\n");

      // Allow readline to process the input
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      const msg: ChannelMessage = handler.mock.calls[0][0];
      expect(msg.role).toBe("user");
      expect(msg.text).toBe("hello world");
      expect(msg.metadata?.platform).toBe("terminal");
    });

    it("should ignore empty lines", async () => {
      const handler = vi.fn();
      channel.onMessage(handler);

      await channel.connect();

      input.write("\n");
      input.write("  \n");
      input.write("actual input\n");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].text).toBe("actual input");
    });
  });

  describe("sending output", () => {
    it("should write messages to output stream", async () => {
      await channel.connect();

      const chunks: string[] = [];
      output.on("data", (chunk: Buffer) => {
        chunks.push(chunk.toString());
      });

      const msg: ChannelMessage = {
        id: "out-1",
        role: "assistant",
        text: "Hello from assistant",
        timestamp: new Date().toISOString(),
      };

      await channel.send(msg);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const fullOutput = chunks.join("");
      expect(fullOutput).toContain("Hello from assistant");
    });
  });

  describe("streaming", () => {
    it("should write tokens incrementally", async () => {
      await channel.connect();

      const chunks: string[] = [];
      output.on("data", (chunk: Buffer) => {
        chunks.push(chunk.toString());
      });

      channel.writeToken("Hello");
      channel.writeToken(" world");
      channel.endStream();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const fullOutput = chunks.join("");
      expect(fullOutput).toContain("Hello");
      expect(fullOutput).toContain(" world");
    });
  });

  describe("name", () => {
    it("should expose the channel name", () => {
      expect(channel.name).toBe("test-terminal");
    });
  });
});
