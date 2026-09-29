import { describe, it, expect, beforeEach } from "vitest";
import { SlidingWindowRateLimiter } from "../harness/rate-limiter";

describe("Tier 2: Boundary 5 - Retry-After & Response Header Boundaries", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter();
  });

  it("B5.1 ceil-rounds remaining reset duration: 1ms remaining yields Retry-After of 1 second", () => {
    const key = "header-ceil";
    const limit = 1;
    const windowMs = 5_000;
    const t0 = 1_000_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);

    // Call 1ms before reset (t0 + 4,999ms)
    const blocked = limiter.checkRateLimit(key, limit, windowMs, t0 + 4_999);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);

    const headers = limiter.getHeaders(blocked, limit, t0 + 4_999);
    expect(headers["Retry-After"]).toBe("1");
  });

  it("B5.2 exact reset epoch alignment: X-RateLimit-Reset equals ceiling of epoch seconds", () => {
    const key = "epoch-alignment";
    const limit = 2;
    const windowMs = 10_000;
    const now = 1_600_000_000_000; // Fixed epoch

    const res = limiter.checkRateLimit(key, limit, windowMs, now);
    const headers = limiter.getHeaders(res, limit, now);

    const expectedEpochSec = Math.ceil((now + res.resetMs) / 1000).toString();
    expect(headers["X-RateLimit-Reset"]).toBe(expectedEpochSec);
  });

  it("B5.3 X-RateLimit-Remaining never drops below 0 even under severe flooding", () => {
    const key = "never-negative";
    const limit = 2;
    const windowMs = 60_000;
    const now = 100_000;

    for (let i = 0; i < 20; i++) {
      const res = limiter.checkRateLimit(key, limit, windowMs, now);
      const headers = limiter.getHeaders(res, limit, now);
      expect(parseInt(headers["X-RateLimit-Remaining"], 10)).toBeGreaterThanOrEqual(0);
      expect(res.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it("B5.4 successive 429 requests show monotonically decreasing Retry-After as time passes", () => {
    const key = "decreasing-retry";
    const limit = 1;
    const windowMs = 30_000;
    const t0 = 500_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);

    const b1 = limiter.checkRateLimit(key, limit, windowMs, t0 + 5_000);
    const b2 = limiter.checkRateLimit(key, limit, windowMs, t0 + 15_000);
    const b3 = limiter.checkRateLimit(key, limit, windowMs, t0 + 25_000);

    expect(b1.retryAfterSec).toBe(25);
    expect(b2.retryAfterSec).toBe(15);
    expect(b3.retryAfterSec).toBe(5);
  });

  it("B5.5 cleanly recovers with HTTP 200 headers once reset timestamp is reached", () => {
    const key = "clean-recovery-headers";
    const limit = 1;
    const windowMs = 10_000;
    const t0 = 100_000;

    limiter.checkRateLimit(key, limit, windowMs, t0);

    // After reset
    const tReset = t0 + 10_001;
    const res = limiter.checkRateLimit(key, limit, windowMs, tReset);
    const headers = limiter.getHeaders(res, limit, tReset);

    expect(res.allowed).toBe(true);
    expect(headers["Retry-After"]).toBeUndefined();
    expect(headers["X-RateLimit-Remaining"]).toBe("0"); // 1 slot used
  });
});
