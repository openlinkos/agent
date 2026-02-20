/**
 * Conversation management for @openlinkos/agent.
 *
 * Wraps an Agent with persistent message history, enabling multi-turn
 * conversations. Supports context window management, forking, and history
 * inspection.
 */

import type { Message } from "@openlinkos/ai";
import type { Agent, AgentConfig, AgentResponse, AgentRunOptions } from "./types.js";
import { createAgentEngine } from "./agent.js";
import type { SlidingWindowStrategy } from "./context-window.js";

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

/** Options for creating a conversation. */
export interface ConversationOptions {
  /** Optional sliding window strategy for context management. */
  contextWindow?: SlidingWindowStrategy;
}

/** A multi-turn conversation wrapping an Agent. */
export class Conversation {
  /** The underlying agent. */
  readonly agent: Agent;

  private history: Message[];
  private readonly systemPrompt: string;
  private readonly contextWindow?: SlidingWindowStrategy;

  constructor(
    agent: Agent,
    systemPrompt: string,
    options?: ConversationOptions,
  ) {
    this.agent = agent;
    this.systemPrompt = systemPrompt;
    this.history = [{ role: "system", content: systemPrompt }];
    this.contextWindow = options?.contextWindow;
  }

  /**
   * Send a message and get the agent's response.
   *
   * Appends the user message and agent response to history,
   * optionally applying context window trimming before the agent call.
   */
  async send(
    input: string,
    options?: AgentRunOptions,
  ): Promise<AgentResponse> {
    // Add user message to history
    this.history.push({ role: "user", content: input });

    // Apply context window if configured
    let messagesToSend = this.history;
    if (this.contextWindow) {
      messagesToSend = this.contextWindow.apply(this.history);
    }

    // Build the combined input from non-system messages for the agent
    // The agent internally prepends the system prompt, so we extract
    // user/assistant turns and pass the last user input.
    // However, the agent.run() only accepts a string input and builds
    // its own message array. For multi-turn, we need the full history.
    // We'll call agent.run() with the latest input but the agent
    // will only see that single turn.
    //
    // To properly support multi-turn, we call the model directly
    // through the agent's run method with the full conversation context
    // serialized as the input. But the cleaner approach is to use the
    // agent as-is and build context into the input.
    //
    // The pragmatic approach: serialize the conversation history
    // (minus system prompt which the agent adds) into the input string.
    const contextMessages = messagesToSend.filter((m) => m.role !== "system");
    const conversationInput = this.buildConversationInput(contextMessages);

    const response = await this.agent.run(conversationInput, options);

    // Add assistant response to history
    this.history.push({ role: "assistant", content: response.text });

    return response;
  }

  /** Get the full message history including system prompt. */
  getHistory(): Message[] {
    return [...this.history];
  }

  /** Clear all messages except the system prompt. */
  clear(): void {
    this.history = [{ role: "system", content: this.systemPrompt }];
  }

  /**
   * Fork this conversation, creating a new Conversation with a copy
   * of the current history. Changes to the fork do not affect the original.
   */
  fork(): Conversation {
    const forked = new Conversation(this.agent, this.systemPrompt, {
      contextWindow: this.contextWindow,
    });
    forked.history = [...this.history];
    return forked;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Build a single input string from conversation history.
   *
   * Formats prior turns so the agent sees the full conversation context
   * while using its standard run() interface.
   */
  private buildConversationInput(messages: Message[]): string {
    if (messages.length <= 1) {
      // Single message — just return its content
      const msg = messages[0];
      if (!msg) return "";
      return msg.role === "assistant"
        ? (msg.content ?? "")
        : msg.content;
    }

    // Multiple messages — format as conversation context
    const parts: string[] = [];
    for (const msg of messages) {
      if (msg.role === "user") {
        parts.push(`[user]: ${msg.content}`);
      } else if (msg.role === "assistant") {
        parts.push(`[assistant]: ${msg.content ?? ""}`);
      } else if (msg.role === "tool") {
        parts.push(`[tool]: ${msg.content}`);
      }
    }
    return parts.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new Conversation from an AgentConfig.
 *
 * This is a convenience factory that creates both the agent and wraps it
 * in a Conversation instance.
 */
export function createConversation(
  config: AgentConfig,
  options?: ConversationOptions,
): Conversation {
  const agent = createAgentEngine(config);
  return new Conversation(agent, config.systemPrompt, options);
}
