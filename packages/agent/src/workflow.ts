/**
 * Workflow engine for @openlinkos/agent.
 *
 * Executes multi-step workflows where each step can be an agent invocation
 * or a plain function. Supports sequential execution, conditional branching,
 * loops with max-iteration guards, and per-step error handling.
 */

import type { Agent, AgentResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The function executed at each workflow step. */
export type StepFunction = (input: unknown) => unknown | Promise<unknown>;

/** A single step in a workflow. */
export interface WorkflowStep {
  /** Unique name identifying this step. */
  name: string;
  /** An agent to run (input is converted to string), or a plain function. */
  agent?: Agent;
  /** A plain function to execute (mutually exclusive with agent, but agent takes precedence). */
  fn?: StepFunction;
  /** Transform the workflow input before passing to the step. */
  inputTransform?: (input: unknown) => unknown | Promise<unknown>;
  /** Transform the step output before passing to the next step. */
  outputTransform?: (output: unknown) => unknown | Promise<unknown>;
  /**
   * Condition evaluated after the step completes.
   * Return the name of the next step, or "done" to finish early.
   * If not provided, the workflow proceeds to the next step in order.
   */
  condition?: (result: unknown) => string | Promise<string>;
  /** Number of retry attempts on error (default: 0). */
  retries?: number;
  /** Fallback value returned if all retries are exhausted. */
  fallback?: unknown;
}

/** Callback invoked after each step completes. */
export type OnStepComplete = (
  stepName: string,
  result: unknown,
  stepIndex: number,
) => void | Promise<void>;

/** Callback invoked when a step encounters an error. */
export type OnWorkflowError = (
  stepName: string,
  error: Error,
) => void | Promise<void>;

/** Configuration for creating a workflow. */
export interface WorkflowConfig {
  /** Unique name for the workflow. */
  name: string;
  /** Ordered list of steps. */
  steps: WorkflowStep[];
  /** Called after each step completes successfully. */
  onStepComplete?: OnStepComplete;
  /** Called when a step errors (after retries). */
  onError?: OnWorkflowError;
  /** Maximum total step executions to prevent infinite loops (default: 100). */
  maxIterations?: number;
}

/** The result of running a workflow. */
export interface WorkflowResult {
  /** The final output value. */
  result: unknown;
  /** Ordered record of each executed step's output. */
  stepResults: Record<string, unknown>;
}

/** A runnable workflow instance. */
export interface Workflow {
  /** The workflow name. */
  readonly name: string;
  /** Execute the workflow with the given initial input. */
  run(input: unknown): Promise<WorkflowResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a runnable workflow.
 *
 * @param config - Workflow configuration with steps and hooks.
 * @returns A Workflow instance.
 */
export function createWorkflow(config: WorkflowConfig): Workflow {
  const {
    name,
    steps,
    onStepComplete,
    onError,
    maxIterations = 100,
  } = config;

  if (steps.length === 0) {
    throw new Error("Workflow must have at least one step");
  }

  // Build a lookup from step name → index for branching
  const stepIndex = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    stepIndex.set(steps[i].name, i);
  }

  return {
    name,

    async run(input: unknown): Promise<WorkflowResult> {
      const stepResults: Record<string, unknown> = {};
      let currentValue: unknown = input;
      let cursor = 0;
      let iterations = 0;

      while (cursor < steps.length) {
        if (iterations >= maxIterations) {
          throw new Error(
            `Workflow "${name}" exceeded maximum iterations (${maxIterations})`,
          );
        }
        iterations++;

        const step = steps[cursor];

        // --- Execute the step (with retries) ---
        let result: unknown;
        const maxAttempts = (step.retries ?? 0) + 1;
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            result = await executeStep(step, currentValue);
            lastError = undefined;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            // If we still have retries left, continue
            if (attempt < maxAttempts - 1) {
              continue;
            }
          }
        }

        // If all retries exhausted, check fallback or abort
        if (lastError !== undefined) {
          if (onError) {
            await onError(step.name, lastError);
          }
          if ("fallback" in step) {
            result = step.fallback;
          } else {
            throw lastError;
          }
        }

        stepResults[step.name] = result;
        currentValue = result;

        if (onStepComplete) {
          await onStepComplete(step.name, result, cursor);
        }

        // --- Determine next step ---
        if (step.condition) {
          const next = await step.condition(result);
          if (next === "done") {
            break;
          }
          const nextIdx = stepIndex.get(next);
          if (nextIdx === undefined) {
            throw new Error(
              `Workflow "${name}": step "${step.name}" condition returned unknown step "${next}"`,
            );
          }
          cursor = nextIdx;
        } else {
          cursor++;
        }
      }

      return { result: currentValue, stepResults };
    },
  };
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

async function executeStep(
  step: WorkflowStep,
  input: unknown,
): Promise<unknown> {
  // Apply input transform
  let stepInput = input;
  if (step.inputTransform) {
    stepInput = await step.inputTransform(input);
  }

  // Execute: agent takes precedence over fn
  let output: unknown;
  if (step.agent) {
    const textInput =
      typeof stepInput === "string" ? stepInput : JSON.stringify(stepInput);
    const response: AgentResponse = await step.agent.run(textInput);
    output = response.text;
  } else if (step.fn) {
    output = await step.fn(stepInput);
  } else {
    throw new Error(
      `Workflow step "${step.name}" must have either an agent or a fn`,
    );
  }

  // Apply output transform
  if (step.outputTransform) {
    output = await step.outputTransform(output);
  }

  return output;
}
