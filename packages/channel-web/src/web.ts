/**
 * WebChannel — HTTP + WebSocket + SSE channel adapter.
 *
 * Uses Node.js built-in http module. Provides:
 * - POST /message  — send a message, get a response
 * - GET  /sse      — Server-Sent Events stream
 * - WebSocket      — full-duplex message exchange (on upgrade)
 */

import * as http from "node:http";
import { BaseChannel } from "@openlinkos/channel";
import type { ChannelMessage, BaseChannelConfig } from "@openlinkos/channel";
import { WebSocketServer } from "./ws.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WebChannelConfig extends BaseChannelConfig {
  /** Port to listen on. Default: 3000 */
  port?: number;
  /** Host to bind to. Default: "0.0.0.0" */
  host?: string;
  /** Optional CORS origin. Default: "*" */
  corsOrigin?: string;
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

let messageCounter = 0;

export class WebChannel extends BaseChannel {
  private server: http.Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private sseClients = new Set<http.ServerResponse>();
  private readonly port: number;
  private readonly host: string;
  private readonly corsOrigin: string;

  constructor(config: WebChannelConfig) {
    super(config);
    this.port = config.port ?? 3000;
    this.host = config.host ?? "0.0.0.0";
    this.corsOrigin = config.corsOrigin ?? "*";
  }

  protected async doConnect(): Promise<void> {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.wsServer = new WebSocketServer(this.server);

    this.wsServer.onConnection((client) => {
      client.onMessage(async (data) => {
        try {
          const parsed = JSON.parse(data) as { text?: string; metadata?: Record<string, unknown> };
          const message: ChannelMessage = {
            id: `web-ws-${++messageCounter}`,
            role: "user",
            text: parsed.text ?? data,
            timestamp: new Date().toISOString(),
            metadata: { platform: "web", transport: "websocket", ...parsed.metadata },
          };
          await this.emitMessage(message);
        } catch {
          // If not JSON, treat as plain text
          const message: ChannelMessage = {
            id: `web-ws-${++messageCounter}`,
            role: "user",
            text: data,
            timestamp: new Date().toISOString(),
            metadata: { platform: "web", transport: "websocket" },
          };
          await this.emitMessage(message);
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.on("error", reject);
      this.server!.listen(this.port, this.host, () => resolve());
    });
  }

  protected async doDisconnect(): Promise<void> {
    // Close SSE connections
    for (const res of this.sseClients) {
      res.end();
    }
    this.sseClients.clear();

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
  }

  async send(message: ChannelMessage): Promise<void> {
    const payload = JSON.stringify(message);

    // Broadcast to SSE clients
    for (const res of this.sseClients) {
      res.write(`data: ${payload}\n\n`);
    }

    // Broadcast to WebSocket clients
    if (this.wsServer) {
      this.wsServer.broadcast(payload);
    }
  }

  /** Send an SSE event to all connected SSE clients. */
  sendSSE(event: string, data: string): void {
    for (const res of this.sseClients) {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    }
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", this.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? "/";

    if (req.method === "POST" && url === "/message") {
      this.handlePostMessage(req, res);
    } else if (req.method === "GET" && url === "/sse") {
      this.handleSSE(req, res);
    } else if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", channel: this.name }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  }

  private handlePostMessage(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body) as { text?: string; metadata?: Record<string, unknown> };
        if (!parsed.text) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'text' field" }));
          return;
        }

        const message: ChannelMessage = {
          id: `web-http-${++messageCounter}`,
          role: "user",
          text: parsed.text,
          timestamp: new Date().toISOString(),
          metadata: { platform: "web", transport: "http", ...parsed.metadata },
        };

        this.emitMessage(message)
          .then(() => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "received", id: message.id }));
          })
          .catch((err) => {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(err) }));
          });
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  }

  private handleSSE(_req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    this.sseClients.add(res);

    res.on("close", () => {
      this.sseClients.delete(res);
    });
  }
}
