/**
 * Comprehensive tests for the @openlinkos/eval package.
 *
 * Tests scorers, runner, reporters, and built-in suites.
 */

import { describe, it, expect, vi } from "vitest";
import type { Agent, AgentResponse } from "@openlinkos/agent";
import type { EvalCase, EvalSuite, Scorer, ScorerResult } from "../src/types.js";
import { runEval, runEvalSuite } from "../src/runner.js";
import { createExactMatchScorer } from "../src/scorers/exact.js";
import { createIncludesScorer } from "../src/scorers/includes.js";
import { createToolCallScorer } from "../src/scorers/tool-call.js";
import { createLLMJudgeScorer } from "../src/scorers/llm-judge.js";
import { createConsoleReporter } from "../src/reporters/console.js";
import { createJSONReporter } from "../src/reporters/json.js";
import { createBasicQASuite } from "../src/suites/basic-qa.js";
import { createToolUseSuite, getExpectedCalls } from "../src/suites/tool-use.js";
import { createMultiTurnSuite } from "../src/suites/multi-turn.js";
import type { Model, ModelResponse as AIModelResponse, Message } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(text: string, toolCalls: AgentResponse["toolCalls"] = []): AgentResponse {
  return {
    text,
    steps: [],
    toolCalls,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    agentName: "test-agent",
  };
}

function createMockAgent(responseText: string): Agent {
  return {
    name: "mock-agent",
    async run(_input: string): Promise<AgentResponse> {
      return makeResponse(responseText);
    },
  };
}

function createToolAgent(text: string, toolCalls: AgentResponse["toolCalls"]): Agent {
  return {
    name: "tool-agent",
    async run(): Promise<AgentResponse> {
      return makeResponse(text, toolCalls);
    },
  };
}

function createErrorAgent(): Agent {
  return {
    name: "error-agent",
    async run(): Promise<AgentResponse> {
      throw new Error("Agent crashed");
    },
  };
}

function createSlowAgent(ms: number): Agent {
  return {
    name: "slow-agent",
    async run(): Promise<AgentResponse> {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return makeResponse("Slow response");
    },
  };
}

// ---------------------------------------------------------------------------
// Exact Match Scorer
// ---------------------------------------------------------------------------

describe("Exact Match Scorer", () => {
  it("should score 1.0 for exact match", () => {
    const scorer = createExactMatchScorer();
    const result = scorer.score(makeResponse("Hello, world!"), "Hello, world!");
    expect(result).toEqual({ score: 1.0, details: "Exact match." });
  });

  it("should score 0.0 for non-match", () => {
    const scorer = createExactMatchScorer();
    const result = scorer.score(makeResponse("Hello"), "Goodbye");
    expect(result.score).toBe(0.0);
    expect(result.details).toContain("Expected");
  });

  it("should trim whitespace by default", () => {
    const scorer = createExactMatchScorer();
    const result = scorer.score(makeResponse("  Hello  "), "Hello");
    expect(result.score).toBe(1.0);
  });

  it("should respect ignoreCase option", () => {
    const scorer = createExactMatchScorer({ ignoreCase: true });
    const result = scorer.score(makeResponse("HELLO"), "hello");
    expect(result.score).toBe(1.0);
  });

  it("should respect collapseWhitespace option", () => {
    const scorer = createExactMatchScorer({ collapseWhitespace: true });
    const result = scorer.score(makeResponse("Hello   world"), "Hello world");
    expect(result.score).toBe(1.0);
  });

  it("should match any expected when given an array", () => {
    const scorer = createExactMatchScorer();
    const result = scorer.score(makeResponse("B"), ["A", "B", "C"]);
    expect(result.score).toBe(1.0);
  });

  it("should fail if no expected values match", () => {
    const scorer = createExactMatchScorer();
    const result = scorer.score(makeResponse("D"), ["A", "B", "C"]);
    expect(result.score).toBe(0.0);
  });

  it("should not trim when trim is false", () => {
    const scorer = createExactMatchScorer({ trim: false });
    const result = scorer.score(makeResponse("  Hello  "), "Hello");
    expect(result.score).toBe(0.0);
  });

  it("should handle empty response", () => {
    const scorer = createExactMatchScorer();
    const result = scorer.score(makeResponse(""), "");
    expect(result.score).toBe(1.0);
  });

  it("should handle null response text", () => {
    const scorer = createExactMatchScorer();
    const response = makeResponse("");
    (response as { text: string | null }).text = null as unknown as string;
    // The scorer handles null via ?? ""
    const result = scorer.score(response, "");
    expect(result.score).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Includes Scorer
// ---------------------------------------------------------------------------

describe("Includes Scorer", () => {
  it("should score 1.0 when response contains the keyword", () => {
    const scorer = createIncludesScorer();
    const result = scorer.score(makeResponse("The capital of France is Paris."), "Paris");
    expect(result.score).toBe(1.0);
  });

  it("should score 0.0 when keyword is missing", () => {
    const scorer = createIncludesScorer();
    const result = scorer.score(makeResponse("The capital of France."), "Paris");
    expect(result.score).toBe(0.0);
  });

  it("should be case-insensitive by default", () => {
    const scorer = createIncludesScorer();
    const result = scorer.score(makeResponse("paris"), "PARIS");
    expect(result.score).toBe(1.0);
  });

  it("should handle case-sensitive mode", () => {
    const scorer = createIncludesScorer({ ignoreCase: false });
    const result = scorer.score(makeResponse("paris"), "Paris");
    expect(result.score).toBe(0.0);
  });

  it("should return partial score for multiple keywords with requireAll", () => {
    const scorer = createIncludesScorer({ requireAll: true });
    const result = scorer.score(
      makeResponse("Paris is beautiful"),
      ["Paris", "London", "Berlin"],
    );
    expect(result.score).toBeCloseTo(1 / 3, 2);
    expect(result.details).toContain("Missing 2/3");
  });

  it("should return 1.0 when all keywords present", () => {
    const scorer = createIncludesScorer({ requireAll: true });
    const result = scorer.score(
      makeResponse("Paris and London and Berlin"),
      ["Paris", "London", "Berlin"],
    );
    expect(result.score).toBe(1.0);
    expect(result.details).toContain("All 3");
  });

  it("should return 1.0 for any match when requireAll is false", () => {
    const scorer = createIncludesScorer({ requireAll: false });
    const result = scorer.score(
      makeResponse("Just Paris here"),
      ["Paris", "London"],
    );
    expect(result.score).toBe(1.0);
  });

  it("should return 0.0 for no matches when requireAll is false", () => {
    const scorer = createIncludesScorer({ requireAll: false });
    const result = scorer.score(
      makeResponse("Nothing here"),
      ["Paris", "London"],
    );
    expect(result.score).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// Tool Call Scorer
// ---------------------------------------------------------------------------

describe("Tool Call Scorer", () => {
  it("should score 1.0 when tool call matches", () => {
    const scorer = createToolCallScorer([{ name: "get_weather" }]);
    const response = makeResponse("Weather result", [
      { id: "tc1", name: "get_weather", arguments: { city: "Tokyo" } },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBe(1.0);
  });

  it("should score 0.0 when expected tool is not called", () => {
    const scorer = createToolCallScorer([{ name: "get_weather" }]);
    const response = makeResponse("No tools", []);
    const result = scorer.score(response, "");
    expect(result.score).toBe(0.0);
    expect(result.details).toContain("Missing");
  });

  it("should verify arguments with partial matching", () => {
    const scorer = createToolCallScorer([
      { name: "search", arguments: { query: "test" } },
    ]);
    const response = makeResponse("Search result", [
      { id: "tc1", name: "search", arguments: { query: "test", limit: 10 } },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBe(1.0);
  });

  it("should fail when arguments don't match", () => {
    const scorer = createToolCallScorer([
      { name: "search", arguments: { query: "expected" } },
    ]);
    const response = makeResponse("Search result", [
      { id: "tc1", name: "search", arguments: { query: "actual" } },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBe(0.0);
  });

  it("should handle ordered matching", () => {
    const scorer = createToolCallScorer(
      [{ name: "search" }, { name: "summarize" }],
      { ordered: true },
    );
    const response = makeResponse("Done", [
      { id: "tc1", name: "search", arguments: {} },
      { id: "tc2", name: "summarize", arguments: {} },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBe(1.0);
  });

  it("should fail ordered matching when order is wrong", () => {
    const scorer = createToolCallScorer(
      [{ name: "search" }, { name: "summarize" }],
      { ordered: true },
    );
    const response = makeResponse("Done", [
      { id: "tc1", name: "summarize", arguments: {} },
      { id: "tc2", name: "search", arguments: {} },
    ]);
    const result = scorer.score(response, "");
    // search is found after summarize's position, summarize is not found after
    expect(result.score).toBeLessThan(1.0);
  });

  it("should handle unordered matching", () => {
    const scorer = createToolCallScorer(
      [{ name: "search" }, { name: "summarize" }],
      { ordered: false },
    );
    const response = makeResponse("Done", [
      { id: "tc1", name: "summarize", arguments: {} },
      { id: "tc2", name: "search", arguments: {} },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBe(1.0);
  });

  it("should penalize extra calls when allowExtra is false", () => {
    const scorer = createToolCallScorer(
      [{ name: "search" }],
      { allowExtra: false },
    );
    const response = makeResponse("Done", [
      { id: "tc1", name: "search", arguments: {} },
      { id: "tc2", name: "extra_tool", arguments: {} },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBeLessThan(1.0);
  });

  it("should handle empty expected calls", () => {
    const scorer = createToolCallScorer([]);
    const response = makeResponse("No tools", []);
    const result = scorer.score(response, "");
    expect(result.score).toBe(1.0);
  });

  it("should fail when no calls expected but calls made", () => {
    const scorer = createToolCallScorer([]);
    const response = makeResponse("Unexpected tool", [
      { id: "tc1", name: "surprise", arguments: {} },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBe(0.0);
  });

  it("should return partial score for partial matches", () => {
    const scorer = createToolCallScorer([
      { name: "search" },
      { name: "translate" },
      { name: "summarize" },
    ]);
    const response = makeResponse("Partial", [
      { id: "tc1", name: "search", arguments: {} },
    ]);
    const result = scorer.score(response, "");
    expect(result.score).toBeCloseTo(1 / 3, 2);
  });
});

// ---------------------------------------------------------------------------
// LLM Judge Scorer
// ---------------------------------------------------------------------------

describe("LLM Judge Scorer", () => {
  function createMockJudgeModel(judgeResponse: string): Model {
    return {
      modelId: "mock:judge",
      async generate(): Promise<AIModelResponse> {
        return {
          text: judgeResponse,
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          finishReason: "stop",
        };
      },
      async stream(): Promise<StreamResult> {
        throw new Error("Not implemented");
      },
      async generateWithTools(): Promise<AIModelResponse> {
        throw new Error("Not implemented");
      },
    };
  }

  it("should parse a valid JSON score from the judge", async () => {
    const model = createMockJudgeModel('{"score": 0.85, "reasoning": "Good answer"}');
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test answer"), "Expected answer");
    expect(result.score).toBe(0.85);
    expect(result.details).toBe("Good answer");
  });

  it("should handle embedded JSON in larger response", async () => {
    const model = createMockJudgeModel('Here is my evaluation: {"score": 0.7, "reasoning": "Mostly correct"} end');
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test"), "Expected");
    expect(result.score).toBe(0.7);
  });

  it("should clamp scores to [0, 1] range", async () => {
    const model = createMockJudgeModel('{"score": 1.5, "reasoning": "Too high"}');
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test"), "Expected");
    expect(result.score).toBe(1.0);
  });

  it("should handle negative scores", async () => {
    const model = createMockJudgeModel('{"score": -0.5, "reasoning": "Negative"}');
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test"), "Expected");
    expect(result.score).toBe(0.0);
  });

  it("should fall back to number extraction on invalid JSON", async () => {
    const model = createMockJudgeModel("I give this a 0.6 out of 1.0");
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test"), "Expected");
    expect(result.score).toBe(0.6);
  });

  it("should handle model errors gracefully", async () => {
    const model = createMockJudgeModel("");
    model.generate = async () => { throw new Error("Model unavailable"); };
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test"), "Expected");
    expect(result.score).toBe(0.0);
    expect(result.details).toContain("error");
  });

  it("should use custom rubric in the prompt", async () => {
    let capturedMessages: Message[] = [];
    const model = createMockJudgeModel('{"score": 0.9, "reasoning": "Met rubric"}');
    model.generate = async (messages: Message[]) => {
      capturedMessages = messages;
      return {
        text: '{"score": 0.9, "reasoning": "Met rubric"}',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    };
    const scorer = createLLMJudgeScorer({ model, rubric: "Check for accuracy and tone" });
    await scorer.score(makeResponse("Test"), "Expected");
    const userMsg = capturedMessages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("accuracy and tone");
  });

  it("should handle array expected values", async () => {
    const model = createMockJudgeModel('{"score": 0.8, "reasoning": "Covered most"}');
    const scorer = createLLMJudgeScorer({ model });
    const result = await scorer.score(makeResponse("Test"), ["answer1", "answer2"]);
    expect(result.score).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// Eval Runner
// ---------------------------------------------------------------------------

describe("Eval Runner", () => {
  it("should run all cases and produce a report", async () => {
    const agent = createMockAgent("Paris");
    const suite: EvalSuite = {
      name: "test-suite",
      cases: [
        { input: "Capital of France?", expected: "Paris" },
        { input: "Capital of Germany?", expected: "Berlin" },
      ],
      scorer: createExactMatchScorer(),
      threshold: 1.0,
    };

    const report = await runEval(agent, suite);

    expect(report.suite.name).toBe("test-suite");
    expect(report.results).toHaveLength(2);
    expect(report.results[0].passed).toBe(true);
    expect(report.results[1].passed).toBe(false);
    expect(report.summary.total).toBe(2);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
    expect(report.summary.passRate).toBe(0.5);
    expect(report.summary.averageScore).toBe(0.5);
    expect(report.timestamp).toBeTruthy();
  });

  it("should handle agent errors gracefully", async () => {
    const agent = createErrorAgent();
    const suite: EvalSuite = {
      name: "error-suite",
      cases: [{ input: "Crash", expected: "answer" }],
      scorer: createExactMatchScorer(),
    };

    const report = await runEval(agent, suite);

    expect(report.results).toHaveLength(1);
    expect(report.results[0].score).toBe(0);
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].details).toContain("Error");
  });

  it("should timeout slow cases", async () => {
    const agent = createSlowAgent(5000);
    const suite: EvalSuite = {
      name: "timeout-suite",
      cases: [{ input: "Slow", expected: "answer" }],
      scorer: createExactMatchScorer(),
    };

    const report = await runEval(agent, suite, { timeout: 100 });

    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].details).toContain("timed out");
  });

  it("should run with concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const agent: Agent = {
      name: "concurrent-agent",
      async run(): Promise<AgentResponse> {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrent--;
        return makeResponse("answer");
      },
    };

    const suite: EvalSuite = {
      name: "concurrency-suite",
      cases: Array.from({ length: 10 }, (_, i) => ({
        input: `Question ${i}`,
        expected: "answer",
      })),
      scorer: createExactMatchScorer(),
    };

    await runEval(agent, suite, { concurrency: 3 });
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("should respect custom threshold", async () => {
    const agent = createMockAgent("Partial answer with Paris");
    const suite: EvalSuite = {
      name: "threshold-suite",
      cases: [
        { input: "Q1", expected: ["Paris", "France"] },
      ],
      scorer: createIncludesScorer({ requireAll: true }),
      threshold: 1.0,
    };

    // With default threshold (1.0), partial match should fail
    const report1 = await runEval(agent, suite);
    expect(report1.results[0].passed).toBe(false);

    // With custom threshold (0.3), partial match should pass
    const report2 = await runEval(agent, suite, { threshold: 0.3 });
    expect(report2.results[0].passed).toBe(true);
  });

  it("should compute duration for each case", async () => {
    const agent = createMockAgent("answer");
    const suite: EvalSuite = {
      name: "duration-suite",
      cases: [{ input: "Q", expected: "answer" }],
      scorer: createExactMatchScorer(),
    };

    const report = await runEval(agent, suite);
    expect(report.results[0].duration).toBeGreaterThanOrEqual(0);
    expect(report.summary.totalDuration).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// runEvalSuite (multiple suites)
// ---------------------------------------------------------------------------

describe("runEvalSuite", () => {
  it("should run multiple suites and return reports", async () => {
    const agent = createMockAgent("Paris");
    const suite1: EvalSuite = {
      name: "suite-1",
      cases: [{ input: "Q", expected: "Paris" }],
      scorer: createExactMatchScorer(),
    };
    const suite2: EvalSuite = {
      name: "suite-2",
      cases: [{ input: "Q", expected: "London" }],
      scorer: createExactMatchScorer(),
    };

    const reports = await runEvalSuite(agent, [suite1, suite2]);

    expect(reports).toHaveLength(2);
    expect(reports[0].suite.name).toBe("suite-1");
    expect(reports[0].results[0].passed).toBe(true);
    expect(reports[1].suite.name).toBe("suite-2");
    expect(reports[1].results[0].passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Console Reporter
// ---------------------------------------------------------------------------

describe("Console Reporter", () => {
  it("should output report without throwing", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const reporter = createConsoleReporter();

    const report = {
      suite: {
        name: "test-suite",
        cases: [{ input: "Q", expected: "A" }],
        scorer: createExactMatchScorer(),
      },
      results: [{
        case: { input: "Q", expected: "A" },
        response: makeResponse("A"),
        score: 1.0,
        passed: true,
        details: "Exact match.",
        duration: 10,
      }],
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        averageScore: 1.0,
        totalDuration: 10,
        passRate: 1.0,
      },
      timestamp: new Date().toISOString(),
    };

    reporter.report(report);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle reportAll without throwing", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const reporter = createConsoleReporter();

    reporter.reportAll!([]);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// JSON Reporter
// ---------------------------------------------------------------------------

describe("JSON Reporter", () => {
  it("should output valid JSON report", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const reporter = createJSONReporter();

    const report = {
      suite: {
        name: "json-test",
        cases: [{ input: "Q", expected: "A" }],
        scorer: createExactMatchScorer(),
      },
      results: [{
        case: { input: "Q", expected: "A" },
        response: makeResponse("A"),
        score: 1.0,
        passed: true,
        details: "Exact match.",
        duration: 10,
      }],
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        averageScore: 1.0,
        totalDuration: 10,
        passRate: 1.0,
      },
      timestamp: new Date().toISOString(),
    };

    reporter.report(report);

    const output = reporter.getOutput();
    expect(output).toBeTruthy();
    expect(output!.suites).toHaveLength(1);
    expect(output!.suites[0].name).toBe("json-test");
    expect(output!.overall.totalPassed).toBe(1);

    consoleSpy.mockRestore();
  });

  it("should handle reportAll", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const reporter = createJSONReporter();

    reporter.reportAll!([]);

    const output = reporter.getOutput();
    expect(output).toBeTruthy();
    expect(output!.overall.totalCases).toBe(0);

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Built-in Suites
// ---------------------------------------------------------------------------

describe("Built-in Eval Suites", () => {
  it("should create basic-qa suite with cases and scorer", () => {
    const suite = createBasicQASuite();
    expect(suite.name).toBe("basic-qa");
    expect(suite.cases.length).toBeGreaterThanOrEqual(5);
    expect(suite.scorer.name).toBe("includes");
    expect(suite.threshold).toBeDefined();
    // Verify each case has required fields
    for (const c of suite.cases) {
      expect(c.input).toBeTruthy();
      expect(c.expected).toBeTruthy();
    }
  });

  it("should create tool-use suite with cases", () => {
    const suite = createToolUseSuite();
    expect(suite.name).toBe("tool-use");
    expect(suite.cases.length).toBeGreaterThanOrEqual(5);
    // Verify each case has expected tool call info
    for (const c of suite.cases) {
      expect(c.input).toBeTruthy();
      expect(c.metadata?.expectedCalls).toBeTruthy();
    }
  });

  it("should create multi-turn suite with cases", () => {
    const suite = createMultiTurnSuite();
    expect(suite.name).toBe("multi-turn");
    expect(suite.cases.length).toBeGreaterThanOrEqual(3);
    for (const c of suite.cases) {
      expect(c.input).toBeTruthy();
      expect(c.expected).toBeTruthy();
    }
  });

  it("should extract expected calls from tool-use cases", () => {
    const suite = createToolUseSuite();
    for (const c of suite.cases) {
      const calls = getExpectedCalls(c);
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[0].name).toBeTruthy();
    }
  });

  it("should run basic-qa suite against a mock agent", async () => {
    // Agent that always responds with "Paris"
    const agent = createMockAgent("The answer is Paris, the capital of France.");
    const suite = createBasicQASuite();

    // Only run first 3 cases for speed
    const limitedSuite = { ...suite, cases: suite.cases.slice(0, 3) };
    const report = await runEval(agent, limitedSuite);

    expect(report.results).toHaveLength(3);
    // First case should pass (expects "Paris")
    expect(report.results[0].score).toBe(1.0);
    expect(report.summary.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Types validation
// ---------------------------------------------------------------------------

describe("Type validation", () => {
  it("should create a valid EvalCase", () => {
    const c: EvalCase = {
      input: "test",
      expected: "answer",
      metadata: { key: "value" },
    };
    expect(c.input).toBe("test");
    expect(c.expected).toBe("answer");
  });

  it("should create a valid EvalSuite", () => {
    const suite: EvalSuite = {
      name: "test-suite",
      cases: [{ input: "q", expected: "a" }],
      scorer: createExactMatchScorer(),
      threshold: 0.8,
    };
    expect(suite.name).toBe("test-suite");
    expect(suite.threshold).toBe(0.8);
  });
});
