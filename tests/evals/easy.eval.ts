/**
 * Eval: easy/everyday transcript
 * Expect: model returns [] — nothing domain-specific.
 */
import { describe, it, expect } from "bun:test";

const SYSTEM_PROMPT = `You are a vocabulary detector with a high threshold. From the passage below, identify 0, 1, or at most 2 terms that a general adult audience would genuinely not know without domain expertise. Target: domain jargon, rare technical vocabulary, niche acronyms, proper nouns requiring context. Do NOT flag: common academic words, everyday vocabulary, anything a high school graduate would recognize without effort. For each term you identify, provide a 1-2 sentence definition tailored to how it is used in this passage. Return a JSON array of objects: [{"term": "...", "definition": "..."}]. If nothing qualifies, return [].`;

const EASY_TRANSCRIPT = `Today we're going to talk about how to make a great cup of coffee at home. First, start with fresh beans and grind them just before brewing. The water temperature should be around 200 degrees Fahrenheit — just below boiling. Use a clean filter and pour slowly in a circular motion.`;

const apiKey = process.env.OPENAI_API_KEY;

const describeIf = apiKey ? describe : describe.skip;
describeIf("easy everyday transcript eval", () => {
  it("returns [] for everyday vocabulary — nothing to surface", async () => {
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
          { role: "user", content: EASY_TRANSCRIPT },
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
    // High threshold means common coffee/cooking vocab should not be flagged
    expect(items.length).toBe(0);
  });
});
