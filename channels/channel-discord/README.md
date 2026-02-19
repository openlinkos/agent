# @openlinkos/channel-discord

Platform channel adapter — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

Connects an OpenLinkOS agent to the Discord API, enabling your agent to interact with Discord users through slash commands, message threads, and rich embed responses.

## Installation

```
pnpm add @openlinkos/channel-discord @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createAgent } from "@openlinkos/agent";
import { createDiscordChannel } from "@openlinkos/channel-discord";

const agent = createAgent({ /* ... */ });

const channel = createDiscordChannel({
  botToken: process.env.DISCORD_BOT_TOKEN!,
  guildId: process.env.DISCORD_GUILD_ID, // optional: restrict to one server
  agent,
});

await channel.start();
```

## Features

- Connects agents to Discord via the Discord Gateway and REST APIs
- Supports slash commands for structured user interactions
- Rich embed responses for formatted, visually appealing messages
- Thread support for organized, contextual conversations
- Graceful start/stop lifecycle management

## License

[MIT](../../LICENSE)
