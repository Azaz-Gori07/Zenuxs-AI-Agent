---
description: Development guidance for @cline/shared — system prompts, tools, and types.
globs: "src/**/*.ts"
alwaysApply: true
---

# @cline/shared Development Guidance

## System Prompts (OpenCode Integration)

The `prompt/system-part.ts` module provides OpenCode‑style structured system prompts:

- **`SystemPart`**: A structured system prompt part (`type: "text"`, `text`, `cache?`, `metadata?`).
- **`buildSystemPrompt(base, parts?)`**: Compose a base prompt string with additional `SystemPart[]` parts.
- **`normalizeSystemInput(input)`**: Normalize a `string | SystemPart[]` to `SystemPart[]`.
- **`wrapSystemUpdate(text)`**: Produce a stable `<system-update>` XML block for chronological system updates on non‑native routes.
- **`systemUpdate(text)`**: Create a `AgentSystemUpdatePart` for use inside messages.

### Usage

```ts
import { buildSystemPrompt, systemText, wrapSystemUpdate } from "@cline/shared";

// Compose prompt with parts
const prompt = buildSystemPrompt("Base instructions", [
  systemText("Additional context", "ephemeral"),
]);

// Chronological system update (mid-conversation)
const updateBlock = wrapSystemUpdate("New instructions for the model");
```

## Enhanced Tool System (OpenCode Integration)

The `tools/definition.ts` and `tools/dispatch.ts` modules provide OpenCode‑style tool definitions and runtime dispatch.

### `tools/definition.ts`

- **`makeTool(config)`**: Create a typed tool with typed `execute` handler.
- **`makeDynamic(config)`**: Create a tool from a JSON Schema (for MCP, plugins).
- **`toDefinitions(tools)`**: Convert a `EnhancedTools` record to `ToolDefinitionShape[]`.
- **`fromAgentTool(name, tool)`**: Wrap an existing `AgentTool` into `EnhancedTool`.

### `tools/dispatch.ts`

- **`ToolRuntime.dispatch(tools, call, context)`**: Execute a single tool call with input validation and error handling.
- **`ToolRuntime.dispatchAll(tools, calls, context, parallel?)`**: Execute multiple tool calls sequentially or in parallel.

```ts
import { makeTool, ToolRuntime } from "@cline/shared";

const weather = makeTool({
  description: "Get weather for a city",
  inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  execute: async ({ city }) => fetchWeather(city),
});

const result = await ToolRuntime.dispatch(
  { get_weather: weather },
  { toolCallId: "call_1", toolName: "get_weather", input: { city: "London" } },
  context,
);
```

## System‑Update Message Parts

`AgentSystemUpdatePart` (`type: "system-update"`) is a message content part for chronological system instructions. It is:

1. Handled by `ai-sdk.ts` which renders it as a `<system-update>` wrapped text block.
2. Recognized by `AgentMessagePart` union.
3. Compatible with future native chronological system message support (e.g. Anthropic Claude Opus 4.8).

## `AgentModelRequest.systemParts`

The `systemParts?: readonly SystemPart[]` field on `AgentModelRequest` carries additional structured system parts. These are composed with `systemPrompt` at request time by `agent-runtime.ts`.

## Key Types

- `SystemPart` — structured system prompt part with optional cache/metadata.
- `AgentSystemUpdatePart` — chronological system update content block.
- `EnhancedTool` — typed tool interface with `execute`, `toModelOutput`, `toStructuredOutput`.
- `ToolSettlement` — the result of a tool execution (structured value + optional output content).
- `DispatchResult` — settlement + events array.
- `ToolChoice` — control model tool selection (`"auto" | "none" | "required" | "tool"`).
