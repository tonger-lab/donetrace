import { describe, expect, it } from "vitest";
import { actualScore, formatScore, VALUE_MULTIPLIERS } from "../src/lib/scoring";

describe("scoring", () => {
  it("价值系数表", () => {
    expect(VALUE_MULTIPLIERS).toEqual({ normal: 1.0, important: 1.5, critical: 2.0 });
  });

  it("实际得分 = 任务分数 × 任务价值系数", () => {
    expect(actualScore(3, "normal")).toBe(3);
    expect(actualScore(3, "important")).toBe(4.5);
    expect(actualScore(4, "critical")).toBe(8);
  });

  it("得分格式化：整数不带小数位，非整数保留 1 位", () => {
    expect(formatScore(4.5)).toBe("4.5");
    expect(formatScore(8)).toBe("8");
    expect(formatScore(0)).toBe("0");
  });
});
