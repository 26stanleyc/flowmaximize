/**
 * Content script — runs in the YouTube page context.
 *
 * Responsibilities:
 *   1. Inject a page-world script to intercept fetch/XHR for timedtext URLs
 *   2. Receive parsed captions via window.postMessage
 *   3. Open and maintain a long-lived port to the background service worker
 *   4. Run a detection loop (every 10s) gated on video time + new word count
 *   5. Listen for mouseup → manual "Look up" flow
 *   6. Mount the React sidebar
 *   7. Poll location.href for video navigation (SPA resets)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import type { MessageToSW, MessageToContent, TermCard } from "../utils/messages";
import { Sidebar } from "../components/Sidebar";
import { parseTimedText, getTranscriptContext, selectBestTrack } from "../utils/timedtext";
import type { TimedTextTrack, Caption } from "../utils/timedtext";
import { hasEnoughNewWords, countWords, isDuplicate, markSeen } from "../utils/detection";

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  runAt: "document_idle",
  main() {
    watchForNavigation();

    // Check stored enabled state — don't auto-activate unless the user turned it on
    chrome.storage.local.get("sidebarEnabled", (result) => {
      if (result.sidebarEnabled && location.pathname.startsWith("/watch")) {
        initExtension();
      }
    });

    // React to the popup toggling the sidebar on/off
    chrome.storage.onChanged.addListener((changes) => {
      if (!("sidebarEnabled" in changes)) return;
      const enabled = changes.sidebarEnabled.newValue;
      if (enabled && location.pathname.startsWith("/watch")) {
        initExtension();
      } else if (!enabled) {
        teardown();
      }
    });
  },
});

// ─── State ────────────────────────────────────────────────────────────────────

let captions: Caption[] = [];         // from timedtext interception (bonus context)
let domTranscript = "";               // accumulated from DOM caption scraping (primary)
let seenTerms = new Set<string>();
let lastProcessedWordCount = 0;
let cards: TermCard[] = [];
let hasCaption = false;
let noKey = false;
let port: chrome.runtime.Port | null = null;
let sidebarRoot: ReactDOM.Root | null = null;
let sidebarContainer: HTMLDivElement | null = null;
let reopenTab: HTMLDivElement | null = null;
let detectionTimer: ReturnType<typeof setInterval> | null = null;
let domCaptionTimer: ReturnType<typeof setInterval> | null = null;
let lookupButton: HTMLButtonElement | null = null;
let sidebarCollapsed = false;

// Pending lookups: requestId → card id (for updating card once response arrives)
const pendingLookups = new Map<string, string>();

// ─── Navigation watcher ───────────────────────────────────────────────────────

function watchForNavigation() {
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      if (location.pathname.startsWith("/watch")) {
        chrome.storage.local.get("sidebarEnabled", (result) => {
          if (result.sidebarEnabled) {
            resetForNewVideo();
            initExtension();
          }
        });
      } else {
        teardown();
      }
    }
  }, 1000);
}

function resetForNewVideo() {
  captions = [];
  domTranscript = "";
  seenTerms = new Set();
  lastProcessedWordCount = 0;
  cards = [];
  hasCaption = false;
  noKey = false;
  pendingLookups.clear();
  if (detectionTimer) { clearInterval(detectionTimer); detectionTimer = null; }
  if (domCaptionTimer) { clearInterval(domCaptionTimer); domCaptionTimer = null; }
  renderSidebar();
}

function teardown() {
  if (detectionTimer) { clearInterval(detectionTimer); detectionTimer = null; }
  if (domCaptionTimer) { clearInterval(domCaptionTimer); domCaptionTimer = null; }
  if (sidebarContainer) {
    sidebarContainer.remove();
    sidebarContainer = null;
    sidebarRoot = null;
  }
  if (reopenTab) {
    reopenTab.remove();
    reopenTab = null;
  }
  if (lookupButton) {
    lookupButton.remove();
    lookupButton = null;
  }
  setYtMargin(true); // remove the margin — pass true (collapsed) to reset to 0
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initExtension() {
  injectPageWorldScript();
  mountSidebar();
  connectPort();
  startDomCaptionScraper();
  startDetectionLoop();
  listenForManualLookup();

  // Listen for timedtext data from the page-world script (bonus rich context)
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type === "yt_timedtext") {
      handleTimedTextData(event.data as TimedTextMessage);
    }
  });
}

// ─── Page-world script injection ──────────────────────────────────────────────

interface TimedTextMessage {
  type: "yt_timedtext";
  url: string;
  lang: string;
  isAuto: boolean;
  xml: string;
}

function injectPageWorldScript() {
  // Load from extension file — avoids CSP inline-script violations on YouTube.
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-world.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

// ─── Timedtext handling ───────────────────────────────────────────────────────

const receivedTracks: TimedTextTrack[] = [];

function handleTimedTextData(msg: TimedTextMessage) {
  const parsed = parseTimedText(msg.xml);
  if (parsed.length === 0) return;

  // Store or update the track
  const existing = receivedTracks.findIndex((t) => t.url === msg.url);
  const track: TimedTextTrack = { url: msg.url, lang: msg.lang, isAuto: msg.isAuto, xml: msg.xml };
  if (existing >= 0) {
    receivedTracks[existing] = track;
  } else {
    receivedTracks.push(track);
  }

  // Re-select best track
  const best = selectBestTrack(receivedTracks);
  if (best) {
    captions = parseTimedText(best.xml);
    hasCaption = captions.length > 0;
    renderSidebar();
  }
}

// ─── DOM caption scraper (primary) ───────────────────────────────────────────
// Reads the visually-rendered caption segments every second. This is more
// reliable than timedtext interception because it works regardless of how
// YouTube delivers captions (fetch, XHR, pre-fetch timing, etc.).

let lastSeenCaptionText = "";

function startDomCaptionScraper() {
  if (domCaptionTimer) clearInterval(domCaptionTimer);
  domCaptionTimer = setInterval(() => {
    const segments = document.querySelectorAll<HTMLElement>(".ytp-caption-segment");
    if (segments.length === 0) return;

    const text = Array.from(segments)
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");

    if (!text || text === lastSeenCaptionText) return;
    lastSeenCaptionText = text;

    // Accumulate into running transcript (keep last ~400 words to bound memory)
    domTranscript = (domTranscript + " " + text).trim();
    const words = domTranscript.split(/\s+/);
    if (words.length > 400) domTranscript = words.slice(-400).join(" ");

    if (!hasCaption) {
      hasCaption = true;
      renderSidebar();
    }
  }, 1000);
}

// ─── Port management ──────────────────────────────────────────────────────────

function connectPort() {
  if (port) {
    try { port.disconnect(); } catch { /* ignore */ }
  }

  port = chrome.runtime.connect({ name: "yt-context" });

  port.onMessage.addListener((msg: MessageToContent) => {
    if (msg.type === "no_key") {
      noKey = true;
      renderSidebar();
    } else if (msg.type === "card") {
      const cardId = pendingLookups.get(msg.requestId) ?? msg.requestId;
      pendingLookups.delete(msg.requestId);

      // Check duplicate (auto-detected terms)
      if (msg.isAuto && isDuplicate(seenTerms, msg.term)) return;
      if (msg.isAuto) markSeen(seenTerms, msg.term);

      const video = getVideo();
      const timestamp = video?.currentTime ?? 0;

      const existing = cards.findIndex((c) => c.id === cardId);
      if (existing >= 0) {
        // Update pending card
        cards[existing] = {
          ...cards[existing],
          definition: msg.definition,
          isPending: false,
          isError: false,
        };
      } else {
        cards = [
          {
            id: cardId,
            term: msg.term,
            definition: msg.definition,
            timestamp,
            isAuto: msg.isAuto,
            isError: false,
            isPending: false,
          },
          ...cards,
        ];
      }
      renderSidebar();
    } else if (msg.type === "error") {
      const cardId = pendingLookups.get(msg.requestId);
      pendingLookups.delete(msg.requestId);
      if (cardId) {
        const existing = cards.findIndex((c) => c.id === cardId);
        if (existing >= 0) {
          cards[existing] = {
            ...cards[existing],
            isPending: false,
            isError: true,
            errorMessage: msg.message,
          };
          renderSidebar();
        }
      }
    }
  });

  port.onDisconnect.addListener(() => {
    port = null;
    // Reconnect after a short delay
    setTimeout(() => {
      if (location.pathname.startsWith("/watch")) {
        connectPort();
      }
    }, 1000);
  });
}

function sendToSW(msg: MessageToSW) {
  if (!port) connectPort();
  try {
    port!.postMessage(msg);
  } catch {
    // Port closed — reconnect and drop this message
    connectPort();
  }
}

// ─── Detection loop ───────────────────────────────────────────────────────────

function startDetectionLoop() {
  if (detectionTimer) clearInterval(detectionTimer);
  detectionTimer = setInterval(() => {
    runDetection();
  }, 10_000);
}

function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("video");
}

function runDetection() {
  const video = getVideo();
  if (!video || video.paused) return;

  // Prefer DOM-scraped transcript; fall back to timedtext if scraper hasn't fired yet
  const context = domTranscript ||
    (captions.length > 0 ? getTranscriptContext(captions, video.currentTime) : "");
  if (!context) return;

  const currentWordCount = countWords(context);
  if (!hasEnoughNewWords(lastProcessedWordCount, currentWordCount)) return;

  lastProcessedWordCount = currentWordCount;
  sendToSW({ type: "detect", chunk: context, context });
}

// ─── Manual lookup ────────────────────────────────────────────────────────────

function listenForManualLookup() {
  document.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";

    // Remove existing button
    if (lookupButton) {
      lookupButton.remove();
      lookupButton = null;
    }

    if (!text || countWords(text) < 1 || countWords(text) > 8) return;

    // Don't show inside the sidebar itself
    if (sidebarContainer && sidebarContainer.contains(selection?.anchorNode as Node)) return;

    const range = selection?.getRangeAt(0);
    if (!range) return;
    const rect = range.getBoundingClientRect();

    lookupButton = document.createElement("button");
    lookupButton.textContent = "Look up";
    Object.assign(lookupButton.style, {
      position: "fixed",
      top: `${rect.bottom + window.scrollY + 6}px`,
      left: `${rect.left + window.scrollX}px`,
      zIndex: "100000",
      background: "#1a1a1a",
      color: "#ffd750",
      border: "1px solid #444",
      borderRadius: "4px",
      padding: "5px 10px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });

    lookupButton.addEventListener("click", () => {
      triggerLookup(text);
      if (lookupButton) {
        lookupButton.remove();
        lookupButton = null;
      }
      selection?.removeAllRanges();
    });

    document.body.appendChild(lookupButton);

    // Auto-dismiss after 4s
    setTimeout(() => {
      if (lookupButton) {
        lookupButton.remove();
        lookupButton = null;
      }
    }, 4000);
  });
}

function triggerSimplify(cardId: string) {
  const card = cards.find((c) => c.id === cardId);
  if (!card || card.isPending || card.isError) return;

  const video = getVideo();
  const timestamp = video?.currentTime ?? 0;
  const context = domTranscript ||
    (captions.length > 0 ? getTranscriptContext(captions, timestamp) : "");

  const requestId = crypto.randomUUID();
  pendingLookups.set(requestId, cardId);

  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx >= 0) {
    cards[idx] = { ...cards[idx], isPending: true, isError: false };
  }
  renderSidebar();

  sendToSW({ type: "simplify", term: card.term, definition: card.definition, context, requestId });
}

function triggerLookup(term: string) {
  const video = getVideo();
  const timestamp = video?.currentTime ?? 0;
  const context = domTranscript ||
    (captions.length > 0 ? getTranscriptContext(captions, timestamp) : "");

  const requestId = crypto.randomUUID();
  const cardId = crypto.randomUUID();
  pendingLookups.set(requestId, cardId);

  // Add pending card immediately for responsive feel
  cards = [
    {
      id: cardId,
      term,
      definition: "",
      timestamp,
      isAuto: false,
      isError: false,
      isPending: true,
    },
    ...cards,
  ];
  renderSidebar();

  sendToSW({ type: "lookup", term, context, requestId });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function mountSidebar() {
  if (sidebarContainer) return; // already mounted

  sidebarContainer = document.createElement("div");
  sidebarContainer.id = "yt-context-sidebar-root";
  document.body.appendChild(sidebarContainer);

  sidebarRoot = ReactDOM.createRoot(sidebarContainer);
  mountReopenTab();
  setYtMargin(false);
  renderSidebar();
}

const SIDEBAR_STYLE_ID = "yt-context-sidebar-style";

function setYtMargin(collapsed: boolean) {
  const ytdApp = document.querySelector<HTMLElement>("ytd-app");
  if (ytdApp) ytdApp.style.marginRight = collapsed ? "" : "280px";

  if (collapsed) {
    document.getElementById(SIDEBAR_STYLE_ID)?.remove();
    // Tell YouTube to recalculate its layout now that the margin is gone.
    window.dispatchEvent(new Event("resize"));
  } else {
    if (!document.getElementById(SIDEBAR_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = SIDEBAR_STYLE_ID;
      // 1. Normal mode: the player's JS sets an explicit pixel width based on the
      //    original viewport, which can overflow into the sidebar and hide the
      //    theater/fullscreen buttons. max-width:100% clamps it to its container.
      // 2. Theater mode: the player becomes position:fixed spanning the full viewport
      //    and ignores ytd-app's margin. right:280px + width:auto shrinks it away
      //    from the sidebar so the controls stay visible.
      style.textContent = `
        #movie_player:not(.ytp-fullscreen) {
          max-width: 100% !important;
        }
        ytd-watch-flexy[theater] #movie_player:not(.ytp-fullscreen) {
          right: 280px !important;
          width: auto !important;
        }
      `;
      document.head.appendChild(style);
    }
    // Trigger YouTube's resize handlers so the player re-measures its container
    // and recalculates its pixel dimensions to respect the new margin.
    setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }
}

function mountReopenTab() {
  if (reopenTab) return;
  reopenTab = document.createElement("div");
  Object.assign(reopenTab.style, {
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
    width: "20px",
    height: "56px",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRight: "none",
    borderRadius: "6px 0 0 6px",
    display: "none",           // hidden until collapsed
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: "2147483647",      // max possible — always on top
    color: "#888",
    fontSize: "11px",
    userSelect: "none",
  });
  reopenTab.textContent = "❮";
  reopenTab.title = "Expand sidebar";
  reopenTab.addEventListener("click", () => {
    sidebarCollapsed = false;
    reopenTab!.style.display = "none";
    if (sidebarContainer) sidebarContainer.style.display = "block";
    setYtMargin(false);
    renderSidebar();
  });
  document.body.appendChild(reopenTab);
}

function renderSidebar() {
  if (!sidebarRoot) return;

  sidebarRoot.render(
    React.createElement(Sidebar, {
      cards,
      hasCaption,
      noKey,
      onDismiss: (id: string) => {
        cards = cards.filter((c) => c.id !== id);
        renderSidebar();
      },
      onLookup: (term: string) => {
        triggerLookup(term);
      },
      onSimplify: (cardId: string) => {
        triggerSimplify(cardId);
      },
      onCollapseChange: (collapsed: boolean) => {
        sidebarCollapsed = collapsed;
        setYtMargin(collapsed);
        if (collapsed && sidebarContainer && reopenTab) {
          sidebarContainer.style.display = "none";
          reopenTab.style.display = "flex";
        }
      },
    })
  );
}
