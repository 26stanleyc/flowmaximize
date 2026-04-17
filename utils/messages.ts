/**
 * Message types passed over the long-lived port between the content script
 * and the background service worker.
 */

export type MessageToSW =
  | { type: "detect"; chunk: string; context: string }
  | { type: "lookup"; term: string; context: string; requestId: string }
  | { type: "simplify"; term: string; definition: string; context: string; requestId: string }
  | { type: "resync"; lastWordIndex: number };

export type MessageToContent =
  | { type: "card"; requestId: string; term: string; definition: string; isAuto: boolean }
  | { type: "error"; requestId: string; term: string; message: string }
  | { type: "no_key" };

export interface TermCard {
  id: string;
  term: string;
  definition: string;
  timestamp: number; // video currentTime in seconds when detected
  isAuto: boolean;
  isError: boolean;
  errorMessage?: string;
  isPending: boolean;
}
