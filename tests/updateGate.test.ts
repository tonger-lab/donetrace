import { describe, expect, it } from "vitest";
import { shouldAutoCheck } from "../src/lib/updateGate";

describe("启动自动检查的日闸门（每天最多一次）", () => {
  it("从未检查过 → 需要检查", () => {
    expect(shouldAutoCheck(null, "2026-11-18")).toBe(true);
  });

  it("今天已检查 → 不再检查", () => {
    expect(shouldAutoCheck("2026-11-18", "2026-11-18")).toBe(false);
  });

  it("上次检查是昨天/更早 → 需要检查", () => {
    expect(shouldAutoCheck("2026-11-17", "2026-11-18")).toBe(true);
    expect(shouldAutoCheck("2026-11-01", "2026-11-18")).toBe(true);
  });

  it("异常值（未来日期/空串）→ 需要检查", () => {
    expect(shouldAutoCheck("2026-12-01", "2026-11-18")).toBe(true);
    expect(shouldAutoCheck("", "2026-11-18")).toBe(true);
  });
});
