import { describe, it, expect } from "bun:test";
import { parseTimedText, selectBestTrack } from "../utils/timedtext";
import type { TimedTextTrack } from "../utils/timedtext";

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
  <text start="0.5" dur="2.0">Hello world</text>
  <text start="2.8" dur="1.5">This is a test</text>
  <text start="5.0" dur="3.0">Of the timedtext parser</text>
</transcript>`;

const ENTITY_XML = `<transcript>
  <text start="1.0" dur="2.0">It&#39;s a &amp; test &lt;cool&gt;</text>
</transcript>`;

describe("parseTimedText", () => {
  it("parses well-formed XML into captions", () => {
    const captions = parseTimedText(SAMPLE_XML);
    expect(captions).toHaveLength(3);
    expect(captions[0]).toEqual({ text: "Hello world", startTime: 0.5 });
    expect(captions[2].startTime).toBe(5.0);
  });

  it("decodes HTML entities", () => {
    const captions = parseTimedText(ENTITY_XML);
    expect(captions[0].text).toBe("It's a & test <cool>");
  });

  it("returns [] for empty input", () => {
    expect(parseTimedText("")).toEqual([]);
    expect(parseTimedText("   ")).toEqual([]);
  });

  it("returns [] for malformed XML", () => {
    expect(parseTimedText("<not valid xml <<")).toEqual([]);
  });

  it("skips nodes with missing start attribute", () => {
    const xml = `<transcript><text dur="1.0">no start</text><text start="1.0" dur="1.0">ok</text></transcript>`;
    const captions = parseTimedText(xml);
    expect(captions).toHaveLength(1);
    expect(captions[0].text).toBe("ok");
  });
});

describe("selectBestTrack", () => {
  const makeTrack = (lang: string, isAuto: boolean): TimedTextTrack => ({
    url: `https://example.com/${lang}${isAuto ? "-auto" : ""}`,
    lang,
    isAuto,
    xml: SAMPLE_XML,
  });

  it("returns null for empty array", () => {
    expect(selectBestTrack([])).toBeNull();
  });

  it("prefers manual captions in browser language", () => {
    const tracks = [makeTrack("en", true), makeTrack("en", false), makeTrack("es", false)];
    const best = selectBestTrack(tracks);
    expect(best?.isAuto).toBe(false);
    expect(best?.lang).toBe("en");
  });

  it("falls back to auto if no manual in browser language", () => {
    const tracks = [makeTrack("es", false), makeTrack("en", true)];
    const best = selectBestTrack(tracks);
    expect(best?.isAuto).toBe(true);
    expect(best?.lang).toBe("en");
  });

  it("falls back to any manual if no browser-language match", () => {
    const tracks = [makeTrack("fr", true), makeTrack("es", false)];
    const best = selectBestTrack(tracks);
    expect(best?.isAuto).toBe(false);
  });

  it("falls back to first available if no other match", () => {
    const tracks = [makeTrack("zh", true), makeTrack("ja", true)];
    const best = selectBestTrack(tracks);
    expect(best).toBe(tracks[0]);
  });
});
