# @openlinkos/channel-feishu

Platform channel adapter — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

Connects an OpenLinkOS agent to the Feishu (Lark) Open Platform, enabling your agent to send and receive messages with support for interactive card messages and event subscriptions.

## Installation

```
pnpm add @openlinkos/channel-feishu @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createAgent } from "@openlinkos/agent";
import { createFeishuChannel } from "@openlinkos/channel-feishu";

const agent = createAgent({ /* ... */ });

const channel = createFeishuChannel({
  appId: process.env.FEISHU_APP_ID!,
  appSecret: process.env.FEISHU_APP_SECRET!,
  verificationToken: process.env.FEISHU_VERIFICATION_TOKEN, // optional
  agent,
});

await channel.start();
```

## Features

- Connects agents to Feishu and Lark via the Open Platform API
- Supports interactive card messages for rich UI experiences
- Handles event subscriptions for real-time message delivery
- Group chat and direct message support
- Graceful start/stop lifecycle management

## License

[MIT](../../LICENSE)
