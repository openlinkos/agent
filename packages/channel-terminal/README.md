# @openlinkos/channel-terminal

Terminal/stdin channel adapter with ANSI colored output — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/channel-terminal` provides a readline-based channel for interactive terminal sessions. It renders agent responses with ANSI colors and handles user input from stdin.

## Installation

```bash
pnpm add @openlinkos/channel-terminal
```

## Usage

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

## Features

- **ANSI colors** — Colored output for user and agent messages
- **Readline integration** — Standard readline-based input handling
- **Reconnect support** — Inherits `BaseChannel` reconnection logic

## Documentation

See the [full documentation](https://openlinkos.com) for guides and API reference.

## License

[MIT](../../LICENSE)
