/**
 * Tests for trace exporters (console, json, callback).
 */

import { describe, it, expect, vi } from "vitest";
import { Tracer } from "../src/tracer.js";
import type { Trace } from "../src/tracer.js";
import { createConsoleExporter } from "../src/exporters/console.js";
import { createJsonExporter } from "../src/exporters/json.js";
import { createCallbackExporter } from "../src/exporters/callback.js";

// ---------------------------------------------------------------------------
// Helper: build a sample trace
// ---------------------------------------------------------------------------

async function buildSampleTrace(tracer: Tracer): Promise<Trace> {
  const trace = tracer.startTrace("sample-trace", { version: 1 });
  const root = tracer.startSpan(trace.id, "root-span");
  const child = tracer.startSpan(trace.id, "child-span", root.id, { tool: "test" });
  tracer.addEvent(trace.id, child.id, "started-work");
  tracer.endSpan(trace.id, child.id, "ok");
  tracer.endSpan(trace.id, root.id, "ok");
  return tracer.endTrace(trace.id);
}

// ---------------------------------------------------------------------------
// Console exporter
// ---------------------------------------------------------------------------

describe("createConsoleExporter", () => {
  it("should pretty-print trace tree", async () => {
    const lines: string[] = [];
    const exporter = createConsoleExporter({ logger: (msg) => lines.push(msg) });

    const tracer = new Tracer({ exporters: [exporter] });
    await buildSampleTrace(tracer);

    // Should have trace header
    expect(lines.some((l) => l.includes("Trace: sample-trace"))).toBe(true);
    // Should have root span
    expect(lines.some((l) => l.includes("root-span"))).toBe(true);
    // Should have indented child span
    expect(lines.some((l) => l.includes("child-span"))).toBe(true);
    // Should show event
    expect(lines.some((l) => l.includes("started-work"))).toBe(true);
  });

  it("should show status icons", async () => {
    const lines: string[] = [];
    const exporter = createConsoleExporter({ logger: (msg) => lines.push(msg) });

    const tracer = new Tracer({ exporters: [exporter] });
    const trace = tracer.startTrace("icons-test");
    const s1 = tracer.startSpan(trace.id, "ok-span");
    tracer.endSpan(trace.id, s1.id, "ok");
    const s2 = tracer.startSpan(trace.id, "error-span");
    tracer.endSpan(trace.id, s2.id, "error");
    await tracer.endTrace(trace.id);

    expect(lines.some((l) => l.includes("✓") && l.includes("ok-span"))).toBe(true);
    expect(lines.some((l) => l.includes("✗") && l.includes("error-span"))).toBe(true);
  });

  it("should show timing", async () => {
    const lines: string[] = [];
    const exporter = createConsoleExporter({ logger: (msg) => lines.push(msg) });

    const tracer = new Tracer({ exporters: [exporter] });
    const trace = tracer.startTrace("timing-test");
    const span = tracer.startSpan(trace.id, "timed-span");
    tracer.endSpan(trace.id, span.id, "ok");
    await tracer.endTrace(trace.id);

    // Should contain a timing value like [0ms] or [1ms]
    expect(lines.some((l) => /\[\d+ms\]/.test(l))).toBe(true);
  });

  it("should show span attributes", async () => {
    const lines: string[] = [];
    const exporter = createConsoleExporter({ logger: (msg) => lines.push(msg) });

    const tracer = new Tracer({ exporters: [exporter] });
    const trace = tracer.startTrace("attr-test");
    const span = tracer.startSpan(trace.id, "attr-span", undefined, { key: "value" });
    tracer.endSpan(trace.id, span.id, "ok");
    await tracer.endTrace(trace.id);

    expect(lines.some((l) => l.includes("key:") && l.includes('"value"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JSON exporter
// ---------------------------------------------------------------------------

describe("createJsonExporter", () => {
  it("should serialize trace to JSON", async () => {
    const outputs: string[] = [];
    const exporter = createJsonExporter({ logger: (json) => outputs.push(json) });

    const tracer = new Tracer({ exporters: [exporter] });
    await buildSampleTrace(tracer);

    expect(outputs).toHaveLength(1);
    const parsed = JSON.parse(outputs[0]);
    expect(parsed.name).toBe("sample-trace");
    expect(parsed.spans).toHaveLength(2);
    expect(parsed.attributes.version).toBe(1);
  });

  it("should support compact output", async () => {
    const outputs: string[] = [];
    const exporter = createJsonExporter({ logger: (json) => outputs.push(json), indent: 0 });

    const tracer = new Tracer({ exporters: [exporter] });
    await buildSampleTrace(tracer);

    // Compact JSON has no newlines
    expect(outputs[0]).not.toContain("\n");
    const parsed = JSON.parse(outputs[0]);
    expect(parsed.name).toBe("sample-trace");
  });

  it("should default to indent 2", async () => {
    const outputs: string[] = [];
    const exporter = createJsonExporter({ logger: (json) => outputs.push(json) });

    const tracer = new Tracer({ exporters: [exporter] });
    await buildSampleTrace(tracer);

    // Default indented JSON has newlines
    expect(outputs[0]).toContain("\n");
  });
});

// ---------------------------------------------------------------------------
// Callback exporter
// ---------------------------------------------------------------------------

describe("createCallbackExporter", () => {
  it("should invoke callback with completed trace", async () => {
    const received: Trace[] = [];
    const exporter = createCallbackExporter((trace) => {
      received.push(trace);
    });

    const tracer = new Tracer({ exporters: [exporter] });
    await buildSampleTrace(tracer);

    expect(received).toHaveLength(1);
    expect(received[0].name).toBe("sample-trace");
    expect(received[0].spans).toHaveLength(2);
  });

  it("should support async callbacks", async () => {
    const received: string[] = [];
    const exporter = createCallbackExporter(async (trace) => {
      await new Promise((r) => setTimeout(r, 1));
      received.push(trace.name);
    });

    const tracer = new Tracer({ exporters: [exporter] });
    await buildSampleTrace(tracer);

    expect(received).toEqual(["sample-trace"]);
  });

  it("should work with multiple exporters", async () => {
    const callbackTraces: Trace[] = [];
    const jsonOutputs: string[] = [];

    const tracer = new Tracer({
      exporters: [
        createCallbackExporter((t) => { callbackTraces.push(t); }),
        createJsonExporter({ logger: (j) => jsonOutputs.push(j) }),
      ],
    });

    await buildSampleTrace(tracer);

    expect(callbackTraces).toHaveLength(1);
    expect(jsonOutputs).toHaveLength(1);
  });
});
