/**
 * Parses YouTube's timedtext XML response into a structured caption array.
 *
 * YouTube timedtext format:
 *   <transcript>
 *     <text start="3.14" dur="2.5">some words here</text>
 *     ...
 *   </transcript>
 */
export interface Caption {
  text: string;
  startTime: number; // seconds
}

export function parseTimedText(xml: string): Caption[] {
  if (!xml || xml.trim() === "") return [];
  try {
    const captions: Caption[] = [];
    // Match <text start="..." ...>content</text> — regex is more portable than
    // DOMParser("text/xml") across browser extensions, workers, and test runtimes.
    const tagRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
    const attrRe = /\bstart="([^"]+)"/;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(xml)) !== null) {
      const attrs = match[1];
      const raw = match[2];
      const startMatch = attrRe.exec(attrs);
      if (!startMatch) continue;
      const start = parseFloat(startMatch[1]);
      if (isNaN(start)) continue;
      // Decode HTML entities YouTube sometimes includes (e.g. &#39; for ')
      const text = raw
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
      if (text.length > 0) {
        captions.push({ text, startTime: start });
      }
    }
    return captions;
  } catch {
    return [];
  }
}

/**
 * Returns the last ~maxWords words from captions that have started at or
 * before `currentTime`. This is the transcript context window sent to the AI.
 */
export function getTranscriptContext(
  captions: Caption[],
  currentTime: number,
  maxWords = 200
): string {
  const visible = captions.filter((c) => c.startTime <= currentTime);
  if (visible.length === 0) return "";

  // Join all visible caption text, then take the last maxWords words
  const allText = visible.map((c) => c.text).join(" ");
  const words = allText.trim().split(/\s+/);
  return words.slice(-maxWords).join(" ");
}

/**
 * Selects the best caption track from multiple timedtext responses.
 * Preference: browser language match > manual > auto-generated > first available.
 */
export interface TimedTextTrack {
  url: string;
  lang: string;       // e.g. "en", "es"
  isAuto: boolean;    // true = auto-generated captions
  xml: string;
}

export function selectBestTrack(tracks: TimedTextTrack[]): TimedTextTrack | null {
  if (tracks.length === 0) return null;

  const userLang = (navigator.language ?? "en").split("-")[0].toLowerCase();

  // 1. Browser language match, manual captions preferred
  const langManual = tracks.find((t) => t.lang === userLang && !t.isAuto);
  if (langManual) return langManual;

  // 2. Browser language match, auto-captions
  const langAuto = tracks.find((t) => t.lang === userLang && t.isAuto);
  if (langAuto) return langAuto;

  // 3. Any manual captions
  const anyManual = tracks.find((t) => !t.isAuto);
  if (anyManual) return anyManual;

  // 4. First available
  return tracks[0];
}
