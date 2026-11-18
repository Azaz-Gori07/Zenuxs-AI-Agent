import { describe, expect, it } from "vitest"
import {
  AgentModeSchema,
  PermissionActionSchema,
  ProviderConfigSchema,
  SessionSchema,
  ToolDefinitionSchema,
} from "./index"

describe("Zenuxs shared schemas", () => {
  it("validates agent modes including parity modes", () => {
    expect(AgentModeSchema.safeParse("plan").success).toBe(true)
    expect(AgentModeSchema.safeParse("guarded").success).toBe(true)
    expect(AgentModeSchema.safeParse("nonsense").success).toBe(false)
  })

  it("validates permission decisions", () => {
    expect(PermissionActionSchema.safeParse("allow").success).toBe(true)
    expect(PermissionActionSchema.safeParse("ask").success).toBe(true)
    expect(PermissionActionSchema.safeParse("deny").success).toBe(true)
  })

  it("requires identity fields on sessions", () => {
    const result = SessionSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      modelId: "fake",
      providerId: "fake",
      agentId: "agent",
      mode: "act",
    })
    expect(result.success).toBe(true)
  })

  it("validates tool and provider definitions", () => {
    expect(
      ToolDefinitionSchema.safeParse({
        id: "read",
        description: "Read a file",
        parameters: [],
      }).success,
    ).toBe(true)
    expect(
      ProviderConfigSchema.safeParse({
        id: "fake",
        name: "Fake",
        auth: { type: "apiKey", apiKey: "test" },
        models: [{ id: "fake-1", name: "Fake 1" }],
      }).success,
    ).toBe(true)
  })
})
