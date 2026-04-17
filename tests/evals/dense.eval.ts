/**
 * Eval: dense technical transcript
 * Expect: model surfaces 1-2 domain-specific terms, not common words.
 */
import { describe, it, expect } from "bun:test";

const SYSTEM_PROMPT = `You are a vocabulary detector with a high threshold. From the passage below, identify 0, 1, or at most 2 terms that a general adult audience would genuinely not know without domain expertise. Target: domain jargon, rare technical vocabulary, niche acronyms, proper nouns requiring context. Do NOT flag: common academic words, everyday vocabulary, anything a high school graduate would recognize without effort. For each term you identify, provide a 1-2 sentence definition tailored to how it is used in this passage. Return a JSON array of objects: [{"term": "...", "definition": "..."}]. If nothing qualifies, return [].`;

const DENSE_TRANSCRIPT = `The Federal Reserve's decision to implement quantitative tightening comes as the FOMC weighs persistent inflationary pressures against the risk of triggering a credit crunch. The yield curve inversion, now in its fourteenth month, historically precedes recessions by six to eighteen months. Meanwhile, mortgage-backed securities spreads have widened significantly as primary dealers reduce their balance sheet exposure.`;

// This test requires OPENAI_API_KEY to be set; skip gracefully if not.
const apiKey = process.env.OPENAI_API_KEY;

const describeIf = apiKey ? describe : describe.skip;
describeIf("dense technical transcript eval", () => {
  it("detects 1-2 domain-specific terms and not common words", async () => {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: DENSE_TRANSCRIPT },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    const json = await resp.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const items: { term: string; definition: string }[] = JSON.parse(cleaned);

    // Should return an array
    expect(Array.isArray(items)).toBe(true);

    // Should catch 1-2 terms, not 0 (there are clearly domain terms here)
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.length).toBeLessThanOrEqual(2);

    // Common words should NOT be flagged
    const terms = items.map((i) => i.term.toLowerCase());
    const bannedCommonWords = ["interest", "bank", "rate", "economy", "market", "risk"];
    for (const banned of bannedCommonWords) {
      expect(terms.some((t) => t === banned)).toBe(false);
    }

    // Each item must have a non-empty definition
    for (const item of items) {
      expect(item.definition.length).toBeGreaterThan(10);
    }
  });
});
