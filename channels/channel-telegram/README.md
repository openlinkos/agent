# @openlinkos/channel-telegram

Platform channel adapter — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

Connects an OpenLinkOS agent to the Telegram Bot API, enabling your agent to receive and respond to messages from Telegram users via long polling or webhooks.

## Installation

```
pnpm add @openlinkos/channel-telegram @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createAgent } from "@openlinkos/agent";
import { createTelegramChannel } from "@openlinkos/channel-telegram";

const agent = createAgent({ /* ... */ });

const channel = createTelegramChannel({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  webhookUrl: "https://example.com/webhook/telegram", // optional
  agent,
});

await channel.start();
```

## Features

- Connects agents to Telegram via the Telegram Bot API
- Supports both long polling and webhook modes
- Handles text messages, commands, and inline queries
- Automatic message formatting and reply threading
- Graceful start/stop lifecycle management

## License

[MIT](../../LICENSE)
