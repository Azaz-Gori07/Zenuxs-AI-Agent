import { describe, it, expect } from "vitest"
import { SessionManager, InMemoryStore } from "@zenuxs/engine"

describe("SessionManager", () => {
  it("should create a session", async () => {
    const manager = new SessionManager()
    const session = await manager.create({
      modelId: "test-model",
      providerId: "test-provider",
      agentId: "act",
      mode: "act",
    })
    expect(session.id).toBeTruthy()
    expect(session.status).toBe("active")
    expect(session.mode).toBe("act")
  })

  it("should use InMemoryStore by default", async () => {
    const manager = new SessionManager()
    const session = await manager.create({
      modelId: "test", providerId: "test", agentId: "act", mode: "act",
    })
    const retrieved = await manager.store.get(session.id)
    expect(retrieved).toBeTruthy()
    expect(retrieved!.id).toBe(session.id)
  })

  it("should resume a session", async () => {
    const manager = new SessionManager()
    const session = await manager.create({
      modelId: "test", providerId: "test", agentId: "act", mode: "act",
    })
    const resumed = await manager.resume(session.id)
    expect(resumed).toBeTruthy()
    expect(resumed!.id).toBe(session.id)
    expect(resumed!.status).toBe("active")
  })

  it("should complete a session", async () => {
    const manager = new SessionManager()
    const session = await manager.create({
      modelId: "test", providerId: "test", agentId: "act", mode: "act",
    })
    await manager.complete(session.id)
    const completed = await manager.store.get(session.id)
    expect(completed!.status).toBe("completed")
  })
})