/**
 * Tests for the workflow engine.
 */

import { describe, it, expect, vi } from "vitest";
import { createWorkflow } from "../src/workflow.js";
import type { WorkflowStep } from "../src/workflow.js";
import type { Agent, AgentResponse } from "../src/types.js";
import type { Usage } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAgent(name: string, responseText: string): Agent {
  return {
    name,
    async run(input: string): Promise<AgentResponse> {
      return {
        text: `${responseText}: ${input}`,
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } as Usage,
        agentName: name,
      };
    },
    async use(): Promise<void> {
      // no-op
    },
  };
}

// ---------------------------------------------------------------------------
// Linear workflow
// ---------------------------------------------------------------------------

describe("createWorkflow", () => {
  it("should execute a linear workflow sequentially", async () => {
    const workflow = createWorkflow({
      name: "linear",
      steps: [
        {
          name: "double",
          fn: async (input) => (input as number) * 2,
        },
        {
          name: "add-ten",
          fn: async (input) => (input as number) + 10,
        },
        {
          name: "to-string",
          fn: async (input) => `Result: ${input}`,
        },
      ],
    });

    const { result, stepResults } = await workflow.run(5);
    expect(result).toBe("Result: 20");
    expect(stepResults["double"]).toBe(10);
    expect(stepResults["add-ten"]).toBe(20);
    expect(stepResults["to-string"]).toBe("Result: 20");
  });

  it("should pass the workflow name through", () => {
    const workflow = createWorkflow({
      name: "my-workflow",
      steps: [{ name: "s", fn: async (x) => x }],
    });
    expect(workflow.name).toBe("my-workflow");
  });

  it("should throw if no steps are provided", () => {
    expect(() =>
      createWorkflow({ name: "empty", steps: [] }),
    ).toThrow("at least one step");
  });

  // ---------------------------------------------------------------------------
  // Agent steps
  // ---------------------------------------------------------------------------

  it("should execute a step with an agent", async () => {
    const agent = createMockAgent("summarizer", "Summary");
    const workflow = createWorkflow({
      name: "agent-flow",
      steps: [
        {
          name: "summarize",
          agent,
        },
      ],
    });

    const { result } = await workflow.run("Some long text");
    expect(result).toBe("Summary: Some long text");
  });

  it("should convert non-string input to JSON for agent steps", async () => {
    const agent = createMockAgent("json-agent", "Processed");
    const workflow = createWorkflow({
      name: "json-agent-flow",
      steps: [
        {
          name: "process",
          agent,
        },
      ],
    });

    const { result } = await workflow.run({ key: "value" });
    expect(result).toBe('Processed: {"key":"value"}');
  });

  // ---------------------------------------------------------------------------
  // Input / output transforms
  // ---------------------------------------------------------------------------

  it("should apply inputTransform and outputTransform", async () => {
    const workflow = createWorkflow({
      name: "transforms",
      steps: [
        {
          name: "compute",
          fn: async (input) => (input as number) * 3,
          inputTransform: (input) => (input as number) + 1,
          outputTransform: (output) => (output as number) - 2,
        },
      ],
    });

    // input=5, inputTransform => 6, fn => 18, outputTransform => 16
    const { result } = await workflow.run(5);
    expect(result).toBe(16);
  });

  // ---------------------------------------------------------------------------
  // Branching
  // ---------------------------------------------------------------------------

  it("should support conditional branching", async () => {
    const workflow = createWorkflow({
      name: "branching",
      steps: [
        {
          name: "check",
          fn: async (input) => input,
          condition: async (result) =>
            (result as number) > 10 ? "big" : "small",
        },
        {
          name: "small",
          fn: async (input) => `small: ${input}`,
          condition: async () => "done",
        },
        {
          name: "big",
          fn: async (input) => `big: ${input}`,
          condition: async () => "done",
        },
      ],
    });

    const smallResult = await workflow.run(5);
    expect(smallResult.result).toBe("small: 5");

    const bigResult = await workflow.run(15);
    expect(bigResult.result).toBe("big: 15");
  });

  it("should finish early when condition returns 'done'", async () => {
    const workflow = createWorkflow({
      name: "early-done",
      steps: [
        {
          name: "first",
          fn: async (input) => `processed: ${input}`,
          condition: async () => "done",
        },
        {
          name: "second",
          fn: async () => "should not run",
        },
      ],
    });

    const { result, stepResults } = await workflow.run("hello");
    expect(result).toBe("processed: hello");
    expect(stepResults["second"]).toBeUndefined();
  });

  it("should throw on unknown condition target", async () => {
    const workflow = createWorkflow({
      name: "bad-branch",
      steps: [
        {
          name: "first",
          fn: async (x) => x,
          condition: async () => "nonexistent",
        },
      ],
    });

    await expect(workflow.run("x")).rejects.toThrow('unknown step "nonexistent"');
  });

  // ---------------------------------------------------------------------------
  // Loops
  // ---------------------------------------------------------------------------

  it("should support loops by referencing earlier steps", async () => {
    let counter = 0;
    const workflow = createWorkflow({
      name: "loop",
      steps: [
        {
          name: "increment",
          fn: async (input) => {
            counter++;
            return (input as number) + 1;
          },
          condition: async (result) =>
            (result as number) < 5 ? "increment" : "done",
        },
      ],
    });

    const { result } = await workflow.run(0);
    expect(result).toBe(5);
    expect(counter).toBe(5);
  });

  it("should enforce maxIterations to prevent infinite loops", async () => {
    const workflow = createWorkflow({
      name: "infinite",
      steps: [
        {
          name: "loop-forever",
          fn: async (input) => input,
          condition: async () => "loop-forever",
        },
      ],
      maxIterations: 10,
    });

    await expect(workflow.run("start")).rejects.toThrow(
      "exceeded maximum iterations (10)",
    );
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it("should retry on step failure", async () => {
    let attempts = 0;
    const workflow = createWorkflow({
      name: "retry-flow",
      steps: [
        {
          name: "flaky",
          fn: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error("Transient error");
            }
            return "success";
          },
          retries: 2,
        },
      ],
    });

    const { result } = await workflow.run("input");
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("should use fallback when all retries are exhausted", async () => {
    const onError = vi.fn();
    const workflow = createWorkflow({
      name: "fallback-flow",
      steps: [
        {
          name: "always-fail",
          fn: async () => {
            throw new Error("Permanent error");
          },
          retries: 1,
          fallback: "fallback-value",
        },
      ],
      onError,
    });

    const { result } = await workflow.run("input");
    expect(result).toBe("fallback-value");
    expect(onError).toHaveBeenCalledWith("always-fail", expect.any(Error));
  });

  it("should abort when step fails with no retries or fallback", async () => {
    const workflow = createWorkflow({
      name: "abort-flow",
      steps: [
        {
          name: "fail-hard",
          fn: async () => {
            throw new Error("Fatal error");
          },
        },
      ],
    });

    await expect(workflow.run("input")).rejects.toThrow("Fatal error");
  });

  it("should throw if step has neither agent nor fn", async () => {
    const workflow = createWorkflow({
      name: "no-executor",
      steps: [
        {
          name: "empty-step",
        } as WorkflowStep,
      ],
    });

    await expect(workflow.run("x")).rejects.toThrow("must have either an agent or a fn");
  });

  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  it("should call onStepComplete after each step", async () => {
    const onStepComplete = vi.fn();
    const workflow = createWorkflow({
      name: "hooks-flow",
      steps: [
        { name: "a", fn: async () => 1 },
        { name: "b", fn: async () => 2 },
      ],
      onStepComplete,
    });

    await workflow.run("input");
    expect(onStepComplete).toHaveBeenCalledTimes(2);
    expect(onStepComplete).toHaveBeenCalledWith("a", 1, 0);
    expect(onStepComplete).toHaveBeenCalledWith("b", 2, 1);
  });
});
