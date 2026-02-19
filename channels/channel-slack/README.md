# @openlinkos/channel-slack

Platform channel adapter — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

Connects an OpenLinkOS agent to the Slack API, enabling your agent to respond to messages and interactions within Slack workspaces using Block Kit layouts and event subscriptions.

## Installation

```
pnpm add @openlinkos/channel-slack @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createAgent } from "@openlinkos/agent";
import { createSlackChannel } from "@openlinkos/channel-slack";

const agent = createAgent({ /* ... */ });

const channel = createSlackChannel({
  botToken: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  appToken: process.env.SLACK_APP_TOKEN, // optional: for Socket Mode
  agent,
});

await channel.start();
```

## Features

- Connects agents to Slack via the Slack Bolt framework
- Supports Block Kit for rich, interactive message layouts
- Handles event subscriptions for real-time message delivery
- Socket Mode support for development without a public URL
- Graceful start/stop lifecycle management

## License

[MIT](../../LICENSE)
