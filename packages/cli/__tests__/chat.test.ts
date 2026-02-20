/**
 * Tests for the `chat` command.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the loader
vi.mock("../src/utils/loader.js", () => ({
  loadConfigFile: vi.fn(),
  isAgentLike: vi.fn(),
}));

// Mock readline so chat doesn't hang
vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => {
    const rl = {
      question: vi.fn((_prompt: string, cb: (answer: string) => void) => {
        // Simulate user typing "exit"
        setTimeout(() => cb("exit"), 10);
      }),
      on: vi.fn(() => rl),
      close: vi.fn(),
    };
    return rl;
  }),
}));

import { chatCommand } from "../src/commands/chat.js";
import { loadConfigFile, isAgentLike } from "../src/utils/loader.js";

describe("chatCommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should throw if config file does not export an agent", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: { notAnAgent: true },
      filePath: "/path/to/config.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(false);

    await expect(chatCommand("config.ts")).rejects.toThrow(
      "Config file must export an Agent",
    );
  });

  it("should load the agent config file and start session", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const mockAgent = {
      name: "chat-agent",
      run: vi.fn().mockResolvedValue({ text: "Hi!" }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockAgent,
      filePath: "/path/to/agent.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(true);

    await chatCommand("agent.ts");

    expect(loadConfigFile).toHaveBeenCalledWith("agent.ts");
  });
});
