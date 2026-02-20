/**
 * @openlinkos/channel-web — HTTP/WebSocket/SSE channel adapter.
 *
 * Provides a web-based channel with:
 * - POST /message endpoint for sending messages
 * - GET /sse endpoint for Server-Sent Events streaming
 * - WebSocket support for full-duplex communication
 * - GET /health endpoint for health checks
 */

export { WebChannel } from "./web.js";
export type { WebChannelConfig } from "./web.js";
export { WebSocketServer } from "./ws.js";
export type { WebSocketClient } from "./ws.js";
