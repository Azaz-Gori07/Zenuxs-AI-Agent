import { describe, it, expect } from "vitest"
import { PermissionEvaluator, createModeBehavior } from "@zenuxs/engine"

describe("PermissionEvaluator", () => {
  it("should allow all by default", async () => {
    const evaluator = new PermissionEvaluator()
    const result = await evaluator.evaluate({ permission: "read", pattern: "read" })
    expect(result.action).toBe("ask")
  })

  it("should evaluate allow rules", async () => {
    const evaluator = new PermissionEvaluator()
    evaluator.addRule({ permission: "read", pattern: "read", action: "allow" })
    const result = await evaluator.evaluate({ permission: "read", pattern: "read" })
    expect(result.action).toBe("allow")
  })

  it("should evaluate deny rules", async () => {
    const evaluator = new PermissionEvaluator()
    evaluator.addRule({ permission: "shell", pattern: "shell", action: "deny" })
    const result = await evaluator.evaluate({ permission: "shell", pattern: "shell" })
    expect(result.action).toBe("deny")
  })

  it("should support wildcard patterns", async () => {
    const evaluator = new PermissionEvaluator()
    evaluator.addRule({ permission: "mcp", pattern: "mcp:*", action: "allow" })
    const result = await evaluator.evaluate({ permission: "mcp", pattern: "mcp:my-server:tool" })
    expect(result.action).toBe("allow")
  })

  it("should merge rulesets", () => {
    const evaluator = new PermissionEvaluator()
    const merged = evaluator.merge([
      [{ permission: "read", pattern: "read", action: "allow" }],
      [{ permission: "write", pattern: "write", action: "deny" }],
    ])
    expect(merged).toHaveLength(2)
  })
})

describe("createModeBehavior", () => {
  it("should create act mode", () => {
    const mode = createModeBehavior("act")
    expect(mode.mode).toBe("act")
    expect(mode.canEditFiles).toBe(true)
    expect(mode.canRunCommands).toBe(true)
    expect(mode.requiresApproval).toBe(true)
  })

  it("should create ask mode with restrictions", () => {
    const mode = createModeBehavior("ask")
    expect(mode.mode).toBe("ask")
    expect(mode.canEditFiles).toBe(false)
    expect(mode.canRunCommands).toBe(false)
    expect(mode.canSpawnSubagents).toBe(false)
  })

  it("should create yolo mode without approval", () => {
    const mode = createModeBehavior("yolo")
    expect(mode.requiresApproval).toBe(false)
    expect(mode.autoApproveTools).toContain("*")
  })

  it("should allow overrides", () => {
    const mode = createModeBehavior("act", { requiresApproval: false })
    expect(mode.requiresApproval).toBe(false)
  })
})