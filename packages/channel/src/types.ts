/**
 * Core types for the @openlinkos/channel package.
 *
 * Defines the unified message format and channel interface that all
 * channel adapters must implement.
 */

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Role of the message sender. */
export type MessageRole = "user" | "assistant" | "system";

/** A unified message exchanged through any channel. */
export interface ChannelMessage {
  /** Unique message identifier. */
  id: string;
  /** Role of the sender. */
  role: MessageRole;
  /** Text content of the message. */
  text: string;
  /** ISO-8601 timestamp of when the message was created. */
  timestamp: string;
  /** Platform-specific metadata (e.g. chat ID, thread ID, user info). */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Channel events
// ---------------------------------------------------------------------------

/** Handler invoked when a message is received on a channel. */
export type MessageHandler = (message: ChannelMessage) => void | Promise<void>;

/** Handler invoked when a channel encounters an error. */
export type ErrorHandler = (error: Error) => void;

// ---------------------------------------------------------------------------
// Channel interface
// ---------------------------------------------------------------------------

/** Status of a channel connection. */
export type ChannelStatus = "disconnected" | "connecting" | "connected" | "error";

/** The core channel interface that all adapters implement. */
export interface Channel {
  /** Unique name identifying this channel instance. */
  readonly name: string;
  /** Current connection status. */
  readonly status: ChannelStatus;
  /** Connect to the channel and start receiving messages. */
  connect(): Promise<void>;
  /** Disconnect from the channel and release resources. */
  disconnect(): Promise<void>;
  /** Register a handler for incoming messages. */
  onMessage(handler: MessageHandler): void;
  /** Register a handler for channel errors. */
  onError(handler: ErrorHandler): void;
  /** Send a message through the channel. */
  send(message: ChannelMessage): Promise<void>;
}

// ---------------------------------------------------------------------------
// Channel configuration
// ---------------------------------------------------------------------------

/** Base configuration shared by all channel adapters. */
export interface BaseChannelConfig {
  /** Unique name for this channel instance. */
  name: string;
  /** Whether to automatically reconnect on disconnection. Default: true. */
  autoReconnect?: boolean;
  /** Maximum number of reconnection attempts. Default: 5. */
  maxReconnectAttempts?: number;
  /** Delay in ms between reconnection attempts. Default: 1000. */
  reconnectDelay?: number;
}
