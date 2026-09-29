/**
 * Production-ready Sliding-Window In-Memory Rate Limiter with TTL cleanup.
 * Used to safeguard heavy serverless and AI routes (/api/generate, /api/explain, /api/auth).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
}

export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60_000;

  reset() {
    this.windows.clear();
  }

  /**
   * Evaluates if a request for a given key is allowed under the sliding window limit.
   */
  checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    // Periodic background cleanup of stale entries
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(now, windowMs);
    }

    let timestamps = this.windows.get(key) || [];
    const windowStart = now - windowMs;

    // Filter out timestamps outside the active sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length < limit) {
      timestamps.push(now);
      this.windows.set(key, timestamps);
      const oldest = timestamps[0];
      const resetMs = Math.max(0, oldest + windowMs - now);

      return {
        allowed: true,
        remaining: limit - timestamps.length,
        resetMs,
        retryAfterSec: 0,
      };
    }

    // Rate limit exceeded
    this.windows.set(key, timestamps);
    const oldest = timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetMs,
      retryAfterSec,
    };
  }

  /**
   * Generates standard HTTP rate-limiting headers.
   */
  getHeaders(result: RateLimitResult, limit: number, now = Date.now()): Record<string, string> {
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": Math.max(0, result.remaining).toString(),
      "X-RateLimit-Reset": Math.ceil((now + result.resetMs) / 1000).toString(),
    };

    if (!result.allowed) {
      headers["Retry-After"] = result.retryAfterSec.toString();
    }

    return headers;
  }

  /**
   * Clean expired entries to avoid memory leaks in long-running processes.
   */
  private cleanup(now: number, maxAgeMs: number) {
    this.lastCleanup = now;
    const expiry = now - maxAgeMs;

    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter((t) => t > expiry);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
}

export const globalRateLimiter = new SlidingWindowRateLimiter();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  return globalRateLimiter.checkRateLimit(key, limit, windowMs, now);
}

export function getRateLimitHeaders(result: RateLimitResult, limit: number, now = Date.now()): Record<string, string> {
  return globalRateLimiter.getHeaders(result, limit, now);
}
