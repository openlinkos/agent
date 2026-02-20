/**
 * Tests for semantic vector memory.
 */

import { describe, it, expect, vi } from "vitest";
import { createVectorMemory, cosineSimilarity } from "../src/vector.js";
import type { EmbeddingFunction } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock embedding function
// ---------------------------------------------------------------------------

/**
 * A simple deterministic embedding for testing.
 * Maps each character to a dimension, producing a bag-of-chars vector of
 * length 26 (a=0, b=1, ..., z=25).
 */
function charEmbedding(text: string): number[] {
  const vec = new Array<number>(26).fill(0);
  for (const ch of text.toLowerCase()) {
    const idx = ch.charCodeAt(0) - 97; // 'a' = 0
    if (idx >= 0 && idx < 26) {
      vec[idx] += 1;
    }
  }
  return vec;
}

const mockEmbed: EmbeddingFunction = async (text) => charEmbedding(text);

// ---------------------------------------------------------------------------
// cosineSimilarity unit tests
// ---------------------------------------------------------------------------

describe("cosineSimilarity", () => {
  it("should return 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("should return 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);
  });

  it("should return -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("should return 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("should return 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("should handle normalized vectors", () => {
    const a = [0.6, 0.8];
    const b = [0.6, 0.8];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// createVectorMemory tests
// ---------------------------------------------------------------------------

describe("createVectorMemory", () => {
  it("should start with size 0", () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    expect(mem.size).toBe(0);
  });

  it("should add entries and increment size", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    const entry = await mem.add("hello world");

    expect(mem.size).toBe(1);
    expect(entry.content).toBe("hello world");
    expect(entry.id).toMatch(/^vec_/);
    expect(entry.createdAt).toBeTypeOf("number");
  });

  it("should add entries with metadata", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    const entry = await mem.add("test", { category: "fact" });

    expect(entry.metadata).toEqual({ category: "fact" });
  });

  it("should call embed function on add", async () => {
    const embed = vi.fn(mockEmbed);
    const mem = createVectorMemory({ embed });

    await mem.add("hello");
    expect(embed).toHaveBeenCalledWith("hello");
  });

  it("should search and return scored entries", async () => {
    const mem = createVectorMemory({ embed: mockEmbed, defaultTopK: 2 });

    await mem.add("aaa"); // heavily weighted on 'a'
    await mem.add("bbb"); // heavily weighted on 'b'
    await mem.add("aab"); // similar to 'aaa'

    const results = await mem.search("aaa");
    expect(results).toHaveLength(2);
    // The most similar to "aaa" should be "aaa" itself, then "aab"
    expect(results[0].content).toBe("aaa");
    expect(results[0].score).toBeCloseTo(1, 5);
    expect(results[1].content).toBe("aab");
  });

  it("should respect topK parameter in search", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });

    await mem.add("alpha");
    await mem.add("beta");
    await mem.add("gamma");

    const results = await mem.search("alpha", 1);
    expect(results).toHaveLength(1);
  });

  it("should use defaultTopK when topK not provided", async () => {
    const mem = createVectorMemory({ embed: mockEmbed, defaultTopK: 2 });

    await mem.add("one");
    await mem.add("two");
    await mem.add("three");

    const results = await mem.search("one");
    expect(results).toHaveLength(2);
  });

  it("should return empty array when searching empty store", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    const results = await mem.search("anything");
    expect(results).toEqual([]);
  });

  it("should delete entries by ID", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    const entry = await mem.add("to-delete");
    expect(mem.size).toBe(1);

    const deleted = await mem.delete(entry.id);
    expect(deleted).toBe(true);
    expect(mem.size).toBe(0);
  });

  it("should return false when deleting nonexistent ID", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    const deleted = await mem.delete("nonexistent");
    expect(deleted).toBe(false);
  });

  it("should clear all entries", async () => {
    const mem = createVectorMemory({ embed: mockEmbed });
    await mem.add("one");
    await mem.add("two");
    expect(mem.size).toBe(2);

    await mem.clear();
    expect(mem.size).toBe(0);
  });

  it("should rank results by similarity score descending", async () => {
    const mem = createVectorMemory({ embed: mockEmbed, defaultTopK: 10 });

    await mem.add("xyz");
    await mem.add("aaa");
    await mem.add("aab");
    await mem.add("abc");

    const results = await mem.search("aaa");
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
    expect(results[0].content).toBe("aaa");
  });

  it("should call embed function on search", async () => {
    const embed = vi.fn(mockEmbed);
    const mem = createVectorMemory({ embed });

    await mem.add("data");
    await mem.search("query");

    // Once for add, once for search
    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenLastCalledWith("query");
  });
});
