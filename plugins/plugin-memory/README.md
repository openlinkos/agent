# @openlinkos/plugin-memory

Persistent memory plugin — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/plugin-memory` gives agents long-term memory that persists across conversations. It supports vector storage for semantic retrieval, letting agents remember user preferences, past interactions, and learned knowledge.

## Installation

```bash
pnpm add @openlinkos/plugin-memory @openlinkos/agent
```

## Usage

```typescript
import { createMemoryStore } from "@openlinkos/plugin-memory";

const memory = createMemoryStore({
  backend: "sqlite",
  maxEntries: 10000,
  retentionPolicy: "relevance",
});

// Store a memory
await memory.store("User prefers TypeScript over JavaScript", {
  category: "preferences",
  source: "conversation",
});

// Retrieve relevant memories
const results = await memory.retrieve("What programming language does the user like?");
console.log(results[0].content);
// → "User prefers TypeScript over JavaScript"
```

## Features

- **Vector storage** — Store memories as embeddings for semantic search
- **Semantic retrieval** — Find relevant memories by meaning, not just keywords
- **Multiple backends** — In-memory, SQLite, and PostgreSQL storage options
- **Retention policies** — FIFO, LRU, or relevance-based entry eviction
- **Metadata support** — Tag memories with custom metadata for filtering

## License

[MIT](../../LICENSE)
