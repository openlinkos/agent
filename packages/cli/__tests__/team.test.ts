/**
 * Tests for the `team` command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the loader
vi.mock("../src/utils/loader.js", () => ({
  loadConfigFile: vi.fn(),
  isTeamLike: vi.fn(),
}));

import { teamCommand } from "../src/commands/team.js";
import { loadConfigFile, isTeamLike } from "../src/utils/loader.js";

describe("teamCommand", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should run a team with provided input", async () => {
    const mockTeam = {
      name: "test-team",
      coordinationMode: "sequential",
      run: vi.fn().mockResolvedValue({
        finalOutput: "Team result",
        agentResults: [
          { agentName: "agent-1", text: "Response 1" },
          { agentName: "agent-2", text: "Response 2" },
        ],
        rounds: 1,
        totalUsage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockTeam,
      filePath: "/path/to/team.ts",
    });
    vi.mocked(isTeamLike).mockReturnValue(true);

    await teamCommand("team.ts", { input: "Solve this problem" });

    expect(loadConfigFile).toHaveBeenCalledWith("team.ts");
    expect(mockTeam.run).toHaveBeenCalledWith("Solve this problem");
  });

  it("should throw if config file does not export a team", async () => {
    vi.mocked(loadConfigFile).mockResolvedValue({
      module: { notATeam: true },
      filePath: "/path/to/config.ts",
    });
    vi.mocked(isTeamLike).mockReturnValue(false);

    await expect(
      teamCommand("config.ts", { input: "test" }),
    ).rejects.toThrow("Config file must export a Team");
  });

  it("should throw if input is empty string", async () => {
    const mockTeam = {
      name: "test-team",
      coordinationMode: "sequential",
      run: vi.fn(),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockTeam,
      filePath: "/path/to/team.ts",
    });
    vi.mocked(isTeamLike).mockReturnValue(true);

    await expect(
      teamCommand("team.ts", { input: "" }),
    ).rejects.toThrow("No input provided");
  });

  it("should handle team result with empty agent results", async () => {
    const mockTeam = {
      name: "minimal-team",
      coordinationMode: "parallel",
      run: vi.fn().mockResolvedValue({
        finalOutput: "Done",
        agentResults: [],
        rounds: 1,
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockTeam,
      filePath: "/path/to/team.ts",
    });
    vi.mocked(isTeamLike).mockReturnValue(true);

    await teamCommand("team.ts", { input: "Do something" });

    expect(mockTeam.run).toHaveBeenCalledWith("Do something");
  });

  it("should display multiple agent results", async () => {
    const mockTeam = {
      name: "multi-team",
      coordinationMode: "debate",
      run: vi.fn().mockResolvedValue({
        finalOutput: "Consensus result",
        agentResults: [
          { agentName: "debater-1", text: "Position A" },
          { agentName: "debater-2", text: "Position B" },
          { agentName: "judge", text: "Ruling" },
        ],
        rounds: 3,
      }),
    };

    vi.mocked(loadConfigFile).mockResolvedValue({
      module: mockTeam,
      filePath: "/path/to/team.ts",
    });
    vi.mocked(isTeamLike).mockReturnValue(true);

    await teamCommand("team.ts", { input: "Debate this" });

    expect(mockTeam.run).toHaveBeenCalledWith("Debate this");
  });
});
