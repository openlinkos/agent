/**
 * JSON reporter for eval results.
 *
 * Produces a machine-readable JSON report suitable for CI artifacts.
 */

import type { EvalReport, Reporter } from "../types.js";

/** JSON-serializable report format. */
export interface JSONReportOutput {
  timestamp: string;
  suites: Array<{
    name: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
      averageScore: number;
      passRate: number;
      totalDuration: number;
    };
    results: Array<{
      input: string;
      expected: string | string[];
      response: string;
      score: number;
      passed: boolean;
      details: string;
      duration: number;
      metadata?: Record<string, unknown>;
    }>;
  }>;
  overall: {
    totalSuites: number;
    totalCases: number;
    totalPassed: number;
    totalFailed: number;
    passRate: number;
  };
}

/** Options for the JSON reporter. */
export interface JSONReporterOptions {
  /** Pretty-print the JSON output. Default: true. */
  pretty?: boolean;
  /** Write to a file path instead of stdout. */
  outputPath?: string;
}

/**
 * Create a JSON reporter.
 *
 * Outputs the report as a JSON string to stdout (or optionally to a file).
 */
export function createJSONReporter(options?: JSONReporterOptions): Reporter & { getOutput: () => JSONReportOutput | null } {
  const pretty = options?.pretty ?? true;
  let lastOutput: JSONReportOutput | null = null;

  function buildSuiteOutput(report: EvalReport) {
    return {
      name: report.suite.name,
      summary: {
        total: report.summary.total,
        passed: report.summary.passed,
        failed: report.summary.failed,
        averageScore: report.summary.averageScore,
        passRate: report.summary.passRate,
        totalDuration: report.summary.totalDuration,
      },
      results: report.results.map((r) => ({
        input: r.case.input,
        expected: r.case.expected,
        response: r.response.text,
        score: r.score,
        passed: r.passed,
        details: r.details,
        duration: r.duration,
        metadata: r.case.metadata,
      })),
    };
  }

  return {
    report(report: EvalReport): void {
      const output: JSONReportOutput = {
        timestamp: report.timestamp,
        suites: [buildSuiteOutput(report)],
        overall: {
          totalSuites: 1,
          totalCases: report.summary.total,
          totalPassed: report.summary.passed,
          totalFailed: report.summary.failed,
          passRate: report.summary.passRate,
        },
      };

      lastOutput = output;
      const json = pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
      console.log(json);
    },

    reportAll(reports: EvalReport[]): void {
      const totalCases = reports.reduce((sum, r) => sum + r.summary.total, 0);
      const totalPassed = reports.reduce((sum, r) => sum + r.summary.passed, 0);

      const output: JSONReportOutput = {
        timestamp: new Date().toISOString(),
        suites: reports.map(buildSuiteOutput),
        overall: {
          totalSuites: reports.length,
          totalCases,
          totalPassed,
          totalFailed: totalCases - totalPassed,
          passRate: totalCases > 0 ? totalPassed / totalCases : 0,
        },
      };

      lastOutput = output;
      const json = pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
      console.log(json);
    },

    getOutput(): JSONReportOutput | null {
      return lastOutput;
    },
  };
}
