/**
 * Eval runner for @openlinkos/eval.
 *
 * Executes eval cases against an agent, collects results,
 * and produces evaluation reports.
 */

import type { Agent } from "@openlinkos/agent";
import type {
  EvalCase,
  EvalResult,
  EvalSuite,
  EvalReport,
  EvalSummary,
  EvalRunOptions,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a batch of async functions with a concurrency limit.
 */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Run a single eval case against an agent.
 */
async function runCase(
  agent: Agent,
  evalCase: EvalCase,
  suite: EvalSuite,
  threshold: number,
  timeout: number,
): Promise<EvalResult> {
  const start = Date.now();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      agent.run(evalCase.input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Eval case timed out after ${timeout}ms`)),
          timeout,
        );
      }),
    ]);

    const duration = Date.now() - start;
    const scorerResult = await suite.scorer.score(response, evalCase.expected);

    return {
      case: evalCase,
      response,
      score: scorerResult.score,
      passed: scorerResult.score >= threshold,
      details: scorerResult.details,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    return {
      case: evalCase,
      response: {
        text: "",
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        agentName: agent.name,
      },
      score: 0,
      passed: false,
      details: `Error: ${error}`,
      duration,
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Compute summary statistics from eval results.
 */
function computeSummary(results: EvalResult[]): EvalSummary {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const averageScore = total > 0 ? totalScore / total : 0;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passRate = total > 0 ? passed / total : 0;

  return { total, passed, failed, averageScore, totalDuration, passRate };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all cases in an eval suite against an agent.
 *
 * @param agent - The agent to evaluate.
 * @param suite - The eval suite to run.
 * @param options - Optional run configuration.
 * @returns An EvalReport with results and summary.
 */
export async function runEval(
  agent: Agent,
  suite: EvalSuite,
  options?: EvalRunOptions,
): Promise<EvalReport> {
  const concurrency = options?.concurrency ?? 5;
  const timeout = options?.timeout ?? 30_000;
  const threshold = options?.threshold ?? suite.threshold ?? 1.0;
  const timestamp = new Date().toISOString();

  const tasks = suite.cases.map((evalCase) => () =>
    runCase(agent, evalCase, suite, threshold, timeout),
  );

  const results = await withConcurrency(tasks, concurrency);
  const summary = computeSummary(results);

  return { suite, results, summary, timestamp };
}

/**
 * Run multiple eval suites against an agent.
 *
 * @param agent - The agent to evaluate.
 * @param suites - The eval suites to run.
 * @param options - Optional run configuration.
 * @returns An array of EvalReports.
 */
export async function runEvalSuite(
  agent: Agent,
  suites: EvalSuite[],
  options?: EvalRunOptions,
): Promise<EvalReport[]> {
  const reports: EvalReport[] = [];
  for (const suite of suites) {
    const report = await runEval(agent, suite, options);
    reports.push(report);
  }
  return reports;
}
