/**
 * Console reporter for eval results.
 *
 * Outputs a formatted summary to stdout with pass/fail indicators,
 * scores, and suite-level statistics.
 */

import type { EvalReport, Reporter } from "../types.js";

/**
 * Create a console reporter for eval results.
 */
export function createConsoleReporter(): Reporter {
  return {
    report(report: EvalReport): void {
      const { suite, results, summary } = report;

      console.log("");
      console.log(`${"=".repeat(60)}`);
      console.log(`  Eval Suite: ${suite.name}`);
      console.log(`${"=".repeat(60)}`);
      console.log("");

      for (const result of results) {
        const icon = result.passed ? "PASS" : "FAIL";
        const input =
          result.case.input.length > 50
            ? result.case.input.slice(0, 50) + "..."
            : result.case.input;

        console.log(
          `  [${icon}] ${input}`,
        );
        console.log(
          `         Score: ${result.score.toFixed(2)} | ${result.duration}ms`,
        );
        if (!result.passed) {
          console.log(`         ${result.details}`);
        }
      }

      console.log("");
      console.log(`  ${"─".repeat(56)}`);
      console.log(
        `  Results: ${summary.passed}/${summary.total} passed (${(summary.passRate * 100).toFixed(1)}%)`,
      );
      console.log(`  Average Score: ${summary.averageScore.toFixed(3)}`);
      console.log(`  Total Duration: ${summary.totalDuration}ms`);
      console.log(`${"=".repeat(60)}`);
      console.log("");
    },

    reportAll(reports: EvalReport[]): void {
      for (const report of reports) {
        this.report(report);
      }

      // Overall summary
      const totalCases = reports.reduce((sum, r) => sum + r.summary.total, 0);
      const totalPassed = reports.reduce((sum, r) => sum + r.summary.passed, 0);
      const totalFailed = totalCases - totalPassed;
      const overallPassRate = totalCases > 0 ? totalPassed / totalCases : 0;

      console.log(`${"*".repeat(60)}`);
      console.log("  OVERALL SUMMARY");
      console.log(`${"*".repeat(60)}`);
      console.log(`  Suites: ${reports.length}`);
      console.log(`  Cases:  ${totalPassed}/${totalCases} passed (${(overallPassRate * 100).toFixed(1)}%)`);
      console.log(`  Failed: ${totalFailed}`);
      console.log(`${"*".repeat(60)}`);
      console.log("");
    },
  };
}
