import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@cline/core";
import { resolveStatusNoticeLabel, toCompactionJsonEvent } from "./events";

describe("compaction notice surfacing", () => {
  const notice = {
    type: "notice",
    displayRole: "status",
    reason: "auto_compaction",
    message: "",
  } as unknown as AgentEvent;

  it("maps an auto-compaction notice to a CLI JSON event", () => {
    expect(toCompactionJsonEvent(notice)).toEqual({
      type: "compaction",
      reason: "auto_compaction",
      message: "auto-compacting",
    });
  });

  it("gives the notice a visible status label", () => {
    expect(resolveStatusNoticeLabel(notice)).toBe("auto-compacting");
  });

  it("ignores unrelated events", () => {
    expect(toCompactionJsonEvent({ type: "text" } as unknown as AgentEvent)).toBeUndefined();
  });
});
