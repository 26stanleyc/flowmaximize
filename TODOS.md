# TODOS

## [youtube-context-sidebar] Timedtext hook race condition
**What:** If the page-world script loses the race against YouTube's own fetch, no transcript is captured and auto-detection silently fails. Manual lookup still works (it uses whatever text is selected), but auto-detection never fires.

**Why:** Silent failure means the user has no idea auto-detection isn't working. This is the worst possible failure mode for a "flow preservation" tool.

**Fix:** After 5 seconds with no timedtext response received, show "Waiting for transcript..." indicator in the sidebar. Retry the hook injection once on `document.readyState === 'complete'`. If still nothing after the retry, show "No transcript captured — manual lookup still works."

**Pros:** Eliminates silent failure. Gives the user clear feedback. 
**Cons:** ~30 minutes of implementation. Adds complexity to the hook initialization path.

**Where to start:** `entrypoints/content.ts`, hook initialization logic. Add a 5s `setTimeout` that checks if `captionArray.length > 0` and shows the indicator if not.

**Depends on:** v1 timedtext interceptor implementation complete.

---

## [youtube-context-sidebar] Port disconnect / service worker state loss
**What:** If the tab is backgrounded under memory pressure, Chrome may kill the content script, closing the port and terminating the service worker. The current plan has no reconnect logic and no state persistence — after a disconnect, auto-detection stops silently.

**Why:** On a MacBook with many tabs open during a long lecture, this is realistic.

**Fix:** Handle `port.onDisconnect` in the content script: reconnect immediately via `chrome.runtime.connect()` and re-send the current state (current video ID, lastProcessedWordIndex). Service worker should accept a "resync" message type and restore from the payload.

**Pros:** Makes the extension robust to tab backgrounding.
**Cons:** ~1 hour of implementation. Needs a defined "state resync" message protocol.

**Where to start:** `entrypoints/content.ts`, port management. Add `port.onDisconnect.addListener(() => { port = chrome.runtime.connect(...); port.postMessage({ type: 'resync', state: currentState }); })`.

**Depends on:** v1 port messaging architecture complete.
