/**
 * Console exporter — pretty-prints a trace tree with indentation and timing.
 */

import type { Trace, Span, TraceExporter } from "../tracer.js";

/** Options for the console exporter. */
export interface ConsoleExporterOptions {
  /** Custom output function. Defaults to `console.log`. */
  logger?: (message: string) => void;
}

/**
 * Build a tree structure from flat span list and print with indentation.
 */
function buildSpanTree(spans: Span[]): Map<string | undefined, Span[]> {
  const children = new Map<string | undefined, Span[]>();
  for (const span of spans) {
    const key = span.parentId;
    if (!children.has(key)) {
      children.set(key, []);
    }
    children.get(key)!.push(span);
  }
  return children;
}

function formatDuration(startTime: number, endTime?: number): string {
  if (endTime === undefined) return "(still running)";
  const ms = endTime - startTime;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function statusIcon(status?: string): string {
  if (status === "ok") return "✓";
  if (status === "error") return "✗";
  return "…";
}

function printSpan(
  span: Span,
  children: Map<string | undefined, Span[]>,
  log: (msg: string) => void,
  depth: number,
): void {
  const indent = "  ".repeat(depth);
  const icon = statusIcon(span.status);
  const duration = formatDuration(span.startTime, span.endTime);
  log(`${indent}${icon} ${span.name} [${duration}]`);

  // Print events
  for (const event of span.events) {
    log(`${indent}    ↳ ${event.name}`);
  }

  // Print attributes if any
  const attrKeys = Object.keys(span.attributes);
  if (attrKeys.length > 0) {
    for (const key of attrKeys) {
      log(`${indent}    ${key}: ${JSON.stringify(span.attributes[key])}`);
    }
  }

  // Recurse children
  const kids = children.get(span.id) ?? [];
  for (const child of kids) {
    printSpan(child, children, log, depth + 1);
  }
}

/**
 * Create a console trace exporter that pretty-prints the trace tree.
 */
export function createConsoleExporter(
  options: ConsoleExporterOptions = {},
): TraceExporter {
  const { logger = console.log } = options;

  return (trace: Trace): void => {
    const duration = formatDuration(trace.startTime, trace.endTime);
    logger(`\nTrace: ${trace.name} [${duration}]`);

    // Print trace-level attributes
    const traceAttrKeys = Object.keys(trace.attributes);
    if (traceAttrKeys.length > 0) {
      for (const key of traceAttrKeys) {
        logger(`  ${key}: ${JSON.stringify(trace.attributes[key])}`);
      }
    }

    // Build tree and print root spans
    const children = buildSpanTree(trace.spans);
    const roots = children.get(undefined) ?? [];
    for (const root of roots) {
      printSpan(root, children, logger, 1);
    }

    logger(""); // trailing newline
  };
}
