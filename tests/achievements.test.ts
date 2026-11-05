import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_IDS,
  CATEGORY_ORDER,
  achievementIconSrc,
  formatProgressValue,
  progressPercent,
} from "../src/lib/achievements";

describe("formatProgressValue", () => {
  it("formats hours with 1 decimal below 10 and rounds above", () => {
    expect(formatProgressValue("hours", 3.25)).toBe("3.3");
    expect(formatProgressValue("hours", 0.5)).toBe("0.5");
    expect(formatProgressValue("hours", 12.4)).toBe("12");
    expect(formatProgressValue("hours", 499.6)).toBe("500");
  });

  it("avoids showing 10.0 while still locked", () => {
    expect(formatProgressValue("hours", 9.96)).toBe("9.9");
    expect(formatProgressValue("hours", 10)).toBe("10");
  });

  it("formats counts, days and reviews as integers", () => {
    expect(formatProgressValue("count", 87)).toBe("87");
    expect(formatProgressValue("days", 4.9)).toBe("5");
    expect(formatProgressValue("reviews", 6)).toBe("6");
  });

  it("formats score without decimals for integers and 1 decimal otherwise", () => {
    expect(formatProgressValue("score", 456)).toBe("456");
    expect(formatProgressValue("score", 456.5)).toBe("456.5");
  });
});

describe("progressPercent", () => {
  it("computes clamped percentage", () => {
    expect(progressPercent(0, 100)).toBe(0);
    expect(progressPercent(87, 100)).toBe(87);
    expect(progressPercent(200, 100)).toBe(100);
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("CATEGORY_ORDER", () => {
  it("covers all four categories in display order", () => {
    expect(CATEGORY_ORDER).toEqual(["start", "milestone", "habit", "depth"]);
  });
});

describe("achievement icon assets", () => {
  it("has all three state SVGs for every achievement id", () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(27);
    for (const id of ACHIEVEMENT_IDS) {
      expect(
        achievementIconSrc("unlocked", id),
        `missing unlocked icon for ${id}`,
      ).toBeTypeOf("string");
      expect(
        achievementIconSrc("locked-light", id),
        `missing locked-light icon for ${id}`,
      ).toBeTypeOf("string");
      expect(
        achievementIconSrc("locked-dark", id),
        `missing locked-dark icon for ${id}`,
      ).toBeTypeOf("string");
    }
  });
});
