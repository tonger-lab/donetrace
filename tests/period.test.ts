import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { dateKey, weekKey, weekRange, yesterdayKey } from "../src/lib/period";

describe("周期键（周一为一周起点）", () => {
  it("日期键", () => {
    expect(dateKey(dayjs("2026-10-23"))).toBe("2026-10-23");
    expect(yesterdayKey()).toBe(dateKey(dayjs().subtract(1, "day")));
  });

  it("周键", () => {
    expect(weekKey(dayjs("2026-10-23"))).toBe("2026-W43"); // 周五
    expect(weekKey(dayjs("2026-01-01"))).toBe("2026-W01"); // 周四
    expect(weekKey(dayjs("2026-12-31"))).toBe("2026-W53"); // 2026 有 53 周
    expect(weekKey(dayjs("2027-01-01"))).toBe("2026-W53"); // 跨年
  });

  it("周范围", () => {
    const { start, end } = weekRange("2026-W53");
    expect(start.format("YYYY-MM-DD")).toBe("2026-12-28");
    expect(end.format("YYYY-MM-DD")).toBe("2027-01-03");
    expect(() => weekRange("2026-53")).toThrow();
    expect(() => weekRange("bad")).toThrow();
  });
});
