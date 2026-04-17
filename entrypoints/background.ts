/**
 * Background service worker.
 *
 * Receives messages from the content script over a long-lived port
 * (chrome.runtime.connect). The open port keeps the MV3 service worker alive
 * past the 30-second idle timeout.
 *
 * Message flow:
 *   content → SW: { type: "detect", chunk, context }
 *   content → SW: { type: "lookup", term, context, requestId }
 *   SW → content: { type: "card", requestId, term, definition, isAuto }
 *   SW → content: { type: "error", requestId, term, message }
 *   SW → content: { type: "no_key" }
 */

import type { MessageToSW, MessageToContent } from "../utils/messages";

export default defineBackground(() => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "yt-context") return;

    port.onMessage.addListener(async (msg: MessageToSW) => {
      if (msg.type === "detect") {
        await handleDetect(port, msg.chunk, msg.context);
      } else if (msg.type === "lookup") {
        await handleLookup(port, msg.term, msg.context, msg.requestId);
      } else if (msg.type === "simplify") {
        await handleSimplify(port, msg.term, msg.definition, msg.context, msg.requestId);
      }
      // "resync" is informational — content script re-sends state after reconnect
    });
  });
});

async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get("anthropicKey");
  return result.anthropicKey ?? null;
}

async function handleDetect(
  port: chrome.runtime.Port,
  chunk: string,
  context: string
): Promise<void> {
  const key = await getApiKey();
  if (!key) {
    send(port, { type: "no_key" });
    return;
  }

  const system = `You are a vocabulary detector with a high threshold. From the passage below, identify 0, 1, or at most 2 terms that a general adult audience would genuinely not know without domain expertise. Target: domain jargon, rare technical vocabulary, niche acronyms, proper nouns requiring context. Do NOT flag: common academic words, everyday vocabulary, anything a high school graduate would recognize without effort. For each term you identify, provide a 1-2 sentence definition tailored to how it is used in this passage. Return a JSON array of objects: [{"term": "...", "definition": "..."}]. If nothing qualifies, return [].`;

  let raw: string;
  try {
    raw = await callClaude(key, system, chunk, 8000);
  } catch (err: unknown) {
    // Detection errors are silent — no card shown, try again next interval
    console.warn("[yt-context] detect error:", err);
    return;
  }

  let items: { term: string; definition: string }[] = [];
  try {
    // Strip markdown code fences if model wraps in ```json ... ```
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    items = JSON.parse(cleaned);
    if (!Array.isArray(items)) items = [];
  } catch {
    // Bad JSON from model — skip silently
    return;
  }

  for (const item of items.slice(0, 2)) {
    if (!item.term || !item.definition) continue;
    const requestId = crypto.randomUUID();
    send(port, {
      type: "card",
      requestId,
      term: item.term,
      definition: item.definition,
      isAuto: true,
    });
  }
}

async function handleLookup(
  port: chrome.runtime.Port,
  term: string,
  context: string,
  requestId: string
): Promise<void> {
  const key = await getApiKey();
  if (!key) {
    send(port, { type: "no_key" });
    return;
  }

  const system = `You are a concise explainer. Define the given term in 1-2 sentences, tailoring the explanation to how the term is used in the video excerpt provided.`;
  const userMsg = `Term: ${term}\n\nVideo context (recent transcript):\n${context}`;

  let definition: string;
  try {
    definition = await callClaude(key, system, userMsg, 8000);
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes("429")
        ? "API limit hit — try again in a moment."
        : "Lookup failed — check your connection and try again.";
    send(port, { type: "error", requestId, term, message });
    return;
  }

  send(port, { type: "card", requestId, term, definition: definition.trim(), isAuto: false });
}

async function handleSimplify(
  port: chrome.runtime.Port,
  term: string,
  definition: string,
  context: string,
  requestId: string
): Promise<void> {
  const key = await getApiKey();
  if (!key) {
    send(port, { type: "no_key" });
    return;
  }

  const system = `You are a friendly explainer for general audiences. Take the given term and its existing definition and rewrite it in simpler, everyday language — as if explaining to someone with no background in the subject. Use a short analogy if it helps. Keep it to 1-3 short sentences.`;
  const userMsg = `Term: ${term}\n\nExisting definition: ${definition}\n\nVideo context:\n${context}`;

  let simplified: string;
  try {
    simplified = await callClaude(key, system, userMsg, 8000);
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes("429")
        ? "API limit hit — try again in a moment."
        : "Simplification failed — check your connection and try again.";
    send(port, { type: "error", requestId, term, message });
    return;
  }

  send(port, { type: "card", requestId, term, definition: simplified.trim(), isAuto: false });
}

async function callClaude(
  apiKey: string,
  system: string,
  userContent: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 429) throw new Error("429");
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const json = await resp.json();
  const content = json.content?.[0]?.text;
  if (!content) throw new Error("empty response");
  return content;
}

function send(port: chrome.runtime.Port, msg: MessageToContent): void {
  try {
    port.postMessage(msg);
  } catch {
    // Port may have been closed — content script will reconnect
  }
}
