import type { Agent } from "@openlinkos/agent";

/** Configuration for the Feishu (Lark) channel adapter. */
export interface FeishuChannelConfig {
  /** The Feishu application ID. */
  appId: string;
  /** The Feishu application secret. */
  appSecret: string;
  /** Optional verification token for validating incoming webhook requests. */
  verificationToken?: string;
  /** The agent to handle incoming messages. */
  agent: Agent;
}

/** A running Feishu channel instance. */
export interface FeishuChannel {
  /** Start the channel and begin receiving messages. */
  start(): Promise<void>;
  /** Stop the channel and clean up resources. */
  stop(): Promise<void>;
}

/**
 * Create a Feishu (Lark) channel adapter that connects an agent to the Feishu Open Platform.
 *
 * @param config - Feishu channel configuration
 * @returns A FeishuChannel instance
 */
export function createFeishuChannel(config: FeishuChannelConfig): FeishuChannel {
  throw new Error("not yet implemented - coming in Phase 5");
}
