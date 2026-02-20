# plugin-memory

Persistent memory plugin for agents with conversation, persistent, and vector memory.

## Installation

```bash
pnpm add @openlinkos/plugin-memory
```

## Overview

`@openlinkos/plugin-memory` provides three types of memory for agents: conversation memory (short-term), persistent memory (long-term key-value), and vector memory (semantic search). Use the plugin to give agents the ability to remember information across interactions.

## `createMemoryPlugin()`

The easiest way to add memory to an agent:

```typescript
import { createMemoryPlugin } from "@openlinkos/plugin-memory";
import { createAgent } from "@openlinkos/agent";
import { createModel } from "@openlinkos/ai";

const model = createModel("openai:gpt-4o");
const memory = createMemoryPlugin({
  conversation: { maxMessages: 50 },
  persistent: { filePath: "./memory.json" },
});

// The plugin provides tools and hooks to the agent
const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant with persistent memory.",
  tools: memory.tools,
  hooks: memory.hooks,
});
```

## Memory Types

### Conversation Memory

Short-term memory that maintains recent message history:

```typescript
import { createConversationMemory } from "@openlinkos/plugin-memory";

const memory = createConversationMemory({
  maxMessages: 50,       // Maximum messages to retain (default: 50)
  maxTotalChars: 100000, // Maximum total characters (default: 100000)
});

memory.addMessage({ role: "user", content: "Hello!" });
memory.addMessage({ role: "assistant", content: "Hi there!" });

const history = memory.getMessages();
```

### Persistent Memory

Long-term key-value storage with optional file persistence:

```typescript
import { createPersistentMemory } from "@openlinkos/plugin-memory";

const memory = createPersistentMemory({
  filePath: "./agent-memory.json", // Optional: persist to disk
});

// Store facts
await memory.put({
  key: "user-name",
  value: "Alice",
  category: "user_facts",
});

// Retrieve
const entry = await memory.get("user-name");

// List by category
const facts = await memory.list(
  (entry) => entry.category === "user_facts",
);
```

#### Memory Categories

| Category | Description |
|----------|-------------|
| `"user_facts"` | Information about the user |
| `"agent_learnings"` | Things the agent has learned |
| `"task_history"` | Records of completed tasks |

### Vector Memory

Semantic similarity search using embeddings:

```typescript
import { createVectorMemory } from "@openlinkos/plugin-memory";

const memory = createVectorMemory({
  embeddingFn: async (text) => {
    // Return an embedding vector for the text
    // Use OpenAI embeddings, local model, etc.
    return [0.1, 0.2, 0.3, /* ... */];
  },
  topK: 5, // Number of results to return
});

// Store entries with automatic embedding
await memory.put({
  key: "fact-1",
  value: "TypeScript was created by Microsoft in 2012.",
});

// Search by semantic similarity
const results = await memory.search("Who created TypeScript?");
for (const result of results) {
  console.log(`${result.entry.value} (score: ${result.score})`);
}
```

## `MemoryStore`

The underlying storage interface. All memory types use this abstraction:

```typescript
interface MemoryStore {
  put(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | undefined>;
  delete(id: string): Promise<boolean>;
  list(filter?: (entry: MemoryEntry) => boolean): Promise<MemoryEntry[]>;
  clear(): Promise<void>;
  size(): Promise<number>;
}
```

## `MemoryEntry`

```typescript
interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category?: MemoryCategory;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

type MemoryCategory = "user_facts" | "agent_learnings" | "task_history";
```

## `ScoredMemoryEntry`

Returned by vector memory search:

```typescript
interface ScoredMemoryEntry {
  entry: MemoryEntry;
  score: number;
}
```

## Configuration Types

### `MemoryPluginConfig`

```typescript
interface MemoryPluginConfig {
  conversation?: ConversationMemoryConfig;
  persistent?: PersistentMemoryConfig;
  vector?: VectorMemoryConfig;
}
```

### `ConversationMemoryConfig`

```typescript
interface ConversationMemoryConfig {
  maxMessages?: number;      // Default: 50
  maxTotalChars?: number;    // Default: 100000
}
```

### `PersistentMemoryConfig`

```typescript
interface PersistentMemoryConfig {
  filePath?: string;  // Path to JSON file for disk persistence
}
```

### `VectorMemoryConfig`

```typescript
interface VectorMemoryConfig {
  embeddingFn: EmbeddingFunction;
  topK?: number;  // Number of search results (default: 5)
}

type EmbeddingFunction = (text: string) => Promise<number[]>;
```

## Utility Functions

### `cosineSimilarity()`

Compute cosine similarity between two vectors:

```typescript
import { cosineSimilarity } from "@openlinkos/plugin-memory";

const similarity = cosineSimilarity([1, 0, 0], [0.9, 0.1, 0]);
// 0.9939...
```
