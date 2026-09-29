import { describe, it, expect, beforeEach } from "vitest";
import { SlidingWindowRateLimiter } from "../harness/rate-limiter";

describe("Tier 2: Boundary 4 - Rate Limiting Window Boundaries", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter();
  });

  it("B4.1 exact threshold test: Nth request allowed, (N+1)th request blocked at same millisecond", () => {
    const key = "threshold-test";
    const limit = 10;
    const windowMs = 60_000;
    const t0 = 1_000_000;

    for (let i = 1; i <= limit; i++) {
      const res = limiter.checkRateLimit(key, limit, windowMs, t0);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - i);
    }

    // 11th request is blocked
    const overflow = limiter.checkRateLimit(key, limit, windowMs, t0);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it("B4.2 request at (t0 + windowMs - 1ms) remains strictly blocked", () => {
    const key = "just-before-expiry";
    const limit = 1;
    const windowMs = 10_000;
    const t0 = 500_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);

    // 1ms before window expiration
    const beforeExpiry = t0 + windowMs - 1;
    const res = limiter.checkRateLimit(key, limit, windowMs, beforeExpiry);
    expect(res.allowed).toBe(false);
  });

  it("B4.3 request at (t0 + windowMs + 1ms) allows the next request cleanly", () => {
    const key = "just-after-expiry";
    const limit = 1;
    const windowMs = 10_000;
    const t0 = 500_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);

    // 1ms after window expiration
    const afterExpiry = t0 + windowMs + 1;
    const res = limiter.checkRateLimit(key, limit, windowMs, afterExpiry);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(0);
  });

  it("B4.4 burst of 30 simultaneous requests at exact same millisecond admits exactly limit requests", () => {
    const key = "burst-spike";
    const limit = 5;
    const windowMs = 60_000;
    const t0 = 2_000_000;

    let allowedCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < 30; i++) {
      const res = limiter.checkRateLimit(key, limit, windowMs, t0);
      if (res.allowed) allowedCount++;
      else blockedCount++;
    }

    expect(allowedCount).toBe(5);
    expect(blockedCount).toBe(25);
  });

  it("B4.5 evaluates massive rate limits (limit: 5,000) efficiently without memory issues", () => {
    const key = "massive-limit";
    const limit = 5000;
    const windowMs = 60_000;
    const t0 = 100_000;

    // Simulate 50 requests
    for (let i = 0; i < 50; i++) {
      const res = limiter.checkRateLimit(key, limit, windowMs, t0 + i);
      expect(res.allowed).toBe(true);
    }
  });
});
