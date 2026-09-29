/**
 * Sliding-Window Rate Limiter Simulator for FlashAI E2E Test Suite.
 * Mirrors the exact contract from PROJECT.md:
 * checkRateLimit(key: string, limit: number, windowMs: number)
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
}

export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();

  reset() {
    this.windows.clear();
  }

  checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    let timestamps = this.windows.get(key) || [];
    const windowStart = now - windowMs;

    // Evict timestamps outside the sliding window
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
}

export const globalRateLimiter = new SlidingWindowRateLimiter();
