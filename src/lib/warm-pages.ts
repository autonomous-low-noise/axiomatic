/**
 * Prune warm-page entries for pages far from the visible range.
 * Prevents desync between the JS warm-tracking Set and the Rust LRU cache:
 * when the LRU evicts pages the user scrolled away from, we must also remove
 * them from the warm set so they go through the prewarm pipeline again.
 */
export function pruneWarmPages(
  warm: Set<string>,
  visibleStart: number,
  visibleEnd: number,
  margin: number = 20,
): void {
  for (const key of warm) {
    const page = parseInt(key.split(':')[0], 10)
    if (page < visibleStart - margin || page > visibleEnd + margin) {
      warm.delete(key)
    }
  }
}
