// ================================================================
// Rate Limiting — Sliding Window (In-Memory)
// For production with multiple instances, replace store with Redis.
// ================================================================

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

// In-memory store: key → { tokens, lastRefill }
const store = new Map<string, RateLimitEntry>();

// Periodically clean stale entries to prevent memory leaks (every 5 min)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries idle for more than 10 minutes
      if (now - entry.lastRefill > 10 * 60 * 1000) {
        store.delete(key);
      }
    }
  };
  // Only run in Node.js environment (not Edge)
  if (typeof setInterval !== "undefined") {
    setInterval(cleanup, 5 * 60 * 1000);
  }
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSecs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Requests remaining in the current window */
  remaining: number;
  /** Seconds until the window resets */
  resetIn: number;
  /** The configured limit */
  limit: number;
}

/**
 * Check and consume a rate limit token for the given key.
 * Uses a token-bucket algorithm with per-window refill.
 *
 * @param key      Unique identifier (e.g. `userId:endpoint`)
 * @param config   Limit configuration
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSecs * 1000;

  let entry = store.get(key);

  if (!entry || now - entry.lastRefill >= windowMs) {
    // New window — full tokens
    entry = { tokens: config.limit, lastRefill: now };
  }

  const resetIn = Math.ceil((windowMs - (now - entry.lastRefill)) / 1000);

  if (entry.tokens <= 0) {
    store.set(key, entry);
    return { success: false, remaining: 0, resetIn, limit: config.limit };
  }

  entry.tokens -= 1;
  store.set(key, entry);

  return {
    success: true,
    remaining: entry.tokens,
    resetIn,
    limit: config.limit,
  };
}

// ----------------------------------------------------------------
// Pre-configured limiters for each API tier
// ----------------------------------------------------------------

/** General API: 100 req / 60s per user */
export const generalLimit: RateLimitConfig = { limit: 100, windowSecs: 60 };

/** Repository import: 5 req / 60s per user */
export const importLimit: RateLimitConfig = { limit: 5, windowSecs: 60 };

/** AI/LLM endpoints: 10 req / 60s per user */
export const aiLimit: RateLimitConfig = { limit: 10, windowSecs: 60 };

/** Cross-repo analyze: 20 req / 60s per user */
export const crossRepoLimit: RateLimitConfig = { limit: 20, windowSecs: 60 };

/**
 * Apply a rate limit check and return a 429 response object if exceeded,
 * or null if allowed. Use like:
 *
 * ```ts
 * const limited = checkRateLimit(userId, "import", importLimit);
 * if (limited) return limited;
 * ```
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Response | null {
  const result = rateLimit(`${userId}:${endpoint}`, config);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please slow down.",
        retryAfter: result.resetIn,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.resetIn),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + result.resetIn),
        },
      }
    );
  }

  return null;
}
