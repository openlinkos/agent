import type { BaseChannelConfig } from "@openlinkos/channel";

/** Configuration for the DingTalk channel adapter. */
export interface DingTalkChannelConfig extends BaseChannelConfig {
  /** The DingTalk bot access token. */
  accessToken: string;
  /** Optional signing secret for verifying incoming webhook requests. */
  secret?: string;
}

/** A running DingTalk channel instance. */
export interface DingTalkChannel {
  /** Start the channel and begin receiving messages. */
  start(): Promise<void>;
  /** Stop the channel and clean up resources. */
  stop(): Promise<void>;
}

/**
 * Create a DingTalk channel adapter that connects an agent to the DingTalk Open Platform.
 *
 * @param config - DingTalk channel configuration
 * @returns A DingTalkChannel instance
 */
export function createDingTalkChannel(_config: DingTalkChannelConfig): DingTalkChannel {
  throw new Error("not yet implemented - coming in Phase 5");
}
