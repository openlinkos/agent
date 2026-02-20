/**
 * ChannelManager — orchestrates multiple channel instances.
 *
 * Provides a single point of control for connecting, disconnecting,
 * broadcasting, and routing messages across channels.
 */

import type { Channel, ChannelMessage, MessageHandler, ErrorHandler } from "./types.js";

export class ChannelManager {
  private _channels = new Map<string, Channel>();
  private _messageHandlers: MessageHandler[] = [];
  private _errorHandlers: ErrorHandler[] = [];

  /** Register a channel with the manager. */
  add(channel: Channel): void {
    if (this._channels.has(channel.name)) {
      throw new Error(`Channel "${channel.name}" is already registered`);
    }
    this._channels.set(channel.name, channel);

    // Forward events from individual channels to manager-level handlers
    channel.onMessage((msg) => this.handleMessage(msg));
    channel.onError((err) => this.handleError(err));
  }

  /** Remove a channel from the manager (disconnects it first if connected). */
  async remove(name: string): Promise<void> {
    const channel = this._channels.get(name);
    if (!channel) {
      throw new Error(`Channel "${name}" is not registered`);
    }
    if (channel.status === "connected" || channel.status === "connecting") {
      await channel.disconnect();
    }
    this._channels.delete(name);
  }

  /** Get a channel by name. */
  get(name: string): Channel | undefined {
    return this._channels.get(name);
  }

  /** List all registered channel names. */
  list(): string[] {
    return Array.from(this._channels.keys());
  }

  /** Connect all registered channels. */
  async connectAll(): Promise<void> {
    const promises = Array.from(this._channels.values()).map((ch) => ch.connect());
    await Promise.all(promises);
  }

  /** Disconnect all registered channels. */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this._channels.values()).map((ch) => ch.disconnect());
    await Promise.all(promises);
  }

  /** Register a handler for messages arriving on any channel. */
  onMessage(handler: MessageHandler): void {
    this._messageHandlers.push(handler);
  }

  /** Register a handler for errors from any channel. */
  onError(handler: ErrorHandler): void {
    this._errorHandlers.push(handler);
  }

  /** Broadcast a message to all connected channels. */
  async broadcast(message: ChannelMessage): Promise<void> {
    const connected = Array.from(this._channels.values()).filter(
      (ch) => ch.status === "connected",
    );
    const promises = connected.map((ch) => ch.send(message));
    await Promise.all(promises);
  }

  /** Send a message to a specific channel by name. */
  async sendTo(channelName: string, message: ChannelMessage): Promise<void> {
    const channel = this._channels.get(channelName);
    if (!channel) {
      throw new Error(`Channel "${channelName}" is not registered`);
    }
    await channel.send(message);
  }

  private async handleMessage(message: ChannelMessage): Promise<void> {
    for (const handler of this._messageHandlers) {
      await handler(message);
    }
  }

  private handleError(error: Error): void {
    for (const handler of this._errorHandlers) {
      handler(error);
    }
  }
}
