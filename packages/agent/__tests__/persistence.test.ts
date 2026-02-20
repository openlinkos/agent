/**
 * Tests for conversation persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryStore, FileStore } from "../src/persistence.js";
import type { ConversationData } from "../src/persistence.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeConversationData(sessionId: string): ConversationData {
  return {
    sessionId,
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:01:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// InMemoryStore
// ---------------------------------------------------------------------------

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it("should save and load conversation data", async () => {
    const data = makeConversationData("session-1");
    await store.save(data);

    const loaded = await store.load("session-1");
    expect(loaded).toEqual(data);
  });

  it("should return null for non-existent session", async () => {
    const result = await store.load("nonexistent");
    expect(result).toBeNull();
  });

  it("should list stored session IDs", async () => {
    await store.save(makeConversationData("s1"));
    await store.save(makeConversationData("s2"));
    await store.save(makeConversationData("s3"));

    const ids = await store.list();
    expect(ids).toHaveLength(3);
    expect(ids).toContain("s1");
    expect(ids).toContain("s2");
    expect(ids).toContain("s3");
  });

  it("should delete a session", async () => {
    await store.save(makeConversationData("to-delete"));
    expect(await store.load("to-delete")).not.toBeNull();

    await store.delete("to-delete");
    expect(await store.load("to-delete")).toBeNull();
  });

  it("should overwrite existing data on save", async () => {
    const data1 = makeConversationData("s1");
    await store.save(data1);

    const data2 = {
      ...data1,
      messages: [{ role: "system" as const, content: "Updated" }],
      updatedAt: "2025-01-02T00:00:00.000Z",
    };
    await store.save(data2);

    const loaded = await store.load("s1");
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe("Updated");
  });

  it("should return independent copies (not references)", async () => {
    const data = makeConversationData("s1");
    await store.save(data);

    const loaded1 = await store.load("s1");
    const loaded2 = await store.load("s1");

    expect(loaded1).toEqual(loaded2);
    expect(loaded1).not.toBe(loaded2);
    expect(loaded1!.messages).not.toBe(loaded2!.messages);
  });

  it("should handle deleting non-existent session without error", async () => {
    await expect(store.delete("nonexistent")).resolves.toBeUndefined();
  });

  it("should return empty list when no sessions exist", async () => {
    const ids = await store.list();
    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FileStore
// ---------------------------------------------------------------------------

describe("FileStore", () => {
  let tmpDir: string;
  let store: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-test-"));
    store = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should save and load conversation data", async () => {
    const data = makeConversationData("session-1");
    await store.save(data);

    const loaded = await store.load("session-1");
    expect(loaded).toEqual(data);
  });

  it("should return null for non-existent session", async () => {
    const result = await store.load("nonexistent");
    expect(result).toBeNull();
  });

  it("should list stored session IDs", async () => {
    await store.save(makeConversationData("s1"));
    await store.save(makeConversationData("s2"));

    const ids = await store.list();
    expect(ids).toHaveLength(2);
    expect(ids).toContain("s1");
    expect(ids).toContain("s2");
  });

  it("should delete a session file", async () => {
    await store.save(makeConversationData("to-delete"));
    expect(await store.load("to-delete")).not.toBeNull();

    await store.delete("to-delete");
    expect(await store.load("to-delete")).toBeNull();
  });

  it("should create directory if it does not exist", async () => {
    const nestedDir = path.join(tmpDir, "nested", "deep");
    const nestedStore = new FileStore(nestedDir);

    await nestedStore.save(makeConversationData("s1"));
    const loaded = await nestedStore.load("s1");
    expect(loaded).not.toBeNull();
  });

  it("should handle deleting non-existent session without error", async () => {
    await expect(store.delete("nonexistent")).resolves.toBeUndefined();
  });

  it("should return empty list for non-existent directory", async () => {
    const noStore = new FileStore(path.join(tmpDir, "nope"));
    const ids = await noStore.list();
    expect(ids).toEqual([]);
  });

  it("should sanitize session IDs to prevent path traversal", async () => {
    const data = makeConversationData("../../../etc/passwd");
    await store.save(data);

    // Should be saved with sanitized name
    const files = await fs.readdir(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toContain("..");
    expect(files[0]).toMatch(/\.json$/);
  });

  it("should overwrite existing data on save", async () => {
    const data1 = makeConversationData("s1");
    await store.save(data1);

    const data2 = {
      ...data1,
      messages: [{ role: "system" as const, content: "Updated" }],
    };
    await store.save(data2);

    const loaded = await store.load("s1");
    expect(loaded?.messages).toHaveLength(1);
  });
});
