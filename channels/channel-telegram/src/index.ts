import type { Agent } from "@openlinkos/agent";

/** Configuration for the Telegram channel adapter. */
export interface TelegramChannelConfig {
  /** The Telegram Bot API token obtained from BotFather. */
  botToken: string;
  /** Optional webhook URL for receiving updates. If omitted, long polling is used. */
  webhookUrl?: string;
  /** The agent to handle incoming messages. */
  agent: Agent;
}

/** A running Telegram channel instance. */
export interface TelegramChannel {
  /** Start the channel and begin receiving messages. */
  start(): Promise<void>;
  /** Stop the channel and clean up resources. */
  stop(): Promise<void>;
}

/**
 * Create a Telegram channel adapter that connects an agent to the Telegram Bot API.
 *
 * @param config - Telegram channel configuration
 * @returns A TelegramChannel instance
 */
export function createTelegramChannel(config: TelegramChannelConfig): TelegramChannel {
  throw new Error("not yet implemented - coming in Phase 4");
}
