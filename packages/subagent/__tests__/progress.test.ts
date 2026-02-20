/**
 * Tests for progress and result protocol.
 */

import { describe, it, expect, vi } from "vitest";
import {
  createProgressCollector,
  summarizeResult,
  summarizeResults,
} from "../src/progress.js";
import type { SubAgentResult, ProgressUpdate } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<SubAgentResult> = {}): SubAgentResult {
  return {
    agentName: "test-agent",
    response: {
      text: "Test response",
      steps: [
        {
          stepNumber: 1,
          modelResponse: {
            text: "Test response",
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            finishReason: "stop",
          },
          toolCalls: [],
        },
      ],
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      agentName: "test-agent",
    },
    success: true,
    durationMs: 100,
    tokens: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    steps: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createProgressCollector tests
// ---------------------------------------------------------------------------

describe("createProgressCollector", () => {
  it("should collect progress updates", () => {
    const collector = createProgressCollector();

    collector.callback({
      agentName: "agent-1",
      type: "started",
      message: "Started",
      timestamp: 1000,
    });

    collector.callback({
      agentName: "agent-1",
      type: "completed",
      message: "Completed",
      timestamp: 2000,
    });

    const updates = collector.getUpdates();
    expect(updates).toHaveLength(2);
    expect(updates[0].type).toBe("started");
    expect(updates[1].type).toBe("completed");
  });

  it("should forward updates to callback", () => {
    const forwardFn = vi.fn();
    const collector = createProgressCollector(forwardFn);

    const update: ProgressUpdate = {
      agentName: "agent-1",
      type: "started",
      message: "Started",
      timestamp: 1000,
    };

    collector.callback(update);

    expect(forwardFn).toHaveBeenCalledTimes(1);
    expect(forwardFn).toHaveBeenCalledWith(update);
  });

  it("should return copies of updates array", () => {
    const collector = createProgressCollector();

    collector.callback({
      agentName: "a",
      type: "started",
      message: "Started",
      timestamp: 1000,
    });

    const updates1 = collector.getUpdates();
    const updates2 = collector.getUpdates();

    expect(updates1).toEqual(updates2);
    expect(updates1).not.toBe(updates2); // different array instances
  });

  it("should work without forward callback", () => {
    const collector = createProgressCollector();

    collector.callback({
      agentName: "a",
      type: "step",
      message: "Step 1",
      timestamp: 1000,
      stepNumber: 1,
    });

    expect(collector.getUpdates()).toHaveLength(1);
    expect(collector.getUpdates()[0].stepNumber).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// summarizeResult tests
// ---------------------------------------------------------------------------

describe("summarizeResult", () => {
  it("should summarize a successful result", () => {
    const result = makeResult();
    const summary = summarizeResult(result);

    expect(summary.agentName).toBe("test-agent");
    expect(summary.status).toBe("success");
    expect(summary.text).toBe("Test response");
    expect(summary.durationMs).toBe(100);
    expect(summary.totalTokens).toBe(15);
    expect(summary.steps).toBe(1);
    expect(summary.error).toBeUndefined();
  });

  it("should summarize a failed result with no steps as failure", () => {
    const result = makeResult({
      success: false,
      error: "Timed out",
      response: {
        text: "",
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        agentName: "test-agent",
      },
      tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      steps: 0,
    });

    const summary = summarizeResult(result);

    expect(summary.status).toBe("failure");
    expect(summary.error).toBe("Timed out");
  });

  it("should summarize a failed result with some steps as partial", () => {
    const result = makeResult({
      success: false,
      error: "Timed out after some progress",
    });

    const summary = summarizeResult(result);

    expect(summary.status).toBe("partial");
    expect(summary.error).toBe("Timed out after some progress");
  });
});

// ---------------------------------------------------------------------------
// summarizeResults tests
// ---------------------------------------------------------------------------

describe("summarizeResults", () => {
  it("should summarize multiple results", () => {
    const results = [
      makeResult({ agentName: "a1" }),
      makeResult({ agentName: "a2", success: false, error: "fail" }),
    ];

    const summaries = summarizeResults(results);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].agentName).toBe("a1");
    expect(summaries[0].status).toBe("success");
    expect(summaries[1].agentName).toBe("a2");
    expect(summaries[1].status).toBe("partial"); // has steps, so partial
  });

  it("should handle empty array", () => {
    expect(summarizeResults([])).toEqual([]);
  });
});
