/**
 * @openlinkos/channel — Core channel interface, types, and base class.
 *
 * Provides the unified Channel abstraction that all platform adapters
 * implement, plus a BaseChannel with common reconnect / error logic
 * and a ChannelManager for multi-channel orchestration.
 */

// Types
export type {
  MessageRole,
  ChannelMessage,
  MessageHandler,
  ErrorHandler,
  ChannelStatus,
  Channel,
  BaseChannelConfig,
} from "./types.js";

// Base class
export { BaseChannel } from "./base.js";

// Manager
export { ChannelManager } from "./manager.js";
