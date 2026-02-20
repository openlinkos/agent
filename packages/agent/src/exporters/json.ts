/**
 * JSON exporter — serializes a completed trace to JSON.
 */

import type { Trace, TraceExporter } from "../tracer.js";

/** Options for the JSON exporter. */
export interface JsonExporterOptions {
  /** Custom output function. Defaults to `console.log`. */
  logger?: (json: string) => void;
  /** Number of spaces for indentation. 0 for compact. Default: 2. */
  indent?: number;
}

/**
 * Create a JSON trace exporter that serializes the trace to a JSON string.
 */
export function createJsonExporter(
  options: JsonExporterOptions = {},
): TraceExporter {
  const { logger = console.log, indent = 2 } = options;

  return (trace: Trace): void => {
    const json = JSON.stringify(trace, null, indent);
    logger(json);
  };
}
