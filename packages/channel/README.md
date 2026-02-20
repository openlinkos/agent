# @openlinkos/channel

Core channel interface for unified message I/O — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/channel` defines the base abstractions for message channels: a unified interface for sending and receiving messages across different platforms (terminal, web, Slack, Discord, etc.).

## Installation

```bash
pnpm add @openlinkos/channel
```

## Usage

```typescript
import { BaseChannel, ChannelManager } from "@openlinkos/channel";

// Create a channel manager to coordinate multiple channels
const manager = new ChannelManager();
manager.addChannel(myChannel);

await manager.connectAll();
```

## Features

- **Unified interface** — `Channel` interface for all message adapters
- **Base channel** — `BaseChannel` with built-in reconnection and error handling
- **Channel manager** — Coordinate multiple channels simultaneously
- **Type-safe messages** — `ChannelMessage` with role, content, and metadata

## Adapters

- [`@openlinkos/channel-terminal`](../channel-terminal) — Terminal/stdin
- [`@openlinkos/channel-web`](../channel-web) — HTTP/WebSocket/SSE
- [`@openlinkos/channel-slack`](../../channels/channel-slack) — Slack
- [`@openlinkos/channel-discord`](../../channels/channel-discord) — Discord
- [`@openlinkos/channel-telegram`](../../channels/channel-telegram) — Telegram

## Documentation

See the [full documentation](https://openlinkos.com) for guides and API reference.

## License

[MIT](../../LICENSE)
