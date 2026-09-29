import { describe, it, expect, beforeEach } from "vitest";
import { SlidingWindowRateLimiter } from "../harness/rate-limiter";

describe("Tier 1: Feature 4 - Sliding-Window Rate Limiting (R2)", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter();
  });

  it("4.1 allows requests strictly within configured sliding-window limit", () => {
    const key = "ip:192.168.1.1";
    const limit = 5;
    const windowMs = 60_000;
    const now = 1_000_000;

    for (let i = 0; i < limit; i++) {
      const res = limiter.checkRateLimit(key, limit, windowMs, now + i * 100);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - 1 - i);
    }
  });

  it("4.2 blocks requests once limit is reached and returns allowed: false", () => {
    const key = "user:burst";
    const limit = 3;
    const windowMs = 10_000;
    const now = 2_000_000;

    // Use all 3 slots
    limiter.checkRateLimit(key, limit, windowMs, now);
    limiter.checkRateLimit(key, limit, windowMs, now + 100);
    limiter.checkRateLimit(key, limit, windowMs, now + 200);

    // 4th request should be blocked
    const blockedRes = limiter.checkRateLimit(key, limit, windowMs, now + 300);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSec).toBeGreaterThan(0);
  });

  it("4.3 automatically evicts timestamps outside sliding window duration", () => {
    const key = "user:evict";
    const limit = 2;
    const windowMs = 5_000;
    const t0 = 1_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);
    limiter.checkRateLimit(key, limit, windowMs, t0 + 1_000);

    // Blocked at t0 + 2000
    const blocked = limiter.checkRateLimit(key, limit, windowMs, t0 + 2_000);
    expect(blocked.allowed).toBe(false);

    // After windowMs has passed past t0 (e.g. t0 + 5100), first request has expired!
    const tAfter = t0 + 5_100;
    const allowedAfter = limiter.checkRateLimit(key, limit, windowMs, tAfter);
    expect(allowedAfter.allowed).toBe(true);
  });

  it("4.4 isolates rate limit buckets across distinct keys / users", () => {
    const limit = 2;
    const windowMs = 60_000;
    const now = 500_000;

    // User A exhausts limit
    limiter.checkRateLimit("user:A", limit, windowMs, now);
    limiter.checkRateLimit("user:A", limit, windowMs, now + 10);
    const blockedA = limiter.checkRateLimit("user:A", limit, windowMs, now + 20);
    expect(blockedA.allowed).toBe(false);

    // User B is unaffected
    const allowedB = limiter.checkRateLimit("user:B", limit, windowMs, now + 25);
    expect(allowedB.allowed).toBe(true);
    expect(allowedB.remaining).toBe(1);
  });

  it("4.5 monotonically decrements remaining counter on successive allowed requests", () => {
    const key = "user:monotonic";
    const limit = 4;
    const windowMs = 60_000;
    const now = 100_000;

    const r1 = limiter.checkRateLimit(key, limit, windowMs, now);
    const r2 = limiter.checkRateLimit(key, limit, windowMs, now + 50);
    const r3 = limiter.checkRateLimit(key, limit, windowMs, now + 100);

    expect(r1.remaining).toBe(3);
    expect(r2.remaining).toBe(2);
    expect(r3.remaining).toBe(1);
  });

  it("4.6 fully resets remaining count to limit once entire window has elapsed", () => {
    const key = "user:fullreset";
    const limit = 3;
    const windowMs = 10_000;
    const t0 = 10_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);
    limiter.checkRateLimit(key, limit, windowMs, t0 + 100);
    limiter.checkRateLimit(key, limit, windowMs, t0 + 200);

    // Advance 15 seconds (past entire window)
    const after = limiter.checkRateLimit(key, limit, windowMs, t0 + 15_000);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(2); // 3 - 1
  });
});
