# @openlinkos/channel-dingtalk

Platform channel adapter — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

Connects an OpenLinkOS agent to the DingTalk Open Platform, enabling your agent to send and receive messages with support for interactive card messages in DingTalk group chats and conversations.

## Installation

```
pnpm add @openlinkos/channel-dingtalk @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createAgent } from "@openlinkos/agent";
import { createDingTalkChannel } from "@openlinkos/channel-dingtalk";

const agent = createAgent({ /* ... */ });

const channel = createDingTalkChannel({
  accessToken: process.env.DINGTALK_ACCESS_TOKEN!,
  secret: process.env.DINGTALK_SECRET, // optional: for request signing
  agent,
});

await channel.start();
```

## Features

- Connects agents to DingTalk via the DingTalk Open Platform API
- Supports interactive card messages for rich, actionable UI experiences
- Handles group chat and direct message conversations
- Request signing support for secure webhook verification
- Graceful start/stop lifecycle management

## License

[MIT](../../LICENSE)
