/**
 * Agent presets — pre-configured agent templates for common use cases.
 *
 * Each preset returns an AgentConfig that can be passed directly to
 * `createAgent()`, with every field overridable by the caller.
 */

import type { Model } from "@openlinkos/ai";
import type { AgentConfig, ToolDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Preset helpers
// ---------------------------------------------------------------------------

/** Merge a preset config with user overrides (shallow, user wins). */
function merge(
  preset: AgentConfig,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  if (!overrides) return preset;
  return { ...preset, ...overrides };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const presets = {
  /**
   * Conversational chatbot preset.
   *
   * Friendly, helpful assistant that maintains a natural conversational tone.
   */
  chatbot(model: Model, overrides?: Partial<AgentConfig>): AgentConfig {
    return merge(
      {
        name: "chatbot",
        model,
        systemPrompt:
          "You are a friendly and helpful conversational assistant. " +
          "Respond in a warm, natural tone. Be concise but thorough. " +
          "Ask clarifying questions when the user's intent is unclear. " +
          "Remember context from the conversation to provide coherent follow-ups.",
      },
      overrides,
    );
  },

  /**
   * Research agent preset.
   *
   * Analytical researcher that gathers information and synthesizes findings.
   * Optionally accepts tools (e.g., web search, document retrieval).
   */
  researcher(
    model: Model,
    tools?: ToolDefinition[],
    overrides?: Partial<AgentConfig>,
  ): AgentConfig {
    return merge(
      {
        name: "researcher",
        model,
        systemPrompt:
          "You are a meticulous research analyst. " +
          "Break down complex questions into sub-questions. " +
          "Use available tools to gather data, then synthesize your findings " +
          "into clear, well-structured answers with supporting evidence. " +
          "Always cite your sources and distinguish facts from inferences.",
        tools: tools ?? [],
        maxIterations: 15,
      },
      overrides,
    );
  },

  /**
   * Code generation agent preset.
   *
   * Expert programmer that writes clean, well-documented code.
   */
  coder(model: Model, overrides?: Partial<AgentConfig>): AgentConfig {
    return merge(
      {
        name: "coder",
        model,
        systemPrompt:
          "You are an expert software engineer. " +
          "Write clean, efficient, and well-documented code. " +
          "Follow best practices and established patterns. " +
          "When asked to implement something, provide complete, working code " +
          "with appropriate error handling. Explain your design decisions briefly.",
      },
      overrides,
    );
  },

  /**
   * Data analysis agent preset.
   *
   * Analyst that interprets data, finds patterns, and produces insights.
   */
  analyst(model: Model, overrides?: Partial<AgentConfig>): AgentConfig {
    return merge(
      {
        name: "analyst",
        model,
        systemPrompt:
          "You are a data analysis expert. " +
          "Interpret datasets, identify trends, and surface actionable insights. " +
          "Present findings clearly with relevant statistics. " +
          "When appropriate, suggest visualizations or further analyses. " +
          "Be precise with numbers and transparent about limitations in the data.",
      },
      overrides,
    );
  },
};
