/**
 * In-memory cache with TTL (24h default)
 * Used to cache YouTube API responses and avoid redundant calls.
 *
 * Keyed by a string (e.g. "channel:UCxxx" or "videos:vid1,vid2").
 * Falls back gracefully — never throws on cache miss.
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Get a value from cache. Returns undefined on miss or expiry. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/** Set a value in cache with optional TTL (default 24h). */
export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Check if a key exists and is not expired. */
export function cacheHas(key: string): boolean {
  return cacheGet(key) !== undefined;
}

/** Delete a specific key. */
export function cacheDel(key: string): void {
  store.delete(key);
}

/** Clear all cache entries. */
export function cacheClear(): void {
  store.clear();
}

/** Get cache stats for debugging. */
export function cacheStats(): { size: number; keys: string[] } {
  // Prune expired entries first
  for (const [key, entry] of store) {
    if (Date.now() > entry.expiresAt) store.delete(key);
  }
  return { size: store.size, keys: [...store.keys()] };
}
