/**
 * Automated tests for robust JSON tool argument parser.
 * Covers: valid JSON, malformed JSON, truncated streams, nested objects,
 * arrays, unicode, multiline content, escaped quotes, very large payloads,
 * markdown-wrapped JSON, and common LLM formatting mistakes.
 */

import { describe, it, expect } from "vitest";
import { parseToolArguments } from "./agent-runtime";

describe("Tool Argument JSON Parser", () => {
  describe("Valid JSON", () => {
    it("parses simple object", () => {
      const result = parseToolArguments('{"filePath": "test.txt", "content": "hello"}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ filePath: "test.txt", content: "hello" });
      }
    });

    it("parses nested object", () => {
      const input = '{"config": {"nested": {"value": 42}}, "array": [1, 2, 3]}';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          config: { nested: { value: 42 } },
          array: [1, 2, 3],
        });
      }
    });

    it("parses array", () => {
      const result = parseToolArguments('[{"id": 1}, {"id": 2}]');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });
  });

  describe("Markdown-wrapped JSON", () => {
    it("strips ```json code fences", () => {
      const input = '```json\n{"filePath": "test.txt", "content": "hello"}\n```';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ filePath: "test.txt", content: "hello" });
      }
    });

    it("strips ``` code fences without language", () => {
      const input = '```\n{"filePath": "test.txt"}\n```';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ filePath: "test.txt" });
      }
    });
  });

  describe("Trailing commas", () => {
    it("removes trailing comma before }", () => {
      const input = '{"filePath": "test.txt", "content": "hello",}';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ filePath: "test.txt", content: "hello" });
      }
    });

    it("removes trailing comma before ]", () => {
      const input = '[1, 2, 3,]';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });
  });

  describe("Single quotes", () => {
    it("converts single quotes to double quotes for keys", () => {
      const input = "{'filePath': 'test.txt', 'content': 'hello'}";
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ filePath: "test.txt", content: "hello" });
      }
    });
  });

  describe("Empty arguments", () => {
    it("parses empty string as empty object", () => {
      const result = parseToolArguments("");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    it("parses whitespace-only string as empty object", () => {
      const result = parseToolArguments("   \n\t  ");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    it("parses empty object {}", () => {
      const result = parseToolArguments("{}");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    it("parses tool_name() or () as empty object", () => {
      expect(parseToolArguments("run_commands()")).toEqual({ ok: true, value: {} });
      expect(parseToolArguments("()")).toEqual({ ok: true, value: {} });
    });
  });

  describe("Unicode and special characters", () => {
    it("parses unicode strings", () => {
      const input = '{"message": "Hello 世界 🌍", "emoji": "🚀"}';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          message: "Hello 世界 🌍",
          emoji: "🚀",
        });
      }
    });

    it("parses escaped characters", () => {
      const input = '{"text": "line1\\nline2\\ttab", "quote": "He said \\"hello\\""}';
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          text: "line1\nline2\ttab",
          quote: 'He said "hello"',
        });
      }
    });
  });

  describe("Multiline strings", () => {
    it("parses strings with newlines", () => {
      const input = JSON.stringify({
        content: "line1\nline2\nline3",
      });
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.value as any).content).toBe("line1\nline2\nline3");
      }
    });
  });

  describe("Large payloads", () => {
    it("parses large content strings", () => {
      const largeContent = "x".repeat(10000);
      const input = `{"content": "${largeContent}"}`;
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.value as any).content).toBe(largeContent);
      }
    });
  });

  describe("Malformed JSON and Non-standard LLM Formats", () => {
    it("recovers unquoted object keys", () => {
      const result = parseToolArguments('{command: "ls -la"}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ command: "ls -la" });
      }
    });

    it("recovers function call syntax run_commands(ls -la)", () => {
      const result = parseToolArguments("run_commands(ls -la)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("ls -la");
      }
    });

    it("recovers python-style keyword arguments command='ls -la'", () => {
      const result = parseToolArguments("command='ls -la'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ command: "ls -la" });
      }
    });

    it("rejects unclosed braces in objects", () => {
      const result = parseToolArguments('{"filePath": "test.txt"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("could not be parsed as JSON");
      }
    });
  });

  describe("Real-world LLM outputs", () => {
    it("handles write_file with realistic content", () => {
      const input = `{"filePath": "index.html", "content": "<!DOCTYPE html>\\n<html>\\n<head>\\n  <title>Test</title>\\n</head>\\n</html>"}`;
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.value as any).filePath).toBe("index.html");
        expect((result.value as any).content).toContain("<!DOCTYPE html>");
      }
    });

    it("handles edit with oldString and newString", () => {
      const input = `{"filePath": "app.ts", "oldString": "const x = 1;", "newString": "const x = 2;"}`;
      const result = parseToolArguments(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.value as any).filePath).toBe("app.ts");
        expect((result.value as any).oldString).toBe("const x = 1;");
        expect((result.value as any).newString).toBe("const x = 2;");
      }
    });
  });
});
