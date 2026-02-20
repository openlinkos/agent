/**
 * @openlinkos/channel-slack — Slack channel adapter.
 *
 * Supports Events API (HTTP webhook), message formatting with blocks,
 * and thread-based conversations.
 *
 * Uses an injectable `client` for testability — no real Slack API
 * connections in tests.
 */

import * as http from "node:http";
import * as crypto from "node:crypto";
import { BaseChannel } from "@openlinkos/channel";
import type { ChannelMessage, BaseChannelConfig } from "@openlinkos/channel";

// ---------------------------------------------------------------------------
// Slack API types
// ---------------------------------------------------------------------------

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: "plain_text" | "mrkdwn";
    text: string;
  };
  elements?: unknown[];
  [key: string]: unknown;
}

export interface SlackMessageEvent {
  type: "message";
  subtype?: string;
  channel: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
}

export interface SlackEventPayload {
  type: "url_verification" | "event_callback";
  challenge?: string;
  token?: string;
  event?: SlackMessageEvent;
  team_id?: string;
}

// ---------------------------------------------------------------------------
// Slack client interface (for DI / testing)
// ---------------------------------------------------------------------------

export interface SlackClient {
  postMessage(channel: string, text: string, options?: {
    thread_ts?: string;
    blocks?: SlackBlock[];
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface SlackChannelConfig extends BaseChannelConfig {
  /** Slack bot OAuth token (xoxb-...). */
  botToken: string;
  /** Signing secret for verifying incoming requests from Slack. */
  signingSecret: string;
  /** Optional app-level token for Socket Mode. */
  appToken?: string;
  /** Port to listen for Events API webhooks. Default: 3000 */
  port?: number;
  /** Host to bind to. Default: "0.0.0.0" */
  host?: string;
  /** Injected Slack client for testing. */
  client?: SlackClient;
  /** Whether to verify request signatures. Default: true */
  verifySignatures?: boolean;
}

// ---------------------------------------------------------------------------
// Default Slack client (uses HTTPS API)
// ---------------------------------------------------------------------------

function createDefaultClient(botToken: string): SlackClient {
  return {
    async postMessage(channel, text, options) {
      const https = await import("node:https");
      const body: Record<string, unknown> = {
        channel,
        text,
      };
      if (options?.thread_ts) body.thread_ts = options.thread_ts;
      if (options?.blocks) body.blocks = options.blocks;

      const payload = JSON.stringify(body);
      await new Promise<void>((resolve, reject) => {
        const req = https.request(
          {
            hostname: "slack.com",
            path: "/api/chat.postMessage",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${botToken}`,
              "Content-Length": Buffer.byteLength(payload),
            },
          },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => resolve());
          },
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

let messageCounter = 0;

export class SlackChannel extends BaseChannel {
  private readonly signingSecret: string;
  private readonly client: SlackClient;
  private readonly port: number;
  private readonly host: string;
  private readonly verifySignatures: boolean;
  private server: http.Server | null = null;

  constructor(config: SlackChannelConfig) {
    super(config);
    this.signingSecret = config.signingSecret;
    this.client = config.client ?? createDefaultClient(config.botToken);
    this.port = config.port ?? 3000;
    this.host = config.host ?? "0.0.0.0";
    this.verifySignatures = config.verifySignatures ?? true;
  }

  protected async doConnect(): Promise<void> {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    await new Promise<void>((resolve, reject) => {
      this.server!.on("error", reject);
      this.server!.listen(this.port, this.host, () => resolve());
    });
  }

  protected async doDisconnect(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
  }

  async send(message: ChannelMessage): Promise<void> {
    const slackChannel = message.metadata?.channelId as string | undefined;
    if (!slackChannel) {
      throw new Error("Cannot send message without channelId in metadata");
    }

    const options: { thread_ts?: string; blocks?: SlackBlock[] } = {};
    if (message.metadata?.threadTs) {
      options.thread_ts = message.metadata.threadTs as string;
    }
    if (message.metadata?.blocks) {
      options.blocks = message.metadata.blocks as SlackBlock[];
    }

    await this.client.postMessage(slackChannel, message.text, options);
  }

  // -----------------------------------------------------------------------
  // Request handling
  // -----------------------------------------------------------------------

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
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
      // Verify Slack signature
      if (this.verifySignatures) {
        const timestamp = req.headers["x-slack-request-timestamp"] as string;
        const signature = req.headers["x-slack-signature"] as string;

        if (!this.verifySlackSignature(body, timestamp, signature)) {
          res.writeHead(401);
          res.end("Invalid signature");
          return;
        }
      }

      try {
        const payload = JSON.parse(body) as SlackEventPayload;
        this.handleEvent(payload, res);
      } catch {
        res.writeHead(400);
        res.end("Bad Request");
      }
    });
  }

  private handleEvent(payload: SlackEventPayload, res: http.ServerResponse): void {
    // URL verification challenge
    if (payload.type === "url_verification") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ challenge: payload.challenge }));
      return;
    }

    if (payload.type === "event_callback" && payload.event) {
      const event = payload.event;

      // Only handle regular messages (no subtypes like bot_message, etc.)
      if (event.type === "message" && !event.subtype && !event.bot_id && event.user) {
        const channelMessage: ChannelMessage = {
          id: `slack-${++messageCounter}`,
          role: "user",
          text: event.text,
          timestamp: new Date(parseFloat(event.ts) * 1000).toISOString(),
          metadata: {
            platform: "slack",
            channelId: event.channel,
            userId: event.user,
            threadTs: event.thread_ts,
            ts: event.ts,
            teamId: payload.team_id,
          },
        };

        this.emitMessage(channelMessage).catch((err) => {
          this.emitError(err instanceof Error ? err : new Error(String(err)));
        });
      }
    }

    res.writeHead(200);
    res.end("OK");
  }

  private verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
    if (!timestamp || !signature) return false;

    // Check for replay attacks (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 60 * 5) return false;

    const baseString = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac("sha256", this.signingSecret).update(baseString).digest("hex");
    const computedSignature = `v0=${hmac}`;

    const sigBuf = Buffer.from(signature);
    const computedBuf = Buffer.from(computedSignature);

    if (sigBuf.length !== computedBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, computedBuf);
  }
}
