/**
 * Tests for long-term persistent memory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPersistentMemory } from "../src/persistent.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

describe("createPersistentMemory", () => {
  it("should start empty", async () => {
    const mem = createPersistentMemory();
    const val = await mem.get("nonexistent");
    expect(val).toBeUndefined();
  });

  it("should set and get values", async () => {
    const mem = createPersistentMemory();
    await mem.set("theme", "dark", "user_facts");
    const val = await mem.get("theme");
    expect(val).toBe("dark");
  });

  it("should overwrite existing values", async () => {
    const mem = createPersistentMemory();
    await mem.set("theme", "dark", "user_facts");
    await mem.set("theme", "light", "user_facts");
    expect(await mem.get("theme")).toBe("light");
  });

  it("should delete values", async () => {
    const mem = createPersistentMemory();
    await mem.set("key", "value", "user_facts");
    const deleted = await mem.delete("key");
    expect(deleted).toBe(true);
    expect(await mem.get("key")).toBeUndefined();
  });

  it("should return false when deleting nonexistent key", async () => {
    const mem = createPersistentMemory();
    const deleted = await mem.delete("nonexistent");
    expect(deleted).toBe(false);
  });

  it("should clear all entries", async () => {
    const mem = createPersistentMemory();
    await mem.set("a", "1", "user_facts");
    await mem.set("b", "2", "agent_learnings");
    await mem.clear();
    expect(await mem.get("a")).toBeUndefined();
    expect(await mem.get("b")).toBeUndefined();
    const list = await mem.list();
    expect(list).toHaveLength(0);
  });

  it("should list all entries", async () => {
    const mem = createPersistentMemory();
    await mem.set("a", "1", "user_facts");
    await mem.set("b", "2", "agent_learnings");
    await mem.set("c", "3", "user_facts");

    const all = await mem.list();
    expect(all).toHaveLength(3);
  });

  it("should list entries filtered by category", async () => {
    const mem = createPersistentMemory();
    await mem.set("a", "1", "user_facts");
    await mem.set("b", "2", "agent_learnings");
    await mem.set("c", "3", "user_facts");

    const userFacts = await mem.list("user_facts");
    expect(userFacts).toHaveLength(2);
    expect(userFacts.every((e) => e.metadata.category === "user_facts")).toBe(true);

    const learnings = await mem.list("agent_learnings");
    expect(learnings).toHaveLength(1);
    expect(learnings[0].content).toBe("2");
  });

  it("should return MemoryEntry objects from list", async () => {
    const mem = createPersistentMemory();
    await mem.set("key", "value", "task_history");

    const entries = await mem.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("key");
    expect(entries[0].content).toBe("value");
    expect(entries[0].metadata.category).toBe("task_history");
    expect(entries[0].createdAt).toBeTypeOf("number");
  });
});

describe("TTL support", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return value before TTL expires", async () => {
    const mem = createPersistentMemory();
    await mem.set("temp", "data", "user_facts", 5000);

    vi.advanceTimersByTime(4000);
    expect(await mem.get("temp")).toBe("data");
  });

  it("should return undefined after TTL expires", async () => {
    const mem = createPersistentMemory();
    await mem.set("temp", "data", "user_facts", 5000);

    vi.advanceTimersByTime(6000);
    expect(await mem.get("temp")).toBeUndefined();
  });

  it("should prune expired entries from list", async () => {
    const mem = createPersistentMemory();
    await mem.set("persist", "forever", "user_facts");
    await mem.set("temp", "gone-soon", "user_facts", 1000);

    vi.advanceTimersByTime(2000);
    const entries = await mem.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("persist");
  });
});

describe("File persistence", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(tmpdir(), "memory-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should save and load from file", async () => {
    const filePath = path.join(tmpDir, "mem.json");

    const mem1 = createPersistentMemory({ filePath });
    await mem1.set("key1", "value1", "user_facts");
    await mem1.set("key2", "value2", "agent_learnings");
    await mem1.save();

    // Verify file exists
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    expect(Object.keys(data)).toHaveLength(2);

    // Load into a new instance
    const mem2 = createPersistentMemory({ filePath });
    await mem2.load();
    expect(await mem2.get("key1")).toBe("value1");
    expect(await mem2.get("key2")).toBe("value2");
  });

  it("should not fail load when file does not exist", async () => {
    const filePath = path.join(tmpDir, "nonexistent.json");
    const mem = createPersistentMemory({ filePath });
    await expect(mem.load()).resolves.toBeUndefined();
  });

  it("should skip expired entries on load", async () => {
    const filePath = path.join(tmpDir, "ttl.json");

    // Manually write a file with an already-expired entry
    const expired = {
      gone: {
        key: "gone",
        value: "expired",
        category: "user_facts",
        createdAt: Date.now() - 10000,
        ttl: 1000,
      },
      alive: {
        key: "alive",
        value: "still-here",
        category: "user_facts",
        createdAt: Date.now(),
      },
    };
    await fs.writeFile(filePath, JSON.stringify(expired), "utf-8");

    const mem = createPersistentMemory({ filePath });
    await mem.load();
    expect(await mem.get("gone")).toBeUndefined();
    expect(await mem.get("alive")).toBe("still-here");
  });

  it("should create directories when saving", async () => {
    const filePath = path.join(tmpDir, "nested", "dir", "mem.json");
    const mem = createPersistentMemory({ filePath });
    await mem.set("key", "val", "user_facts");
    await mem.save();

    const raw = await fs.readFile(filePath, "utf-8");
    expect(JSON.parse(raw)).toHaveProperty("key");
  });

  it("should be no-op for save/load when no filePath", async () => {
    const mem = createPersistentMemory();
    await expect(mem.save()).resolves.toBeUndefined();
    await expect(mem.load()).resolves.toBeUndefined();
  });
});
