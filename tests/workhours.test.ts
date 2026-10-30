import { describe, expect, it } from "vitest";
import { completionPercent, formatWorkHours } from "../src/lib/workhours";

describe("formatWorkHours（中文，1 分 = 1 分钟，8 小时/天）", () => {
  it("100 分 = 1 小时 40 分", () => {
    expect(formatWorkHours(100, "zh-CN")).toBe("1小时40分");
  });

  it("整天", () => {
    expect(formatWorkHours(480, "zh-CN")).toBe("1天");
    expect(formatWorkHours(960, "zh-CN")).toBe("2天");
  });

  it("天 + 小时 + 分", () => {
    expect(formatWorkHours(480 + 120 + 5, "zh-CN")).toBe("1天2小时5分");
  });

  it("零值省略", () => {
    expect(formatWorkHours(0, "zh-CN")).toBe("0分");
    expect(formatWorkHours(5, "zh-CN")).toBe("5分");
    expect(formatWorkHours(120, "zh-CN")).toBe("2小时");
  });

  it("四舍五入到分钟", () => {
    expect(formatWorkHours(4.6, "zh-CN")).toBe("5分");
    expect(formatWorkHours(4.4, "zh-CN")).toBe("4分");
  });
});

describe("formatWorkHours（English, 1 pt = 1 min, 8 h/day）", () => {
  it("100 pts = 1h 40min", () => {
    expect(formatWorkHours(100, "en")).toBe("1h 40min");
  });

  it("whole days", () => {
    expect(formatWorkHours(480, "en")).toBe("1d");
    expect(formatWorkHours(960, "en")).toBe("2d");
  });

  it("days + hours + minutes", () => {
    expect(formatWorkHours(480 + 120 + 5, "en")).toBe("1d 2h 5min");
  });

  it("zero-value segments omitted", () => {
    expect(formatWorkHours(0, "en")).toBe("0min");
    expect(formatWorkHours(5, "en")).toBe("5min");
    expect(formatWorkHours(120, "en")).toBe("2h");
  });
});

describe("completionPercent（日标准 8 小时 / 周标准 40 小时）", () => {
  it("日标准", () => {
    expect(completionPercent(480, "day")).toBe(100);
    expect(completionPercent(960, "day")).toBe(200); // 16 小时 → 200%
    expect(completionPercent(240, "day")).toBe(50);
    expect(completionPercent(0, "day")).toBe(0);
  });

  it("周标准", () => {
    expect(completionPercent(2400, "week")).toBe(100);
    expect(completionPercent(1200, "week")).toBe(50);
    expect(completionPercent(4800, "week")).toBe(200);
  });

  it("四舍五入", () => {
    expect(completionPercent(100, "day")).toBe(21); // 100/480 ≈ 20.8%
  });
});
