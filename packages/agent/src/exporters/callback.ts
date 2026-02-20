/**
 * Callback exporter — invokes a user-provided function with the completed trace.
 */

import type { Trace, TraceExporter } from "../tracer.js";

/** Callback function signature. */
export type TraceCallback = (trace: Trace) => void | Promise<void>;

/**
 * Create a callback trace exporter that invokes the provided function.
 */
export function createCallbackExporter(callback: TraceCallback): TraceExporter {
  return (trace: Trace): void | Promise<void> => {
    return callback(trace);
  };
}
