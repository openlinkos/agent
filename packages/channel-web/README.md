# @openlinkos/channel-web

HTTP/WebSocket/SSE channel adapter for web-based agent communication — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/channel-web` enables agents to communicate over HTTP, WebSocket, and Server-Sent Events. Deploy agents as web services or integrate with existing web applications.

## Installation

```bash
pnpm add @openlinkos/channel-web
```

## Usage

```typescript
import { WebChannel } from "@openlinkos/channel-web";

const channel = new WebChannel({ port: 3000, cors: true });

channel.on("message", async (message) => {
  const response = await agent.run(message.content);
  await channel.send({ role: "assistant", content: response.text });
});

await channel.connect();
// POST http://localhost:3000/message with { "content": "Hello!" }
```

## Features

- **HTTP endpoints** — RESTful message API
- **WebSocket support** — Full-duplex real-time communication
- **SSE streaming** — Server-Sent Events for streaming responses
- **CORS support** — Configurable cross-origin settings

## Documentation

See the [full documentation](https://openlinkos.com) for guides and API reference.

## License

[MIT](../../LICENSE)
