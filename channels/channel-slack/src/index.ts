import type { Agent } from "@openlinkos/agent";

/** Configuration for the Slack channel adapter. */
export interface SlackChannelConfig {
  /** The Slack bot OAuth token (xoxb-...). */
  botToken: string;
  /** The signing secret used to verify incoming requests from Slack. */
  signingSecret: string;
  /** Optional app-level token (xapp-...) for Socket Mode connections. */
  appToken?: string;
  /** The agent to handle incoming messages. */
  agent: Agent;
}

/** A running Slack channel instance. */
export interface SlackChannel {
  /** Start the channel and begin receiving messages. */
  start(): Promise<void>;
  /** Stop the channel and clean up resources. */
  stop(): Promise<void>;
}

/**
 * Create a Slack channel adapter that connects an agent to the Slack API.
 *
 * @param config - Slack channel configuration
 * @returns A SlackChannel instance
 */
export function createSlackChannel(config: SlackChannelConfig): SlackChannel {
  throw new Error("not yet implemented - coming in Phase 5");
}
