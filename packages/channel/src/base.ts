/**
 * BaseChannel — abstract base class with common logic for channel adapters.
 *
 * Provides reconnection handling, error propagation, and message handler
 * management so concrete adapters only need to implement the transport layer.
 */

import type {
  Channel,
  ChannelMessage,
  ChannelStatus,
  MessageHandler,
  ErrorHandler,
  BaseChannelConfig,
} from "./types.js";

export abstract class BaseChannel implements Channel {
  readonly name: string;

  private _status: ChannelStatus = "disconnected";
  private _messageHandlers: MessageHandler[] = [];
  private _errorHandlers: ErrorHandler[] = [];
  private _reconnectAttempts = 0;

  protected readonly autoReconnect: boolean;
  protected readonly maxReconnectAttempts: number;
  protected readonly reconnectDelay: number;

  constructor(config: BaseChannelConfig) {
    this.name = config.name;
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 5;
    this.reconnectDelay = config.reconnectDelay ?? 1000;
  }

  get status(): ChannelStatus {
    return this._status;
  }

  /** Update connection status. Subclasses should call this. */
  protected setStatus(status: ChannelStatus): void {
    this._status = status;
  }

  async connect(): Promise<void> {
    this.setStatus("connecting");
    try {
      await this.doConnect();
      this._reconnectAttempts = 0;
      this.setStatus("connected");
    } catch (err) {
      this.setStatus("error");
      this.emitError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.doDisconnect();
    this.setStatus("disconnected");
  }

  onMessage(handler: MessageHandler): void {
    this._messageHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this._errorHandlers.push(handler);
  }

  abstract send(message: ChannelMessage): Promise<void>;

  /** Subclasses implement connection setup here. */
  protected abstract doConnect(): Promise<void>;

  /** Subclasses implement disconnection cleanup here. */
  protected abstract doDisconnect(): Promise<void>;

  /** Dispatch an incoming message to all registered handlers. */
  protected async emitMessage(message: ChannelMessage): Promise<void> {
    for (const handler of this._messageHandlers) {
      await handler(message);
    }
  }

  /** Dispatch an error to all registered handlers. */
  protected emitError(error: Error): void {
    for (const handler of this._errorHandlers) {
      handler(error);
    }
  }

  /**
   * Attempt automatic reconnection.
   * Subclasses should call this when they detect a disconnection.
   */
  protected async attemptReconnect(): Promise<void> {
    if (!this.autoReconnect) return;
    if (this._reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("error");
      this.emitError(
        new Error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`),
      );
      return;
    }

    this._reconnectAttempts++;
    this.setStatus("connecting");

    await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

    try {
      await this.doConnect();
      this._reconnectAttempts = 0;
      this.setStatus("connected");
    } catch {
      await this.attemptReconnect();
    }
  }
}
