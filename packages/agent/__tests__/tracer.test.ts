/**
 * Tests for the Tracer class.
 */

import { describe, it, expect, vi } from "vitest";
import { Tracer } from "../src/tracer.js";
import type { Trace } from "../src/tracer.js";
import { createAgent } from "../src/index.js";
import type { Model, Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import type { ToolDefinition } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock model
// ---------------------------------------------------------------------------

function createMockModel(responses: ModelResponse[]): Model {
  let callIndex = 0;
  return {
    modelId: "mock:test-model",
    async generate(_messages: Message[]): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
    async stream(): Promise<StreamResult> {
      throw new Error("Stream not implemented in mock");
    },
    async generateWithTools(
      _messages: Message[],
      _tools: AIToolDef[],
    ): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
  };
}

// ---------------------------------------------------------------------------
// Tracer basics
// ---------------------------------------------------------------------------

describe("Tracer", () => {
  it("should start and end a trace", async () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("test-trace", { foo: "bar" });
    expect(trace.id).toBeDefined();
    expect(trace.name).toBe("test-trace");
    expect(trace.startTime).toBeGreaterThan(0);
    expect(trace.endTime).toBeUndefined();
    expect(trace.attributes).toEqual({ foo: "bar" });
    expect(trace.spans).toEqual([]);

    const ended = await tracer.endTrace(trace.id);
    expect(ended.endTime).toBeGreaterThanOrEqual(ended.startTime);
    expect(tracer.getTrace(trace.id)).toBeUndefined();
  });

  it("should start and end spans within a trace", async () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("test-trace");

    const span1 = tracer.startSpan(trace.id, "span-1");
    expect(span1.name).toBe("span-1");
    expect(span1.parentId).toBeUndefined();

    const span2 = tracer.startSpan(trace.id, "span-2", span1.id, { nested: true });
    expect(span2.parentId).toBe(span1.id);
    expect(span2.attributes).toEqual({ nested: true });

    tracer.endSpan(trace.id, span2.id, "ok");
    tracer.endSpan(trace.id, span1.id, "ok");

    const ended = await tracer.endTrace(trace.id);
    expect(ended.spans).toHaveLength(2);
    expect(ended.spans[0].status).toBe("ok");
    expect(ended.spans[0].endTime).toBeDefined();
    expect(ended.spans[1].status).toBe("ok");
  });

  it("should add events to spans", async () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("test");
    const span = tracer.startSpan(trace.id, "span-1");

    tracer.addEvent(trace.id, span.id, "something-happened", { detail: 42 });
    tracer.addEvent(trace.id, span.id, "another-event");

    tracer.endSpan(trace.id, span.id, "ok");
    const ended = await tracer.endTrace(trace.id);
    expect(ended.spans[0].events).toHaveLength(2);
    expect(ended.spans[0].events[0].name).toBe("something-happened");
    expect(ended.spans[0].events[0].attributes).toEqual({ detail: 42 });
    expect(ended.spans[0].events[1].name).toBe("another-event");
  });

  it("should support error status on spans", async () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("test");
    const span = tracer.startSpan(trace.id, "failing-span");

    tracer.endSpan(trace.id, span.id, "error", { errorMessage: "boom" });

    const ended = await tracer.endTrace(trace.id);
    expect(ended.spans[0].status).toBe("error");
    expect(ended.spans[0].attributes.errorMessage).toBe("boom");
  });

  it("should throw on unknown trace id", () => {
    const tracer = new Tracer();
    expect(() => tracer.startSpan("nonexistent", "span")).toThrow('Trace "nonexistent" not found.');
    expect(() => tracer.endSpan("nonexistent", "span")).toThrow('Trace "nonexistent" not found.');
    expect(() => tracer.addEvent("nonexistent", "span", "evt")).toThrow('Trace "nonexistent" not found.');
  });

  it("should throw on unknown span id", () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("test");
    expect(() => tracer.endSpan(trace.id, "nonexistent")).toThrow('Span "nonexistent" not found');
    expect(() => tracer.addEvent(trace.id, "nonexistent", "evt")).toThrow('Span "nonexistent" not found');
  });

  it("should invoke exporters on endTrace", async () => {
    const exported: Trace[] = [];
    const tracer = new Tracer({
      exporters: [(trace) => { exported.push(trace); }],
    });

    const trace = tracer.startTrace("exported-trace");
    tracer.startSpan(trace.id, "span-1");
    await tracer.endTrace(trace.id);

    expect(exported).toHaveLength(1);
    expect(exported[0].name).toBe("exported-trace");
  });

  it("should invoke async exporters", async () => {
    const exported: string[] = [];
    const tracer = new Tracer({
      exporters: [
        async (trace) => {
          await new Promise((r) => setTimeout(r, 1));
          exported.push(trace.name);
        },
      ],
    });

    const trace = tracer.startTrace("async-trace");
    await tracer.endTrace(trace.id);
    expect(exported).toEqual(["async-trace"]);
  });

  it("should track active traces", async () => {
    const tracer = new Tracer();
    expect(tracer.getActiveTraces()).toHaveLength(0);

    const t1 = tracer.startTrace("t1");
    const t2 = tracer.startTrace("t2");
    expect(tracer.getActiveTraces()).toHaveLength(2);

    await tracer.endTrace(t1.id);
    expect(tracer.getActiveTraces()).toHaveLength(1);
    expect(tracer.getTrace(t1.id)).toBeUndefined();
    expect(tracer.getTrace(t2.id)).toBeDefined();
  });

  it("should merge attributes on endSpan and endTrace", async () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("test", { initial: true });
    const span = tracer.startSpan(trace.id, "span", undefined, { a: 1 });

    tracer.endSpan(trace.id, span.id, "ok", { b: 2 });
    const ended = await tracer.endTrace(trace.id, { final: true });

    expect(ended.attributes).toEqual({ initial: true, final: true });
    expect(ended.spans[0].attributes).toEqual({ a: 1, b: 2 });
  });
});

// ---------------------------------------------------------------------------
// Agent tracing integration
// ---------------------------------------------------------------------------

describe("Agent tracing integration", () => {
  it("should produce a trace with llm-call span for simple generation", async () => {
    const traces: Trace[] = [];
    const tracer = new Tracer({
      exporters: [(t) => { traces.push(t); }],
    });

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "traced-agent",
      model,
      systemPrompt: "You are helpful.",
      tracer,
    });

    const response = await agent.run("Hi");
    expect(response.text).toBe("Hello!");

    // Verify trace was exported
    expect(traces).toHaveLength(1);
    const trace = traces[0];
    expect(trace.name).toBe("agent:traced-agent");
    expect(trace.endTime).toBeDefined();

    // Should have agent-run span and llm-call span
    const spanNames = trace.spans.map((s) => s.name);
    expect(spanNames).toContain("agent-run");
    expect(spanNames).toContain("llm-call");

    // agent-run should be root, llm-call nested under it
    const runSpan = trace.spans.find((s) => s.name === "agent-run")!;
    const llmSpan = trace.spans.find((s) => s.name === "llm-call")!;
    expect(runSpan.parentId).toBeUndefined();
    expect(llmSpan.parentId).toBe(runSpan.id);
    expect(llmSpan.status).toBe("ok");
    expect(runSpan.status).toBe("ok");
  });

  it("should produce tool call spans", async () => {
    const traces: Trace[] = [];
    const tracer = new Tracer({
      exporters: [(t) => { traces.push(t); }],
    });

    const model = createMockModel([
      {
        text: "",
        toolCalls: [{
          id: "tc1",
          name: "get_weather",
          arguments: { city: "Tokyo" },
        }],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: "tool_calls",
      },
      {
        text: "It's sunny in Tokyo!",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const weatherTool: ToolDefinition = {
      name: "get_weather",
      description: "Get weather",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      execute: async (params) => ({ temp: 72, city: params.city }),
    };

    const agent = createAgent({
      name: "tool-agent",
      model,
      systemPrompt: "You are a weather bot.",
      tools: [weatherTool],
      tracer,
    });

    const response = await agent.run("Weather in Tokyo?");
    expect(response.text).toBe("It's sunny in Tokyo!");

    expect(traces).toHaveLength(1);
    const trace = traces[0];

    const spanNames = trace.spans.map((s) => s.name);
    expect(spanNames).toContain("agent-run");
    expect(spanNames).toContain("tool:get_weather");

    // Two LLM calls (one with tool call, one final)
    const llmSpans = trace.spans.filter((s) => s.name === "llm-call");
    expect(llmSpans).toHaveLength(2);

    // Tool span should be nested under agent-run
    const toolSpan = trace.spans.find((s) => s.name === "tool:get_weather")!;
    const runSpan = trace.spans.find((s) => s.name === "agent-run")!;
    expect(toolSpan.parentId).toBe(runSpan.id);
    expect(toolSpan.status).toBe("ok");
  });

  it("should trace errors correctly", async () => {
    const traces: Trace[] = [];
    const tracer = new Tracer({
      exporters: [(t) => { traces.push(t); }],
    });

    const model = createMockModel([]);
    // Override generate to throw
    model.generate = async () => {
      throw new Error("LLM failed");
    };
    model.generateWithTools = async () => {
      throw new Error("LLM failed");
    };

    const agent = createAgent({
      name: "failing-agent",
      model,
      systemPrompt: "You fail.",
      tracer,
    });

    await expect(agent.run("Hi")).rejects.toThrow("LLM failed");

    expect(traces).toHaveLength(1);
    const trace = traces[0];
    const runSpan = trace.spans.find((s) => s.name === "agent-run")!;
    expect(runSpan.status).toBe("error");

    const llmSpan = trace.spans.find((s) => s.name === "llm-call")!;
    expect(llmSpan.status).toBe("error");
  });

  it("should work without tracer (no-op)", async () => {
    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "no-tracer-agent",
      model,
      systemPrompt: "You are helpful.",
    });

    // Should not throw
    const response = await agent.run("Hi");
    expect(response.text).toBe("Hello!");
  });
});
