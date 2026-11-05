import { describe, expect, it } from "vitest";
import { displayWidth, isValidSoulNote, SOUL_NOTE_MAX_WIDTH } from "../src/lib/soulNotes";

describe("displayWidth", () => {
  it("counts ASCII as 1", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("a b-c")).toBe(5);
  });

  it("counts CJK and emoji as 2", () => {
    expect(displayWidth("中文")).toBe(4);
    expect(displayWidth("a中b")).toBe(4);
    expect(displayWidth("🚀")).toBe(2);
  });

  it("handles empty string", () => {
    expect(displayWidth("")).toBe(0);
  });
});

describe("isValidSoulNote", () => {
  it("rejects empty or whitespace-only", () => {
    expect(isValidSoulNote("")).toBe(false);
    expect(isValidSoulNote("   ")).toBe(false);
  });

  it("accepts exactly 60 widths of English", () => {
    expect(isValidSoulNote("a".repeat(SOUL_NOTE_MAX_WIDTH))).toBe(true);
    expect(isValidSoulNote("a".repeat(SOUL_NOTE_MAX_WIDTH + 1))).toBe(false);
  });

  it("accepts 30 Chinese characters but not 31", () => {
    expect(isValidSoulNote("中".repeat(30))).toBe(true);
    expect(isValidSoulNote("中".repeat(31))).toBe(false);
  });

  it("trims before validating", () => {
    expect(isValidSoulNote("  hi  ")).toBe(true);
  });
});
