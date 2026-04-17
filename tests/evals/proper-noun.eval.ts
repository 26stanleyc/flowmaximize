/**
 * Eval: transcript with a proper noun requiring context
 * Expect: model flags the proper noun (e.g. "Bretton Woods") and explains it.
 */
import { describe, it, expect } from "bun:test";

const SYSTEM_PROMPT = `You are a vocabulary detector with a high threshold. From the passage below, identify 0, 1, or at most 2 terms that a general adult audience would genuinely not know without domain expertise. Target: domain jargon, rare technical vocabulary, niche acronyms, proper nouns requiring context. Do NOT flag: common academic words, everyday vocabulary, anything a high school graduate would recognize without effort. For each term you identify, provide a 1-2 sentence definition tailored to how it is used in this passage. Return a JSON array of objects: [{"term": "...", "definition": "..."}]. If nothing qualifies, return [].`;

const PROPER_NOUN_TRANSCRIPT = `The collapse of the Bretton Woods system in 1971 marked the end of fixed exchange rates and the beginning of the fiat currency era. Nixon's decision to close the gold window meant that the US dollar was no longer directly convertible to gold, fundamentally changing how global trade was settled.`;

const apiKey = process.env.OPENAI_API_KEY;

const describeIf = apiKey ? describe : describe.skip;
describeIf("proper noun requiring context eval", () => {
  it("flags Bretton Woods or gold window as a term needing explanation", async () => {
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
          { role: "user", content: PROPER_NOUN_TRANSCRIPT },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    const json = await resp.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const items: { term: string; definition: string }[] = JSON.parse(cleaned);

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.length).toBeLessThanOrEqual(2);

    const terms = items.map((i) => i.term.toLowerCase());
    const expectedTerms = ["bretton woods", "gold window", "fiat", "fixed exchange"];
    const caught = expectedTerms.some((t) => terms.some((found) => found.includes(t)));
    expect(caught).toBe(true);

    // Common words should not be flagged
    const bannedCommonWords = ["nixon", "dollar", "gold", "trade"];
    for (const banned of bannedCommonWords) {
      expect(terms.every((t) => t !== banned)).toBe(true);
    }
  });
});
