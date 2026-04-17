import { describe, it, expect } from "bun:test";
import { getTranscriptContext } from "../utils/timedtext";
import type { Caption } from "../utils/timedtext";

const captions: Caption[] = [
  { text: "The Federal Reserve announced", startTime: 0 },
  { text: "a new quantitative tightening policy", startTime: 3 },
  { text: "which will affect bond yields", startTime: 6 },
  { text: "and mortgage backed securities", startTime: 9 },
];

describe("getTranscriptContext", () => {
  it("returns only captions at or before currentTime", () => {
    const ctx = getTranscriptContext(captions, 5);
    expect(ctx).toContain("Federal Reserve");
    expect(ctx).toContain("quantitative tightening");
    expect(ctx).not.toContain("bond yields");
  });

  it("returns all captions when currentTime is past the end", () => {
    const ctx = getTranscriptContext(captions, 999);
    expect(ctx).toContain("mortgage backed securities");
  });

  it("returns empty string when no captions are visible yet", () => {
    expect(getTranscriptContext(captions, -1)).toBe("");
  });

  it("returns empty string for empty captions array", () => {
    expect(getTranscriptContext([], 10)).toBe("");
  });

  it("truncates to maxWords", () => {
    const longCaptions: Caption[] = Array.from({ length: 50 }, (_, i) => ({
      text: "word1 word2 word3 word4 word5",
      startTime: i,
    }));
    const ctx = getTranscriptContext(longCaptions, 100, 20);
    const words = ctx.trim().split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(20);
  });
});
