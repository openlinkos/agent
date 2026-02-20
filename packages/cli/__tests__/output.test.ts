/**
 * Tests for output formatting utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bold,
  dim,
  red,
  green,
  yellow,
  blue,
  cyan,
  info,
  success,
  warn,
  error,
  debug,
  header,
  formatUsage,
} from "../src/output.js";

// ---------------------------------------------------------------------------
// Color function tests
// ---------------------------------------------------------------------------

describe("color functions", () => {
  const originalEnv = process.env;
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("should return colored text when FORCE_COLOR is set", () => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
    delete process.env.NO_COLOR;
    expect(red("error")).toContain("\x1b[31m");
    expect(red("error")).toContain("error");
    expect(red("error")).toContain("\x1b[0m");
  });

  it("should return plain text when NO_COLOR is set", () => {
    process.env = { ...originalEnv, NO_COLOR: "1" };
    expect(red("error")).toBe("error");
    expect(green("ok")).toBe("ok");
    expect(blue("info")).toBe("info");
  });

  it("should wrap text with ANSI codes for each color function", () => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
    delete process.env.NO_COLOR;
    expect(bold("text")).toContain("\x1b[1m");
    expect(dim("text")).toContain("\x1b[2m");
    expect(red("text")).toContain("\x1b[31m");
    expect(green("text")).toContain("\x1b[32m");
    expect(yellow("text")).toContain("\x1b[33m");
    expect(blue("text")).toContain("\x1b[34m");
    expect(cyan("text")).toContain("\x1b[36m");
  });
});

// ---------------------------------------------------------------------------
// Output helper tests
// ---------------------------------------------------------------------------

describe("output helpers", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.NO_COLOR = "1";
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.NO_COLOR;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("info() should log with info prefix", () => {
    info("test message");
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("test message");
  });

  it("success() should log with success prefix", () => {
    success("done");
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("done");
  });

  it("warn() should log to stderr", () => {
    warn("warning");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain("warning");
  });

  it("error() should log to stderr with optional detail", () => {
    error("failed", "some detail");
    expect(errorSpy).toHaveBeenCalledTimes(2);
    const msg = errorSpy.mock.calls[0][0] as string;
    const detail = errorSpy.mock.calls[1][0] as string;
    expect(msg).toContain("failed");
    expect(detail).toContain("some detail");
  });

  it("error() should log only message when no detail", () => {
    error("failed");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("debug() should only log when verbose is true", () => {
    debug("verbose msg", false);
    expect(errorSpy).not.toHaveBeenCalled();

    debug("verbose msg", true);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain("verbose msg");
  });

  it("header() should print bold header with underline", () => {
    header("Test Section");
    expect(logSpy).toHaveBeenCalledTimes(2);
    const titleLine = logSpy.mock.calls[0][0] as string;
    expect(titleLine).toContain("Test Section");
  });
});

// ---------------------------------------------------------------------------
// Format usage tests
// ---------------------------------------------------------------------------

describe("formatUsage", () => {
  it("should format token counts", () => {
    process.env.NO_COLOR = "1";
    const result = formatUsage({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    expect(result).toContain("prompt=100");
    expect(result).toContain("completion=50");
    expect(result).toContain("total=150");
    delete process.env.NO_COLOR;
  });
});
