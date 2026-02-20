/**
 * Agent engine for @openlinkos/agent.
 *
 * Implements the ReAct (Reason + Act) loop:
 *   think → tool call → observe → repeat until done or max iterations.
 *
 * Supports a middleware stack that intercepts each lifecycle stage
 * (beforeGenerate, afterGenerate, beforeToolCall, afterToolCall, onError).
 */

import type {
  Message,
  ModelResponse,
  ToolCall,
  Usage,
  ToolDefinition as AIToolDefinition,
} from "@openlinkos/ai";
import { AbortError, GuardrailError } from "@openlinkos/ai";
import type {
  AgentConfig,
  AgentResponse,
  AgentStep,
  AgentRunOptions,
  Agent,
} from "./types.js";
import { MaxIterationsError } from "./errors.js";
import { ToolRegistry, executeTool, validateParameters } from "./tools.js";
import {
  runInputGuardrails,
  runOutputGuardrails,
  applyContentFilters,
} from "./guardrails.js";
import { MiddlewareStack } from "./middleware.js";
import type { Plugin } from "./plugin.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyUsage(): Usage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addUsage(a: Usage, b: Usage): Usage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/**
 * Convert an agent ToolDefinition to the @openlinkos/ai ToolDefinition
 * (without the execute function, which is agent-side only).
 */
function toAITools(registry: ToolRegistry): AIToolDefinition[] {
  return registry.all().map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

// ---------------------------------------------------------------------------
// Agent implementation
// ---------------------------------------------------------------------------

/**
 * Create an agent that runs a ReAct loop.
 */
export function createAgentEngine(config: AgentConfig): Agent {
  const {
    name,
    model,
    systemPrompt,
    tools = [],
    maxIterations = 10,
    hooks = {},
    toolTimeout = 30_000,
    inputGuardrails = [],
    outputGuardrails = [],
    contentFilters = [],
    middlewares = [],
    plugins = [],
  } = config;

  // Build tool registry
  const registry = new ToolRegistry();
  for (const tool of tools) {
    registry.register(tool);
  }

  // Build middleware stack
  const mwStack = new MiddlewareStack();
  for (const mw of middlewares) {
    mwStack.use(mw);
  }

  // Track installed plugins for uninstall support
  const installedPlugins = new Map<string, Plugin>();

  // Install initial plugins synchronously (onInstall deferred)
  const pendingPluginInstalls: Array<() => Promise<void>> = [];
  for (const plugin of plugins) {
    if (plugin.middlewares) {
      for (const mw of plugin.middlewares) {
        mwStack.use(mw);
      }
    }
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        registry.register(tool);
      }
    }
    installedPlugins.set(plugin.name, plugin);
    if (plugin.onInstall) {
      const fn = plugin.onInstall;
      pendingPluginInstalls.push(async () => fn());
    }
  }

  // Run pending onInstall callbacks on first run
  let pluginsInitialized = false;
  async function ensurePluginsInitialized(): Promise<void> {
    if (pluginsInitialized) return;
    pluginsInitialized = true;
    for (const fn of pendingPluginInstalls) {
      await fn();
    }
    pendingPluginInstalls.length = 0;
  }

  return {
    name,

    async use(plugin: Plugin): Promise<void> {
      if (installedPlugins.has(plugin.name)) {
        throw new Error(`Plugin "${plugin.name}" is already installed.`);
      }
      if (plugin.middlewares) {
        for (const mw of plugin.middlewares) {
          mwStack.use(mw);
        }
      }
      if (plugin.tools) {
        for (const tool of plugin.tools) {
          registry.register(tool);
        }
      }
      installedPlugins.set(plugin.name, plugin);
      if (plugin.onInstall) {
        await plugin.onInstall();
      }
    },

    async run(input: string, runOptions?: AgentRunOptions): Promise<AgentResponse> {
      await ensurePluginsInitialized();

      const signal = runOptions?.signal;

      // Notify start hook
      if (hooks.onStart) {
        await hooks.onStart(input);
      }

      const steps: AgentStep[] = [];
      const allToolCalls: ToolCall[] = [];
      let totalUsage = emptyUsage();

      try {
        // Check abort before starting
        if (signal?.aborted) {
          throw new AbortError("Agent run was aborted before starting");
        }

        // Run input guardrails before the first model call
        if (inputGuardrails.length > 0) {
          const inputCheck = await runInputGuardrails(inputGuardrails, input);
          if (!inputCheck.passed) {
            const errorMsg = inputCheck.reason ?? "Input guardrail failed";
            throw new GuardrailError(errorMsg, { guardrailName: "input" });
          }
        }

        // Build initial conversation
        const messages: Message[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ];

        const modelRequestOptions = signal ? { signal } : undefined;
        const hasTools = registry.all().length > 0;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
          // Check abort signal between iterations
          if (signal?.aborted) {
            throw new AbortError("Agent run was aborted");
          }

          // --- Middleware: beforeGenerate ---
          const beforeGenCtx = {
            messages,
            tools: registry.all(),
            iteration,
          };
          await mwStack.executeBeforeGenerate(beforeGenCtx);

          // Generate model response
          let response: ModelResponse;
          if (hasTools) {
            response = await model.generateWithTools(messages, toAITools(registry), undefined, modelRequestOptions);
          } else {
            response = await model.generate(messages, undefined, modelRequestOptions);
          }

          // --- Middleware: afterGenerate ---
          const afterGenCtx = {
            response,
            messages,
            iteration,
          };
          await mwStack.executeAfterGenerate(afterGenCtx);
          // The middleware may have mutated afterGenCtx.response in-place
          response = afterGenCtx.response;

          totalUsage = addUsage(totalUsage, response.usage);

          const step: AgentStep = {
            stepNumber: iteration + 1,
            modelResponse: response,
            toolCalls: [],
          };

          // Add assistant message to conversation
          messages.push({
            role: "assistant",
            content: response.text,
            toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
          });

          // If no tool calls, we're done
          if (response.toolCalls.length === 0) {
            steps.push(step);
            if (hooks.onStep) {
              await hooks.onStep(step);
            }
            break;
          }

          // Process tool calls
          for (const toolCall of response.toolCalls) {
            allToolCalls.push(toolCall);

            // Check onToolCall hook (can block execution)
            if (hooks.onToolCall) {
              const hookResult = await hooks.onToolCall(toolCall);
              if (hookResult === false) {
                const blockedResult = "Tool call was blocked by hook.";
                step.toolCalls.push({
                  call: toolCall,
                  result: blockedResult,
                  error: "Blocked by onToolCall hook",
                });
                messages.push({
                  role: "tool",
                  toolCallId: toolCall.id,
                  content: blockedResult,
                });
                continue;
              }
            }

            // --- Middleware: beforeToolCall ---
            const beforeToolCtx = {
              toolCall,
              tool: registry.has(toolCall.name) ? registry.get(toolCall.name) : undefined,
              skip: false,
              result: undefined as string | undefined,
            };
            await mwStack.executeBeforeToolCall(beforeToolCtx);

            // If middleware set skip=true, use the provided result
            if (beforeToolCtx.skip) {
              const skipResult = beforeToolCtx.result ?? "";
              step.toolCalls.push({
                call: toolCall,
                result: skipResult,
              });
              messages.push({
                role: "tool",
                toolCallId: toolCall.id,
                content: skipResult,
              });

              // --- Middleware: afterToolCall (skipped execution) ---
              await mwStack.executeAfterToolCall({
                toolCall,
                result: skipResult,
              });

              if (hooks.onToolResult) {
                await hooks.onToolResult(toolCall, skipResult);
              }
              continue;
            }

            // Execute the tool
            if (!registry.has(toolCall.name)) {
              const errorMsg = `Tool "${toolCall.name}" is not available.`;
              step.toolCalls.push({
                call: toolCall,
                result: "",
                error: errorMsg,
              });
              messages.push({
                role: "tool",
                toolCallId: toolCall.id,
                content: JSON.stringify({ error: errorMsg }),
              });
              continue;
            }

            const tool = registry.get(toolCall.name);

            // Validate parameters
            const validation = validateParameters(
              toolCall.arguments,
              tool.parameters,
            );
            if (!validation.valid) {
              const errorMsg = `Invalid parameters: ${validation.errors.join("; ")}`;
              step.toolCalls.push({
                call: toolCall,
                result: "",
                error: errorMsg,
              });
              messages.push({
                role: "tool",
                toolCallId: toolCall.id,
                content: JSON.stringify({ error: errorMsg }),
              });
              continue;
            }

            // Execute
            const { result, error } = await executeTool(
              tool,
              toolCall.arguments,
              toolTimeout,
            );

            step.toolCalls.push({
              call: toolCall,
              result,
              error,
            });

            // Add tool result to conversation
            const toolContent = error
              ? JSON.stringify({ error })
              : result;
            messages.push({
              role: "tool",
              toolCallId: toolCall.id,
              content: toolContent,
            });

            // --- Middleware: afterToolCall ---
            await mwStack.executeAfterToolCall({
              toolCall,
              result,
              error,
            });

            // Notify onToolResult hook
            if (hooks.onToolResult) {
              await hooks.onToolResult(toolCall, error ?? result);
            }
          }

          steps.push(step);
          if (hooks.onStep) {
            await hooks.onStep(step);
          }
        }

        // Check if we hit max iterations without a final response
        if (steps.length === maxIterations) {
          const ls = steps[steps.length - 1];
          if (ls && ls.toolCalls.length > 0) {
            throw new MaxIterationsError(
              `Agent "${name}" reached maximum iterations (${maxIterations}) without producing a final response`,
            );
          }
        }

        // Extract final text from the last assistant message
        const lastStep = steps[steps.length - 1];
        let finalText = lastStep?.modelResponse.text ?? "";

        // Run output guardrails before returning the final response
        if (outputGuardrails.length > 0) {
          const outputCheck = await runOutputGuardrails(outputGuardrails, finalText);
          if (!outputCheck.passed) {
            const errorMsg = outputCheck.reason ?? "Output guardrail failed";
            throw new GuardrailError(errorMsg, { guardrailName: "output" });
          }
        }

        // Apply content filters to the final response text
        if (contentFilters.length > 0) {
          const filtered = await applyContentFilters(contentFilters, finalText);
          if (filtered === null) {
            throw new GuardrailError("Content was blocked by content filter", { guardrailName: "content-filter" });
          }
          finalText = filtered;
        }

        const agentResponse: AgentResponse = {
          text: finalText,
          steps,
          toolCalls: allToolCalls,
          usage: totalUsage,
          agentName: name,
        };

        if (hooks.onEnd) {
          await hooks.onEnd(agentResponse);
        }

        return agentResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        // --- Middleware: onError ---
        const errorCtx = { error, handled: false };
        await mwStack.executeOnError(errorCtx);

        if (hooks.onError) {
          await hooks.onError(error);
        }
        throw error;
      }
    },
  };
}
