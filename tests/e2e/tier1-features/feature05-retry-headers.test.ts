import { describe, it, expect, beforeEach } from "vitest";
import { SlidingWindowRateLimiter } from "../harness/rate-limiter";
import { FlashAiApiSimulator } from "../harness/api-simulator";

describe("Tier 1: Feature 5 - HTTP 429 & Retry-After Headers (R2)", () => {
  let limiter: SlidingWindowRateLimiter;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter();
    api = new FlashAiApiSimulator();
  });

  it("5.1 generates HTTP 429 status code on rate limit breach", () => {
    const email = "flood@example.com";
    const now = Date.now();

    // Limit is 3 requests per 60s
    api.sendOtpCode(email, now);
    api.sendOtpCode(email, now + 100);
    api.sendOtpCode(email, now + 200);

    const fourth = api.sendOtpCode(email, now + 300);
    expect(fourth.status).toBe(429);
    expect(fourth.data.error).toContain("Too many");
  });

  it("5.2 emits standard Retry-After header indicating seconds until quota reset", () => {
    const key = "key:retry";
    const limit = 2;
    const windowMs = 30_000;
    const now = 100_000;

    limiter.checkRateLimit(key, limit, windowMs, now);
    limiter.checkRateLimit(key, limit, windowMs, now + 1_000);

    const blocked = limiter.checkRateLimit(key, limit, windowMs, now + 2_000);
    const headers = limiter.getHeaders(blocked, limit, now + 2_000);

    expect(headers["Retry-After"]).toBeDefined();
    const retrySec = parseInt(headers["Retry-After"], 10);
    expect(retrySec).toBeGreaterThanOrEqual(1);
    expect(retrySec).toBeLessThanOrEqual(30);
  });

  it("5.3 emits X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers", () => {
    const key = "key:xheaders";
    const limit = 5;
    const windowMs = 60_000;
    const now = 200_000;

    const res = limiter.checkRateLimit(key, limit, windowMs, now);
    const headers = limiter.getHeaders(res, limit, now);

    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
    expect(parseInt(headers["X-RateLimit-Reset"], 10)).toBeGreaterThan(0);
  });

  it("5.4 returns informative user-friendly JSON error payload with retry guidance", () => {
    const email = "friendly@example.com";
    const now = Date.now();

    api.sendOtpCode(email, now);
    api.sendOtpCode(email, now + 50);
    api.sendOtpCode(email, now + 100);

    const blocked = api.sendOtpCode(email, now + 150);
    expect(blocked.data.error).toBeDefined();
    expect(blocked.data.retryAfter).toBeDefined();
    expect(blocked.data.retryAfter).toBeGreaterThan(0);
  });

  it("5.5 allows requests to succeed with HTTP 200 once Retry-After period elapses", () => {
    const email = "recovery@example.com";
    const t0 = 1_000_000;

    api.sendOtpCode(email, t0);
    api.sendOtpCode(email, t0 + 100);
    api.sendOtpCode(email, t0 + 200);

    const blocked = api.sendOtpCode(email, t0 + 300);
    expect(blocked.status).toBe(429);
    const retrySec = blocked.data.retryAfter!;

    // Advance time past the retry window (61 seconds)
    const tRecovered = t0 + (retrySec + 2) * 1000;
    const recovered = api.sendOtpCode(email, tRecovered);
    expect(recovered.status).toBe(200);
    expect(recovered.data.success).toBe(true);
  });
});
