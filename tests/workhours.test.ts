import { describe, expect, it } from "vitest";
import {
  completionPercent,
  formatWorkHours,
  parseHhmm,
  scheduleStandards,
} from "../src/lib/workhours";

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

describe("自定义工作时间（Pro）：解析与完成度标准", () => {
  it("parseHhmm 严格两位 HH:MM", () => {
    expect(parseHhmm("09:00")).toBe(540);
    expect(parseHhmm("23:59")).toBe(1439);
    expect(parseHhmm("9:00")).toBeNull();
    expect(parseHhmm("24:00")).toBeNull();
    expect(parseHhmm("12:60")).toBeNull();
    expect(parseHhmm("")).toBeNull();
  });

  it("未自定义 → 内置标准（日 8h / 周 40h）", () => {
    expect(scheduleStandards(null)).toEqual({ dayMinutes: 480, weekMinutes: 2400 });
    expect(scheduleStandards(undefined)).toEqual({ dayMinutes: 480, weekMinutes: 2400 });
  });

  it("自定义工作日与起止时间 → 按口径推导", () => {
    // 周末工作者：周六/周日 22:00–23:30 → 日 90 分钟，周 180 分钟
    const s = scheduleStandards({
      workdays: [false, false, false, false, false, true, true],
      start: "22:00",
      end: "23:30",
    });
    expect(s).toEqual({ dayMinutes: 90, weekMinutes: 180 });
    expect(completionPercent(90, "day", s)).toBe(100);
    expect(completionPercent(180, "week", s)).toBe(100);
    expect(completionPercent(45, "day", s)).toBe(50);
  });

  it("自定义周一至周五 9:00–18:00 → 日 9h / 周 45h", () => {
    const s = scheduleStandards({
      workdays: [true, true, true, true, true, false, false],
      start: "09:00",
      end: "18:00",
    });
    expect(s).toEqual({ dayMinutes: 540, weekMinutes: 2700 });
    expect(completionPercent(540, "day", s)).toBe(100);
  });

  it("非法数据回退内置标准", () => {
    // 位数不足
    expect(
      scheduleStandards({ workdays: [true, true], start: "09:00", end: "18:00" }),
    ).toEqual({ dayMinutes: 480, weekMinutes: 2400 });
    // 起止倒挂
    expect(
      scheduleStandards({
        workdays: [true, true, true, true, true, false, false],
        start: "18:00",
        end: "09:00",
      }),
    ).toEqual({ dayMinutes: 480, weekMinutes: 2400 });
    // 全休 → 周标准回退 40h
    expect(
      scheduleStandards({
        workdays: [false, false, false, false, false, false, false],
        start: "09:00",
        end: "18:00",
      }).weekMinutes,
    ).toBe(2400);
  });
});
