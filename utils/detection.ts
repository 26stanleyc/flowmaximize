/**
 * Detection loop utilities — word threshold and deduplication.
 */

/**
 * Returns true if enough new words have accumulated since the last
 * detection check to justify an API call.
 */
export function hasEnoughNewWords(
  previousWordCount: number,
  currentWordCount: number,
  threshold = 15
): boolean {
  return currentWordCount - previousWordCount >= threshold;
}

/**
 * Counts the total number of words in a string.
 */
export function countWords(text: string): number {
  if (!text || text.trim() === "") return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Checks whether a term has already been explained in this session.
 * Case-insensitive, trims whitespace.
 */
export function isDuplicate(seenTerms: Set<string>, term: string): boolean {
  return seenTerms.has(term.trim().toLowerCase());
}

/**
 * Adds a term to the seen set (normalised).
 */
export function markSeen(seenTerms: Set<string>, term: string): void {
  seenTerms.add(term.trim().toLowerCase());
}
