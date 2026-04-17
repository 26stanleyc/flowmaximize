import { describe, it, expect } from "bun:test";
import { hasEnoughNewWords, countWords, isDuplicate, markSeen } from "../utils/detection";

describe("countWords", () => {
  it("counts words in normal sentences", () => {
    expect(countWords("hello world foo")).toBe(3);
  });

  it("handles multiple spaces", () => {
    expect(countWords("hello   world")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("hasEnoughNewWords", () => {
  it("returns true when delta meets threshold", () => {
    expect(hasEnoughNewWords(0, 15)).toBe(true);
    expect(hasEnoughNewWords(100, 115)).toBe(true);
  });

  it("returns false when delta is below threshold", () => {
    expect(hasEnoughNewWords(0, 14)).toBe(false);
    expect(hasEnoughNewWords(100, 114)).toBe(false);
  });

  it("uses custom threshold", () => {
    expect(hasEnoughNewWords(0, 5, 5)).toBe(true);
    expect(hasEnoughNewWords(0, 4, 5)).toBe(false);
  });

  it("returns false when counts are equal", () => {
    expect(hasEnoughNewWords(50, 50)).toBe(false);
  });
});

describe("isDuplicate / markSeen", () => {
  it("returns false for unseen term", () => {
    const seen = new Set<string>();
    expect(isDuplicate(seen, "Quantitative Easing")).toBe(false);
  });

  it("returns true after markSeen", () => {
    const seen = new Set<string>();
    markSeen(seen, "Quantitative Easing");
    expect(isDuplicate(seen, "Quantitative Easing")).toBe(true);
  });

  it("is case-insensitive", () => {
    const seen = new Set<string>();
    markSeen(seen, "MRNA");
    expect(isDuplicate(seen, "mrna")).toBe(true);
    expect(isDuplicate(seen, "mRNA")).toBe(true);
  });

  it("handles leading/trailing whitespace", () => {
    const seen = new Set<string>();
    markSeen(seen, "  term  ");
    expect(isDuplicate(seen, "term")).toBe(true);
    expect(isDuplicate(seen, "  term  ")).toBe(true);
  });
});
