import type { Agent } from "@openlinkos/agent";

/** Configuration for the Discord channel adapter. */
export interface DiscordChannelConfig {
  /** The Discord bot token obtained from the Discord Developer Portal. */
  botToken: string;
  /** Optional guild (server) ID to restrict the bot to a specific server. */
  guildId?: string;
  /** The agent to handle incoming messages. */
  agent: Agent;
}

/** A running Discord channel instance. */
export interface DiscordChannel {
  /** Start the channel and begin receiving messages. */
  start(): Promise<void>;
  /** Stop the channel and clean up resources. */
  stop(): Promise<void>;
}

/**
 * Create a Discord channel adapter that connects an agent to the Discord API.
 *
 * @param config - Discord channel configuration
 * @returns A DiscordChannel instance
 */
export function createDiscordChannel(_config: DiscordChannelConfig): DiscordChannel {
  throw new Error("not yet implemented - coming in Phase 5");
}
