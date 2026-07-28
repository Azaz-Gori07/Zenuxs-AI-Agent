import { describe, it, expect } from "vitest"
import { EventStore, InMemoryEventStorage } from "@zenuxs/engine"

describe("EventStore", () => {
  it("should append and retrieve events", async () => {
    const store = new EventStore()
    await store.append({
      id: crypto.randomUUID(), sessionId: "session-1", sequence: 0,
      type: "session_created", payload: {}, timestamp: new Date(),
    })
    const events = await store.getEvents("session-1")
    expect(events).toHaveLength(1)
  })

  it("should replay events", async () => {
    const store = new EventStore()
    for (let i = 0; i < 3; i++) {
      await store.append({
        id: crypto.randomUUID(), sessionId: "session-1", sequence: i,
        type: "message_added", payload: { seq: i }, timestamp: new Date(),
      })
    }
    const events: any[] = []
    for await (const event of store.replay("session-1")) {
      events.push(event)
    }
    expect(events).toHaveLength(3)
  })

  it("should project state from events", async () => {
    const store = new EventStore()
    const sessionId = crypto.randomUUID()
    await store.append({
      id: crypto.randomUUID(), sessionId, sequence: 0,
      type: "session_created", payload: {}, timestamp: new Date(),
    })
    await store.append({
      id: crypto.randomUUID(), sessionId, sequence: 1,
      type: "message_added", payload: { count: 1 }, timestamp: new Date(),
    })
    const state = await store.getProjectedState(sessionId, (events) => ({
      messageCount: events.filter((e) => e.type === "message_added").length,
    }))
    expect(state.messageCount).toBe(1)
  })
})