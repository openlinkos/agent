/**
 * Tests for stripJsonCodeBlock — strips markdown JSON code fences.
 */

import { describe, it, expect } from "vitest";
import { stripJsonCodeBlock } from "../src/adapters/openai-adapter.js";

describe("stripJsonCodeBlock", () => {
  it("strips ```json code fences", () => {
    const input = '```json\n{"name": "Alice", "age": 30}\n```';
    expect(stripJsonCodeBlock(input)).toBe('{"name": "Alice", "age": 30}');
  });

  it("strips ``` code fences without language tag", () => {
    const input = '```\n{"name": "Bob"}\n```';
    expect(stripJsonCodeBlock(input)).toBe('{"name": "Bob"}');
  });

  it("strips fences with extra whitespace", () => {
    const input = '```json  \n  {"key": "value"}  \n  ```  ';
    expect(stripJsonCodeBlock(input)).toBe('{"key": "value"}');
  });

  it("handles multiline JSON in code block", () => {
    const input = '```json\n{\n  "name": "Alice",\n  "age": 30\n}\n```';
    expect(stripJsonCodeBlock(input)).toBe('{\n  "name": "Alice",\n  "age": 30\n}');
  });

  it("returns plain JSON unchanged", () => {
    const input = '{"name": "Alice"}';
    expect(stripJsonCodeBlock(input)).toBe('{"name": "Alice"}');
  });

  it("returns non-JSON text unchanged", () => {
    const input = "Hello, world!";
    expect(stripJsonCodeBlock(input)).toBe("Hello, world!");
  });

  it("handles empty input", () => {
    expect(stripJsonCodeBlock("")).toBe("");
  });

  it("does not strip if code block is not the whole input", () => {
    const input = 'Here is the JSON:\n```json\n{"key": "value"}\n```\nDone.';
    expect(stripJsonCodeBlock(input)).toBe(input);
  });
});
