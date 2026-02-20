/**
 * Observability tracing for @openlinkos/agent.
 *
 * Provides structured traces with nested spans for agent runs,
 * LLM calls, tool calls, and team coordination rounds.
 */

// ---------------------------------------------------------------------------
// Trace & Span types
// ---------------------------------------------------------------------------

/** Status of a completed span. */
export type SpanStatus = "ok" | "error";

/** A discrete event that occurred within a span. */
export interface SpanEvent {
  /** Event name. */
  name: string;
  /** Timestamp (epoch ms). */
  timestamp: number;
  /** Optional key-value data attached to the event. */
  attributes?: Record<string, unknown>;
}

/** A single unit of work within a trace. */
export interface Span {
  /** Unique span identifier. */
  id: string;
  /** Human-readable name describing the work. */
  name: string;
  /** Parent span id (undefined for root-level spans). */
  parentId?: string;
  /** Start time (epoch ms). */
  startTime: number;
  /** End time (epoch ms). Undefined while the span is still open. */
  endTime?: number;
  /** Span outcome. Undefined while the span is still open. */
  status?: SpanStatus;
  /** Key-value attributes attached to the span. */
  attributes: Record<string, unknown>;
  /** Discrete events recorded within the span. */
  events: SpanEvent[];
}

/** A root container grouping related spans into a single trace. */
export interface Trace {
  /** Unique trace identifier. */
  id: string;
  /** Human-readable name for the trace. */
  name: string;
  /** Start time (epoch ms). */
  startTime: number;
  /** End time (epoch ms). Undefined while the trace is still open. */
  endTime?: number;
  /** All spans belonging to this trace. */
  spans: Span[];
  /** Top-level key-value attributes for the trace. */
  attributes: Record<string, unknown>;
}

/** Callback invoked when a trace completes. */
export type TraceExporter = (trace: Trace) => void | Promise<void>;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let counter = 0;

function generateId(): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}-${counter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Tracer
// ---------------------------------------------------------------------------

/** Options for creating a Tracer. */
export interface TracerOptions {
  /** Exporters called when a trace ends. */
  exporters?: TraceExporter[];
}

/**
 * Tracer manages the lifecycle of traces and their nested spans.
 *
 * Usage:
 * ```ts
 * const tracer = new Tracer();
 * const trace = tracer.startTrace("agent-run");
 * const span = tracer.startSpan(trace.id, "llm-call");
 * // ... do work ...
 * tracer.endSpan(trace.id, span.id, "ok");
 * await tracer.endTrace(trace.id);
 * ```
 */
export class Tracer {
  private traces = new Map<string, Trace>();
  private exporters: TraceExporter[];

  constructor(options: TracerOptions = {}) {
    this.exporters = options.exporters ?? [];
  }

  /**
   * Start a new trace.
   *
   * @param name - Human-readable trace name.
   * @param attributes - Optional initial attributes.
   * @returns The newly created Trace.
   */
  startTrace(name: string, attributes: Record<string, unknown> = {}): Trace {
    const trace: Trace = {
      id: generateId(),
      name,
      startTime: Date.now(),
      spans: [],
      attributes,
    };
    this.traces.set(trace.id, trace);
    return trace;
  }

  /**
   * Start a new span within a trace.
   *
   * @param traceId - The owning trace id.
   * @param name - Human-readable span name.
   * @param parentId - Optional parent span id for nesting.
   * @param attributes - Optional initial attributes.
   * @returns The newly created Span.
   */
  startSpan(
    traceId: string,
    name: string,
    parentId?: string,
    attributes: Record<string, unknown> = {},
  ): Span {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace "${traceId}" not found.`);
    }
    const span: Span = {
      id: generateId(),
      name,
      parentId,
      startTime: Date.now(),
      attributes,
      events: [],
    };
    trace.spans.push(span);
    return span;
  }

  /**
   * Add an event to an open span.
   *
   * @param traceId - The owning trace id.
   * @param spanId - The span id.
   * @param name - Event name.
   * @param attributes - Optional event attributes.
   */
  addEvent(
    traceId: string,
    spanId: string,
    name: string,
    attributes?: Record<string, unknown>,
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace "${traceId}" not found.`);
    }
    const span = trace.spans.find((s) => s.id === spanId);
    if (!span) {
      throw new Error(`Span "${spanId}" not found in trace "${traceId}".`);
    }
    span.events.push({ name, timestamp: Date.now(), attributes });
  }

  /**
   * End an open span.
   *
   * @param traceId - The owning trace id.
   * @param spanId - The span id.
   * @param status - The outcome status.
   * @param attributes - Optional attributes to merge.
   */
  endSpan(
    traceId: string,
    spanId: string,
    status: SpanStatus = "ok",
    attributes: Record<string, unknown> = {},
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace "${traceId}" not found.`);
    }
    const span = trace.spans.find((s) => s.id === spanId);
    if (!span) {
      throw new Error(`Span "${spanId}" not found in trace "${traceId}".`);
    }
    span.endTime = Date.now();
    span.status = status;
    Object.assign(span.attributes, attributes);
  }

  /**
   * End a trace and invoke all exporters.
   *
   * @param traceId - The trace id.
   * @param attributes - Optional attributes to merge.
   */
  async endTrace(
    traceId: string,
    attributes: Record<string, unknown> = {},
  ): Promise<Trace> {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace "${traceId}" not found.`);
    }
    trace.endTime = Date.now();
    Object.assign(trace.attributes, attributes);

    // Export
    for (const exporter of this.exporters) {
      await exporter(trace);
    }

    // Remove from active traces
    this.traces.delete(traceId);
    return trace;
  }

  /** Get an active trace by id. */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /** Get all active traces. */
  getActiveTraces(): Trace[] {
    return Array.from(this.traces.values());
  }
}
