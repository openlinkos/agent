/**
 * Minimal WebSocket server implementation using Node.js built-in APIs.
 *
 * Handles the WebSocket upgrade handshake and basic frame parsing
 * for text messages. This keeps the package dependency-free while
 * supporting full-duplex communication.
 */

import * as http from "node:http";
import * as crypto from "node:crypto";

// ---------------------------------------------------------------------------
// WebSocket client
// ---------------------------------------------------------------------------

export interface WebSocketClient {
  /** Register a handler for incoming text messages. */
  onMessage(handler: (data: string) => void): void;
  /** Register a handler for connection close. */
  onClose(handler: () => void): void;
  /** Send a text message to this client. */
  send(data: string): void;
  /** Close the connection. */
  close(): void;
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

type ConnectionHandler = (client: WebSocketClient) => void;

const WS_GUID = "258EAFA5-E914-47DA-95CA-5AB5DC11E65B";

export class WebSocketServer {
  private clients = new Set<WebSocketClient>();
  private connectionHandlers: ConnectionHandler[] = [];

  constructor(server: http.Server) {
    server.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  /** Register a handler for new WebSocket connections. */
  onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  /** Broadcast a text message to all connected clients. */
  broadcast(data: string): void {
    for (const client of this.clients) {
      client.send(data);
    }
  }

  /** Close all client connections. */
  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
  }

  private handleUpgrade(
    req: http.IncomingMessage,
    socket: import("node:stream").Duplex,
    _head: Buffer,
  ): void {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash("sha1")
      .update(key + WS_GUID)
      .digest("base64");

    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n");

    socket.write(headers);

    const messageHandlers: Array<(data: string) => void> = [];
    const closeHandlers: Array<() => void> = [];

    const client: WebSocketClient = {
      onMessage(handler) {
        messageHandlers.push(handler);
      },
      onClose(handler) {
        closeHandlers.push(handler);
      },
      send(data: string) {
        const payload = Buffer.from(data, "utf-8");
        const len = payload.length;
        let frame: Buffer;

        if (len < 126) {
          frame = Buffer.alloc(2 + len);
          frame[0] = 0x81; // FIN + text opcode
          frame[1] = len;
          payload.copy(frame, 2);
        } else if (len < 65536) {
          frame = Buffer.alloc(4 + len);
          frame[0] = 0x81;
          frame[1] = 126;
          frame.writeUInt16BE(len, 2);
          payload.copy(frame, 4);
        } else {
          frame = Buffer.alloc(10 + len);
          frame[0] = 0x81;
          frame[1] = 127;
          frame.writeBigUInt64BE(BigInt(len), 2);
          payload.copy(frame, 10);
        }

        socket.write(frame);
      },
      close() {
        // Send close frame
        const closeFrame = Buffer.alloc(2);
        closeFrame[0] = 0x88; // FIN + close opcode
        closeFrame[1] = 0;
        socket.write(closeFrame);
        socket.end();
      },
    };

    this.clients.add(client);

    socket.on("data", (buf: Buffer) => {
      // Parse WebSocket frame
      if (buf.length < 2) return;

      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let payloadLen = buf[1] & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buf.length < 4) return;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buf.length < 10) return;
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
      }

      if (opcode === 0x08) {
        // Close frame
        for (const h of closeHandlers) h();
        this.clients.delete(client);
        socket.end();
        return;
      }

      if (opcode !== 0x01) return; // Only handle text frames

      let payload: Buffer;
      if (masked) {
        const mask = buf.subarray(offset, offset + 4);
        offset += 4;
        payload = buf.subarray(offset, offset + payloadLen);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      } else {
        payload = buf.subarray(offset, offset + payloadLen);
      }

      const text = payload.toString("utf-8");
      for (const h of messageHandlers) h(text);
    });

    socket.on("close", () => {
      for (const h of closeHandlers) h();
      this.clients.delete(client);
    });

    socket.on("error", () => {
      this.clients.delete(client);
    });

    for (const handler of this.connectionHandlers) {
      handler(client);
    }
  }
}
