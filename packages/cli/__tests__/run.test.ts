/**
 * Tests for the `run` command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the loader
vi.mock("../src/utils/loader.js", () => ({
  loadConfigFile: vi.fn(),
  isAgentLike: vi.fn(),
}));

import { runCommand } from "../src/commands/run.js";
import { loadConfigFile, isAgentLike } from "../src/utils/loader.js";

describe("runCommand", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should run an agent with provided input", async () => {
    const mockAgent = {
      name: "test-agent",
      run: vi.fn().mockResolvedValue({
        text: "Hello from agent",
        agentName: "test-agent",
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockAgent,
      filePath: "/path/to/agent.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(true);

    await runCommand("agent.ts", { input: "What is 2+2?" });

    expect(loadConfigFile).toHaveBeenCalledWith("agent.ts");
    expect(mockAgent.run).toHaveBeenCalledWith("What is 2+2?");
  });

  it("should throw if config file does not export an agent", async () => {
    vi.mocked(loadConfigFile).mockResolvedValue({
      module: { notAnAgent: true },
      filePath: "/path/to/config.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(false);

    await expect(
      runCommand("config.ts", { input: "test" }),
    ).rejects.toThrow("Config file must export an Agent");
  });

  it("should throw if input is empty string", async () => {
    const mockAgent = {
      name: "test-agent",
      run: vi.fn(),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockAgent,
      filePath: "/path/to/agent.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(true);

    await expect(
      runCommand("agent.ts", { input: "" }),
    ).rejects.toThrow("No input provided");
  });

  it("should throw if input is whitespace", async () => {
    const mockAgent = {
      name: "test-agent",
      run: vi.fn(),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockAgent,
      filePath: "/path/to/agent.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(true);

    await expect(
      runCommand("agent.ts", { input: "   " }),
    ).rejects.toThrow("No input provided");
  });

  it("should display agent response with name and text", async () => {
    const mockAgent = {
      name: "my-agent",
      run: vi.fn().mockResolvedValue({
        text: "Response text",
        agentName: "my-agent",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockAgent,
      filePath: "/path/to/agent.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(true);

    await runCommand("agent.ts", { input: "hello" });

    expect(mockAgent.run).toHaveBeenCalledWith("hello");
  });

  it("should use agent.name as fallback when agentName not in response", async () => {
    const mockAgent = {
      name: "fallback-agent",
      run: vi.fn().mockResolvedValue({
        text: "Response text",
        steps: [],
        toolCalls: [],
      }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockAgent,
      filePath: "/path/to/agent.ts",
    });
    vi.mocked(isAgentLike).mockReturnValue(true);

    await runCommand("agent.ts", { input: "hello" });

    expect(mockAgent.run).toHaveBeenCalledWith("hello");
  });
});
