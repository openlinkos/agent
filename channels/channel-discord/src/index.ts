/**
 * @openlinkos/channel-discord — Discord channel adapter.
 *
 * Supports message events, slash commands, reactions, and embeds
 * via the Discord Gateway (WebSocket) and REST APIs.
 *
 * Uses an injectable `gateway` for testability — no real Discord
 * connections in tests.
 */

import { BaseChannel } from "@openlinkos/channel";
import type { ChannelMessage, BaseChannelConfig } from "@openlinkos/channel";

// ---------------------------------------------------------------------------
// Discord API types
// ---------------------------------------------------------------------------

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  bot?: boolean;
}

export interface DiscordGuild {
  id: string;
  name: string;
}

export interface DiscordTextChannel {
  id: string;
  name: string;
  guild_id?: string;
}

export interface DiscordMessageData {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
}

export interface DiscordInteraction {
  id: string;
  type: number; // 1=PING, 2=APPLICATION_COMMAND
  channel_id?: string;
  guild_id?: string;
  member?: { user: DiscordUser };
  user?: DiscordUser;
  data?: {
    name: string;
    options?: Array<{ name: string; value: unknown }>;
  };
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

// ---------------------------------------------------------------------------
// Gateway interface (for DI / testing)
// ---------------------------------------------------------------------------

export interface DiscordGateway {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onMessage(handler: (message: DiscordMessageData) => void): void;
  onInteraction(handler: (interaction: DiscordInteraction) => void): void;
  sendMessage(channelId: string, content: string, embeds?: DiscordEmbed[]): Promise<void>;
  sendInteractionResponse(interactionId: string, interactionToken: string, content: string): Promise<void>;
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface DiscordChannelConfig extends BaseChannelConfig {
  /** Discord bot token from the Developer Portal. */
  botToken: string;
  /** Optional guild ID to restrict to a specific server. */
  guildId?: string;
  /** Injected gateway for testing. If not provided, a stub is used. */
  gateway?: DiscordGateway;
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

let messageCounter = 0;

export class DiscordChannel extends BaseChannel {
  private readonly guildId?: string;
  private readonly gateway: DiscordGateway;

  constructor(config: DiscordChannelConfig) {
    super(config);
    this.guildId = config.guildId;
    this.gateway = config.gateway ?? createStubGateway();
  }

  protected async doConnect(): Promise<void> {
    this.gateway.onMessage((msg) => this.handleDiscordMessage(msg));
    this.gateway.onInteraction((interaction) => this.handleInteraction(interaction));
    await this.gateway.connect();
  }

  protected async doDisconnect(): Promise<void> {
    await this.gateway.disconnect();
  }

  async send(message: ChannelMessage): Promise<void> {
    const channelId = message.metadata?.channelId as string | undefined;
    if (!channelId) {
      throw new Error("Cannot send message without channelId in metadata");
    }

    const embeds = message.metadata?.embeds as DiscordEmbed[] | undefined;
    await this.gateway.sendMessage(channelId, message.text, embeds);
  }

  /** React to a message with an emoji. */
  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.gateway.addReaction(channelId, messageId, emoji);
  }

  /** Respond to a slash command interaction. */
  async respondToInteraction(interactionId: string, token: string, content: string): Promise<void> {
    await this.gateway.sendInteractionResponse(interactionId, token, content);
  }

  // -----------------------------------------------------------------------
  // Event handling
  // -----------------------------------------------------------------------

  private handleDiscordMessage(msg: DiscordMessageData): void {
    // Skip bot messages
    if (msg.author.bot) return;

    // If guildId is set, only process messages from that guild
    if (this.guildId && msg.guild_id !== this.guildId) return;

    const channelMessage: ChannelMessage = {
      id: `discord-${++messageCounter}`,
      role: "user",
      text: msg.content,
      timestamp: msg.timestamp,
      metadata: {
        platform: "discord",
        channelId: msg.channel_id,
        guildId: msg.guild_id,
        messageId: msg.id,
        author: msg.author,
      },
    };

    this.emitMessage(channelMessage).catch((err) => {
      this.emitError(err instanceof Error ? err : new Error(String(err)));
    });
  }

  private handleInteraction(interaction: DiscordInteraction): void {
    // Only handle slash commands (type 2)
    if (interaction.type !== 2) return;

    const user = interaction.member?.user ?? interaction.user;
    const commandName = interaction.data?.name ?? "unknown";
    const options = interaction.data?.options ?? [];
    const optionText = options.map((o) => `${o.name}=${String(o.value)}`).join(" ");
    const text = optionText ? `/${commandName} ${optionText}` : `/${commandName}`;

    const channelMessage: ChannelMessage = {
      id: `discord-cmd-${++messageCounter}`,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
      metadata: {
        platform: "discord",
        channelId: interaction.channel_id,
        guildId: interaction.guild_id,
        interactionId: interaction.id,
        author: user,
        isSlashCommand: true,
        commandName,
        commandOptions: options,
      },
    };

    this.emitMessage(channelMessage).catch((err) => {
      this.emitError(err instanceof Error ? err : new Error(String(err)));
    });
  }
}

// ---------------------------------------------------------------------------
// Stub gateway (placeholder when no real gateway injected)
// ---------------------------------------------------------------------------

function createStubGateway(): DiscordGateway {
  return {
    async connect() { /* no-op */ },
    async disconnect() { /* no-op */ },
    onMessage() { /* no-op */ },
    onInteraction() { /* no-op */ },
    async sendMessage() { /* no-op */ },
    async sendInteractionResponse() { /* no-op */ },
    async addReaction() { /* no-op */ },
  };
}
