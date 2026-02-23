/**
 * Tests for <think> tag stripping in the OpenAI adapter.
 *
 * Covers:
 * - stripThinkTags() utility (single/multiple blocks, unclosed tags, edge cases)
 * - doGenerate() integration (response.text stripped, response.reasoning populated)
 * - parseSSEStream() integration (reasoning_delta events emitted for think content)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  stripThinkTags,
  OpenAIAdapter,
} from "../src/adapters/openai-adapter.js";
import type { ModelCapabilities } from "../src/types.js";
import type { StreamEvent } from "../src/stream.js";

// ---------------------------------------------------------------------------
// stripThinkTags unit tests
// ---------------------------------------------------------------------------

describe("stripThinkTags", () => {
  it("returns text unchanged when no think tags present", () => {
    const result = stripThinkTags("Hello, world!");
    expect(result.text).toBe("Hello, world!");
    expect(result.reasoning).toBeNull();
  });

  it("strips a single <think> block", () => {
    const input = "<think>Let me reason about this.</think>The answer is 42.";
    const result = stripThinkTags(input);
    expect(result.text).toBe("The answer is 42.");
    expect(result.reasoning).toBe("Let me reason about this.");
  });

  it("strips multiple <think> blocks", () => {
    const input =
      "<think>First thought.</think>Hello <think>Second thought.</think>world!";
    const result = stripThinkTags(input);
    expect(result.text).toBe("Hello world!");
    expect(result.reasoning).toBe("First thought.\n\nSecond thought.");
  });

  it("handles unclosed <think> tag", () => {
    const input = "Some text<think>unclosed reasoning";
    const result = stripThinkTags(input);
    expect(result.text).toBe("Some text");
    expect(result.reasoning).toBe("unclosed reasoning");
  });

  it("handles case-insensitive tags", () => {
    const input = "<THINK>Reasoning here.</THINK>The answer.";
    const result = stripThinkTags(input);
    expect(result.text).toBe("The answer.");
    expect(result.reasoning).toBe("Reasoning here.");
  });

  it("handles mixed case tags", () => {
    const input = "<Think>Reasoning.</Think>Output.";
    const result = stripThinkTags(input);
    expect(result.text).toBe("Output.");
    expect(result.reasoning).toBe("Reasoning.");
  });

  it("handles multiline think content", () => {
    const input = "<think>\nStep 1: Do X\nStep 2: Do Y\n</think>\nFinal answer.";
    const result = stripThinkTags(input);
    expect(result.text).toBe("Final answer.");
    expect(result.reasoning).toBe("Step 1: Do X\nStep 2: Do Y");
  });

  it("handles empty think block", () => {
    const input = "<think></think>Just text.";
    const result = stripThinkTags(input);
    expect(result.text).toBe("Just text.");
    expect(result.reasoning).toBeNull();
  });

  it("handles think block with only whitespace", () => {
    const input = "<think>   \n  </think>Answer.";
    const result = stripThinkTags(input);
    expect(result.text).toBe("Answer.");
    expect(result.reasoning).toBeNull();
  });

  it("returns empty text when everything is inside think tags", () => {
    const input = "<think>All reasoning, no output.</think>";
    const result = stripThinkTags(input);
    expect(result.text).toBe("");
    expect(result.reasoning).toBe("All reasoning, no output.");
  });

  it("handles think block at the end of text", () => {
    const input = "The answer is 42.<think>I computed this.</think>";
    const result = stripThinkTags(input);
    expect(result.text).toBe("The answer is 42.");
    expect(result.reasoning).toBe("I computed this.");
  });

  it("handles empty string input", () => {
    const result = stripThinkTags("");
    expect(result.text).toBe("");
    expect(result.reasoning).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// doGenerate integration — think tags stripped from response
// ---------------------------------------------------------------------------

/** Minimal concrete OpenAIAdapter for testing. */
class TestOpenAIProvider extends OpenAIAdapter {
  readonly name = "test-openai";
  readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected getDefaultBaseURL(): string {
    return "https://api.test.com/v1";
  }

  protected requiresApiKey(): boolean {
    return false;
  }
}

describe("OpenAIAdapter.generate — think tag stripping", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  function mockResponse(content: string | null) {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test",
          choices: [
            {
              message: { role: "assistant", content },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      ),
    );
  }

  it("strips think tags and populates reasoning field", async () => {
    const provider = new TestOpenAIProvider();
    mockResponse("<think>Internal reasoning.</think>The answer is 42.");

    const result = await provider.generate(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    expect(result.text).toBe("The answer is 42.");
    expect(result.reasoning).toBe("Internal reasoning.");
  });

  it("does not include reasoning field when no think tags", async () => {
    const provider = new TestOpenAIProvider();
    mockResponse("No reasoning here.");

    const result = await provider.generate(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    expect(result.text).toBe("No reasoning here.");
    expect(result.reasoning).toBeUndefined();
  });

  it("handles null content from API", async () => {
    const provider = new TestOpenAIProvider();
    mockResponse(null);

    const result = await provider.generate(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    expect(result.text).toBeNull();
    expect(result.reasoning).toBeUndefined();
  });

  it("sets text to null when all content is in think tags", async () => {
    const provider = new TestOpenAIProvider();
    mockResponse("<think>Only reasoning.</think>");

    const result = await provider.generate(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    expect(result.text).toBeNull();
    expect(result.reasoning).toBe("Only reasoning.");
  });

  it("strips think tags in generateWithTools too", async () => {
    const provider = new TestOpenAIProvider();
    mockResponse("<think>Thinking about tools.</think>Use the calculator.");

    const result = await provider.generateWithTools(
      [{ role: "user", content: "test" }],
      [
        {
          name: "calc",
          description: "Calculator",
          parameters: { type: "object" },
        },
      ],
      { modelName: "test-model" },
    );

    expect(result.text).toBe("Use the calculator.");
    expect(result.reasoning).toBe("Thinking about tools.");
  });
});

// ---------------------------------------------------------------------------
// parseSSEStream integration — think tags routed to reasoning_delta
// ---------------------------------------------------------------------------

describe("OpenAIAdapter.stream — think tag stripping", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  function makeSSEChunk(content: string) {
    return `data: ${JSON.stringify({
      choices: [{ delta: { content }, finish_reason: null }],
    })}\n\n`;
  }

  function makeSSEDone() {
    return "data: [DONE]\n\n";
  }

  function mockStreamResponse(chunks: string[]) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
  }

  it("emits reasoning_delta for think tag content in stream", async () => {
    const provider = new TestOpenAIProvider();
    mockStreamResponse([
      makeSSEChunk("<think>"),
      makeSSEChunk("reasoning content"),
      makeSSEChunk("</think>"),
      makeSSEChunk("visible text"),
      makeSSEDone(),
    ]);

    const result = await provider.stream(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    const events: StreamEvent[] = [];
    for await (const event of result) {
      events.push(event);
    }

    const textDeltas = events
      .filter((e) => e.type === "text_delta")
      .map((e) => (e as { text: string }).text)
      .join("");
    const reasoningDeltas = events
      .filter((e) => e.type === "reasoning_delta")
      .map((e) => (e as { text: string }).text)
      .join("");

    expect(textDeltas).toBe("visible text");
    expect(reasoningDeltas).toBe("reasoning content");
  });

  it("handles stream with no think tags", async () => {
    const provider = new TestOpenAIProvider();
    mockStreamResponse([
      makeSSEChunk("Hello "),
      makeSSEChunk("world"),
      makeSSEDone(),
    ]);

    const result = await provider.stream(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    const events: StreamEvent[] = [];
    for await (const event of result) {
      events.push(event);
    }

    const textDeltas = events
      .filter((e) => e.type === "text_delta")
      .map((e) => (e as { text: string }).text)
      .join("");
    const reasoningDeltas = events.filter((e) => e.type === "reasoning_delta");

    expect(textDeltas).toBe("Hello world");
    expect(reasoningDeltas).toHaveLength(0);
  });

  it("handles think tag split across chunks", async () => {
    const provider = new TestOpenAIProvider();
    mockStreamResponse([
      makeSSEChunk("<thi"),
      makeSSEChunk("nk>"),
      makeSSEChunk("reasoning"),
      makeSSEChunk("</thi"),
      makeSSEChunk("nk>"),
      makeSSEChunk("output"),
      makeSSEDone(),
    ]);

    const result = await provider.stream(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );

    const events: StreamEvent[] = [];
    for await (const event of result) {
      events.push(event);
    }

    const textDeltas = events
      .filter((e) => e.type === "text_delta")
      .map((e) => (e as { text: string }).text)
      .join("");
    const reasoningDeltas = events
      .filter((e) => e.type === "reasoning_delta")
      .map((e) => (e as { text: string }).text)
      .join("");

    expect(textDeltas).toBe("output");
    expect(reasoningDeltas).toBe("reasoning");
  });
});
