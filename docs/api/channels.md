# Channel Packages

Unified message I/O for deploying agents to different platforms.

## Overview

The channel system provides a unified abstraction for connecting agents to various messaging platforms. All channels implement the same `Channel` interface, so switching platforms requires no changes to your agent logic.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Telegram    │     │  Discord    │     │  Terminal    │
│  Channel     │     │  Channel    │     │  Channel     │
└──────┬───────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                   ┌────────┴────────┐
                   │ Channel (base)  │
                   │   interface     │
                   └────────┬────────┘
                            │
                   ┌────────┴────────┐
                   │  Agent / Team   │
                   └─────────────────┘
```

## Installation

::: code-group

```bash [Core]
pnpm add @openlinkos/channel
```

```bash [Terminal]
pnpm add @openlinkos/channel-terminal
```

```bash [Web]
pnpm add @openlinkos/channel-web
```

:::

## `Channel` Interface

All channels implement this interface:

```typescript
interface Channel {
  status: ChannelStatus;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: ChannelMessage): Promise<void>;
  on(event: "message", handler: MessageHandler): void;
  on(event: "error", handler: ErrorHandler): void;
}

type ChannelStatus = "connected" | "disconnected" | "error";
```

## `ChannelMessage`

```typescript
type MessageRole = "user" | "assistant";

interface ChannelMessage {
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}
```

## @openlinkos/channel-terminal

Terminal adapter with ANSI-colored output and readline support:

```typescript
import { TerminalChannel } from "@openlinkos/channel-terminal";

const channel = new TerminalChannel({
  prompt: "You> ",
  agentName: "Assistant",
});

channel.on("message", async (message) => {
  const response = await agent.run(message.content);
  await channel.send({ role: "assistant", content: response.text });
});

await channel.connect();
```

### `TerminalChannelConfig`

```typescript
interface TerminalChannelConfig {
  prompt?: string;
  agentName?: string;
  showTokens?: boolean;
}
```

## @openlinkos/channel-web

HTTP, WebSocket, and SSE channel adapter for web applications:

```typescript
import { WebChannel } from "@openlinkos/channel-web";

const channel = new WebChannel({
  port: 3000,
  cors: true,
});

channel.on("message", async (message) => {
  const response = await agent.run(message.content);
  await channel.send({ role: "assistant", content: response.text });
});

await channel.connect();
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/message` | POST | Send a message to the agent |
| `/sse` | GET | Server-Sent Events stream |
| `/health` | GET | Health check |

### WebSocket Support

```typescript
import { WebSocketServer } from "@openlinkos/channel-web";

const ws = new WebSocketServer({ port: 8080 });

ws.on("connection", (client) => {
  client.on("message", async (data) => {
    const response = await agent.run(data);
    client.send(response.text);
  });
});
```

## `ChannelManager`

Manage multiple channels simultaneously:

```typescript
import { ChannelManager } from "@openlinkos/channel";
import { TerminalChannel } from "@openlinkos/channel-terminal";
import { WebChannel } from "@openlinkos/channel-web";

const manager = new ChannelManager();

manager.register(new TerminalChannel());
manager.register(new WebChannel({ port: 3000 }));

manager.on("message", async (message, channel) => {
  const response = await agent.run(message.content);
  await channel.send({ role: "assistant", content: response.text });
});

await manager.connectAll();
```

## `BaseChannel`

Abstract base class with reconnection and error handling. Extend this to create custom channels:

```typescript
import { BaseChannel } from "@openlinkos/channel";

class MyChannel extends BaseChannel {
  async connect(): Promise<void> {
    // Connect to your platform
  }

  async disconnect(): Promise<void> {
    // Disconnect
  }

  async send(message: ChannelMessage): Promise<void> {
    // Send message to the platform
  }
}
```

## Platform Channels

Additional platform-specific channels are available:

| Package | Platform |
|---------|----------|
| `@openlinkos/channel-telegram` | Telegram |
| `@openlinkos/channel-discord` | Discord |
| `@openlinkos/channel-slack` | Slack |
| `@openlinkos/channel-feishu` | Feishu (Lark) |
| `@openlinkos/channel-dingtalk` | DingTalk |

Each follows the same `Channel` interface and can be registered with `ChannelManager`.
