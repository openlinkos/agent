/**
 * Agent engine for @openlinkos/agent.
 *
 * Implements the ReAct (Reason + Act) loop:
 *   think → tool call → observe → repeat until done or max iterations.
 */

import type {
  Message,
  ModelResponse,
  ToolCall,
  Usage,
  ToolDefinition as AIToolDefinition,
} from "@openlinkos/ai";
import type {
  AgentConfig,
  AgentResponse,
  AgentStep,
  Agent,
} from "./types.js";
import { ToolRegistry, executeTool, validateParameters } from "./tools.js";

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
  } = config;

  // Build tool registry
  const registry = new ToolRegistry();
  for (const tool of tools) {
    registry.register(tool);
  }

  const hasTools = tools.length > 0;

  return {
    name,

    async run(input: string): Promise<AgentResponse> {
      // Notify start hook
      if (hooks.onStart) {
        await hooks.onStart(input);
      }

      const steps: AgentStep[] = [];
      const allToolCalls: ToolCall[] = [];
      let totalUsage = emptyUsage();

      // Build initial conversation
      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ];

      try {
        for (let iteration = 0; iteration < maxIterations; iteration++) {
          // Generate model response
          let response: ModelResponse;
          if (hasTools) {
            response = await model.generateWithTools(messages, toAITools(registry));
          } else {
            response = await model.generate(messages);
          }

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

        // Extract final text from the last assistant message
        const lastStep = steps[steps.length - 1];
        const finalText = lastStep?.modelResponse.text ?? "";

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
        if (hooks.onError) {
          await hooks.onError(error);
        }
        throw error;
      }
    },
  };
}
