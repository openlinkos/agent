/**
 * Communication primitives for inter-agent messaging.
 *
 * Provides a shared blackboard (key-value store), a message bus for
 * point-to-point communication, and a structured handoff protocol.
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { TeamContext, TeamMessage } from "./types.js";

// ---------------------------------------------------------------------------
// Message bus
// ---------------------------------------------------------------------------

/** A simple message bus for agent-to-agent communication. */
export class MessageBus {
  private messages: TeamMessage[] = [];

  /** Send a message from one agent to another. */
  send(from: string, to: string, content: string): void {
    this.messages.push({
      from,
      to,
      content,
      timestamp: Date.now(),
    });
  }

  /** Get all messages for a specific agent. */
  getFor(agentName: string): TeamMessage[] {
    return this.messages.filter((m) => m.to === agentName);
  }

  /** Get all messages sent by a specific agent. */
  getFrom(agentName: string): TeamMessage[] {
    return this.messages.filter((m) => m.from === agentName);
  }

  /** Get all messages in the bus. */
  all(): TeamMessage[] {
    return [...this.messages];
  }

  /** Clear all messages. */
  clear(): void {
    this.messages = [];
  }
}

// ---------------------------------------------------------------------------
// Blackboard (shared key-value store)
// ---------------------------------------------------------------------------

/** A shared blackboard accessible by all agents in a team. */
export class Blackboard {
  private store = new Map<string, unknown>();

  /** Set a value on the blackboard. */
  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  /** Get a value from the blackboard. */
  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /** Check if a key exists on the blackboard. */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Delete a key from the blackboard. */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /** Get the underlying Map (for TeamContext). */
  toMap(): Map<string, unknown> {
    return this.store;
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Handoff protocol
// ---------------------------------------------------------------------------

/** A structured handoff from one agent to the next. */
export interface Handoff {
  /** The agent handing off. */
  fromAgent: string;
  /** The agent receiving. */
  toAgent: string;
  /** The output from the handing-off agent. */
  output: string;
  /** Optional instructions for the receiving agent. */
  instructions?: string;
}

/**
 * Create a handoff from an agent response to the next agent.
 */
export function createHandoff(
  fromAgent: string,
  toAgent: string,
  response: AgentResponse,
  instructions?: string,
): Handoff {
  return {
    fromAgent,
    toAgent,
    output: response.text,
    instructions,
  };
}

/**
 * Format a handoff as input text for the receiving agent.
 */
export function formatHandoffInput(handoff: Handoff): string {
  const parts: string[] = [];
  parts.push(`[Handoff from ${handoff.fromAgent}]`);
  parts.push(handoff.output);
  if (handoff.instructions) {
    parts.push(`[Instructions: ${handoff.instructions}]`);
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Team context factory
// ---------------------------------------------------------------------------

/**
 * Create a TeamContext instance with the given blackboard and message bus.
 */
export function createTeamContext(
  blackboard: Blackboard,
  messageBus: MessageBus,
  currentRound: number,
  previousResults: AgentResponse[],
): TeamContext {
  return {
    blackboard: blackboard.toMap(),
    currentRound,
    previousResults,
    sendMessage: (from, to, content) => messageBus.send(from, to, content),
    getMessages: (agentName) => messageBus.getFor(agentName),
  };
}
