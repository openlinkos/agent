/**
 * Tests for the output formatting module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as output from "../src/output.js";

describe("output formatting", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Color functions ---

  describe("color functions", () => {
    it("bold() should wrap text with ANSI codes when FORCE_COLOR is set", () => {
      const origForce = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = "1";
      try {
        const result = output.bold("hello");
        expect(result).toContain("hello");
        expect(result).toContain("\x1b[1m");
      } finally {
        if (origForce === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = origForce;
      }
    });

    it("bold() should return plain text when NO_COLOR is set", () => {
      const origNo = process.env.NO_COLOR;
      process.env.NO_COLOR = "1";
      try {
        const result = output.bold("hello");
        expect(result).toBe("hello");
      } finally {
        if (origNo === undefined) delete process.env.NO_COLOR;
        else process.env.NO_COLOR = origNo;
      }
    });

    it("dim() should wrap text", () => {
      const origForce = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = "1";
      try {
        expect(output.dim("test")).toContain("test");
      } finally {
        if (origForce === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = origForce;
      }
    });

    it("red() should wrap text", () => {
      const origForce = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = "1";
      try {
        expect(output.red("err")).toContain("err");
        expect(output.red("err")).toContain("\x1b[31m");
      } finally {
        if (origForce === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = origForce;
      }
    });

    it("green() should wrap text", () => {
      const origForce = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = "1";
      try {
        expect(output.green("ok")).toContain("\x1b[32m");
      } finally {
        if (origForce === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = origForce;
      }
    });

    it("cyan() should wrap text", () => {
      const origForce = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = "1";
      try {
        expect(output.cyan("info")).toContain("\x1b[36m");
      } finally {
        if (origForce === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = origForce;
      }
    });
  });

  // --- Output helpers ---

  describe("output helpers", () => {
    it("info() should log a message to stdout", () => {
      output.info("test message");
      expect(logSpy).toHaveBeenCalledTimes(1);
      const msg = logSpy.mock.calls[0][0] as string;
      expect(msg).toContain("test message");
    });

    it("success() should log a message to stdout", () => {
      output.success("done");
      expect(logSpy).toHaveBeenCalledTimes(1);
      const msg = logSpy.mock.calls[0][0] as string;
      expect(msg).toContain("done");
    });

    it("warn() should log to stderr", () => {
      output.warn("careful");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const msg = errorSpy.mock.calls[0][0] as string;
      expect(msg).toContain("careful");
    });

    it("error() should log to stderr with optional detail", () => {
      output.error("bad thing", "details here");
      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy.mock.calls[0][0]).toContain("bad thing");
      expect(errorSpy.mock.calls[1][0]).toContain("details here");
    });

    it("error() should log to stderr without detail", () => {
      output.error("bad thing");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain("bad thing");
    });

    it("debug() should log when verbose is true", () => {
      output.debug("debug msg", true);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain("debug msg");
    });

    it("debug() should not log when verbose is false", () => {
      output.debug("debug msg", false);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("header() should log a header", () => {
      output.header("Title");
      expect(logSpy).toHaveBeenCalled();
      const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(allOutput).toContain("Title");
    });

    it("formatUsage() should format token counts", () => {
      const result = output.formatUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      expect(result).toContain("100");
      expect(result).toContain("50");
      expect(result).toContain("150");
    });
  });
});
