/**
 * Tests for CLI argument parsing and command structure.
 */

import { describe, it, expect } from "vitest";
import { createProgram } from "../src/cli.js";

// ---------------------------------------------------------------------------
// Program structure tests
// ---------------------------------------------------------------------------

describe("createProgram", () => {
  it("should create a program with the correct name", () => {
    const program = createProgram();
    expect(program.name()).toBe("openlinkos");
  });

  it("should have a version set", () => {
    const program = createProgram();
    expect(program.version()).toBe("0.1.0");
  });

  it("should have run, init, chat, and team commands", () => {
    const program = createProgram();
    const commandNames = program.commands.map((cmd) => cmd.name());
    expect(commandNames).toContain("run");
    expect(commandNames).toContain("init");
    expect(commandNames).toContain("chat");
    expect(commandNames).toContain("team");
  });

  it("should have --verbose global option", () => {
    const program = createProgram();
    const verboseOpt = program.options.find((o) => o.long === "--verbose");
    expect(verboseOpt).toBeDefined();
  });

  it("should have --model global option", () => {
    const program = createProgram();
    const modelOpt = program.options.find((o) => o.long === "--model");
    expect(modelOpt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Command option tests
// ---------------------------------------------------------------------------

describe("run command", () => {
  it("should accept a file argument", () => {
    const program = createProgram();
    const runCmd = program.commands.find((c) => c.name() === "run");
    expect(runCmd).toBeDefined();
    // The run command should have one required argument
    const args = runCmd!.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].required).toBe(true);
  });
});

describe("init command", () => {
  it("should accept an optional directory argument", () => {
    const program = createProgram();
    const initCmd = program.commands.find((c) => c.name() === "init");
    expect(initCmd).toBeDefined();
    const args = initCmd!.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].required).toBe(false);
  });
});

describe("chat command", () => {
  it("should accept a file argument", () => {
    const program = createProgram();
    const chatCmd = program.commands.find((c) => c.name() === "chat");
    expect(chatCmd).toBeDefined();
    const args = chatCmd!.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].required).toBe(true);
  });
});

describe("team command", () => {
  it("should accept a file argument and --input option", () => {
    const program = createProgram();
    const teamCmd = program.commands.find((c) => c.name() === "team");
    expect(teamCmd).toBeDefined();
    const args = teamCmd!.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].required).toBe(true);
    const inputOpt = teamCmd!.options.find((o) => o.long === "--input");
    expect(inputOpt).toBeDefined();
  });
});
