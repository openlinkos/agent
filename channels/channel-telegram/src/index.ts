/**
 * @openlinkos/channel-telegram — Telegram Bot API channel adapter.
 *
 * Supports webhook and long-polling modes, message parsing,
 * inline keyboards, and command handling.
 */

import * as http from "node:http";
import * as https from "node:https";
import { BaseChannel } from "@openlinkos/channel";
import type { ChannelMessage, BaseChannelConfig } from "@openlinkos/channel";

// ---------------------------------------------------------------------------
// Telegram API types
// ---------------------------------------------------------------------------

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface TelegramChannelConfig extends BaseChannelConfig {
  /** Telegram Bot API token from BotFather. */
  botToken: string;
  /** Webhook URL. If omitted, long polling is used. */
  webhookUrl?: string;
  /** Port for the webhook HTTP server. Default: 8443 */
  webhookPort?: number;
  /** Polling interval in ms. Default: 1000 */
  pollingInterval?: number;
  /**
   * Custom function to call the Telegram API.
   * Useful for testing — allows injecting a mock transport.
   */
  apiCall?: (method: string, body: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Default API caller (uses HTTPS)
// ---------------------------------------------------------------------------

function defaultApiCall(botToken: string): (method: string, body: Record<string, unknown>) => Promise<unknown> {
  return (method, body) => {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = https.request(
        {
          hostname: "api.telegram.org",
          path: `/bot${botToken}/${method}`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  };
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

let messageCounter = 0;

export class TelegramChannel extends BaseChannel {
  private readonly webhookUrl?: string;
  private readonly webhookPort: number;
  private readonly pollingInterval: number;
  private readonly apiCall: (method: string, body: Record<string, unknown>) => Promise<unknown>;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private webhookServer: http.Server | null = null;
  private lastUpdateId = 0;
  private polling = false;

  constructor(config: TelegramChannelConfig) {
    super(config);
    this.webhookUrl = config.webhookUrl;
    this.webhookPort = config.webhookPort ?? 8443;
    this.pollingInterval = config.pollingInterval ?? 1000;
    this.apiCall = config.apiCall ?? defaultApiCall(config.botToken);
  }

  protected async doConnect(): Promise<void> {
    if (this.webhookUrl) {
      await this.startWebhook();
    } else {
      await this.startPolling();
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.polling = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.webhookServer) {
      await new Promise<void>((resolve) => {
        this.webhookServer!.close(() => resolve());
      });
      this.webhookServer = null;
    }
  }

  async send(message: ChannelMessage): Promise<void> {
    const chatId = message.metadata?.chatId;
    if (!chatId) {
      throw new Error("Cannot send message without chatId in metadata");
    }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: message.text,
    };

    // Support inline keyboard
    const replyMarkup = message.metadata?.replyMarkup;
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    // Support parse mode (HTML, Markdown, MarkdownV2)
    const parseMode = message.metadata?.parseMode;
    if (parseMode) {
      body.parse_mode = parseMode;
    }

    await this.apiCall("sendMessage", body);
  }

  /** Call a Telegram Bot API method directly. */
  async callApi(method: string, body: Record<string, unknown>): Promise<unknown> {
    return this.apiCall(method, body);
  }

  // -----------------------------------------------------------------------
  // Polling
  // -----------------------------------------------------------------------

  private async startPolling(): Promise<void> {
    this.polling = true;
    this.poll();
  }

  private poll(): void {
    if (!this.polling) return;

    this.apiCall("getUpdates", {
      offset: this.lastUpdateId + 1,
      timeout: 0,
    })
      .then((response) => {
        const data = response as { ok?: boolean; result?: TelegramUpdate[] };
        if (data.ok && data.result) {
          for (const update of data.result) {
            this.handleUpdate(update);
          }
        }
      })
      .catch((err) => {
        this.emitError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (this.polling) {
          this.pollingTimer = setTimeout(() => this.poll(), this.pollingInterval);
        }
      });
  }

  // -----------------------------------------------------------------------
  // Webhook
  // -----------------------------------------------------------------------

  private async startWebhook(): Promise<void> {
    // Register the webhook with Telegram
    await this.apiCall("setWebhook", { url: this.webhookUrl! });

    this.webhookServer = http.createServer((req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end();
        return;
      }

      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("error", () => {
        res.writeHead(400);
        res.end("Request stream error");
      });
      req.on("end", () => {
        try {
          const update = JSON.parse(body) as TelegramUpdate;
          this.handleUpdate(update);
          res.writeHead(200);
          res.end("OK");
        } catch {
          res.writeHead(400);
          res.end("Bad Request");
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.webhookServer!.on("error", reject);
      this.webhookServer!.listen(this.webhookPort, () => resolve());
    });
  }

  // -----------------------------------------------------------------------
  // Update handling
  // -----------------------------------------------------------------------

  private handleUpdate(update: TelegramUpdate): void {
    if (update.update_id > this.lastUpdateId) {
      this.lastUpdateId = update.update_id;
    }

    if (update.message?.text) {
      const msg = update.message;
      const text = msg.text!;
      const channelMessage: ChannelMessage = {
        id: `telegram-${++messageCounter}`,
        role: "user",
        text,
        timestamp: new Date(msg.date * 1000).toISOString(),
        metadata: {
          platform: "telegram",
          chatId: msg.chat.id,
          chatType: msg.chat.type,
          messageId: msg.message_id,
          from: msg.from,
        },
      };

      this.emitMessage(channelMessage).catch((err) => {
        this.emitError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }
}
