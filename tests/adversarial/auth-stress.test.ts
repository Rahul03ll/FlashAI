import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import crypto from "crypto";
import {
  generateOtp,
  checkSendCodeRateLimit,
  storeVerificationCode,
  verifyCodeAndLinkAccount,
  createSessionToken,
  verifySessionToken,
  saveMemoryUser,
  registerMemoryDeck,
  resetAuthStore,
  AUTH_COOKIE_NAME,
  USER_COOKIE_KEY,
  OTP_EXPIRY_MS,
  MAX_VERIFY_ATTEMPTS,
  SEND_CODE_MAX_REQUESTS,
  SEND_CODE_WINDOW_MS,
  getSessionUser,
} from "@/lib/auth";

import { POST as sendCodePost } from "@/app/api/auth/send-code/route";
import { POST as verifyCodePost } from "@/app/api/auth/verify-code/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";

describe("Adversarial Auth Stress & Concurrency Challenge Suite", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. OTP RATE LIMIT STRESS TESTS
  // =========================================================================
  describe("1. OTP Rate Limits Stress & Boundary Verification", () => {
    it("allows exactly 3 requests per 10 minutes and rejects the 4th request with 429", async () => {
      const email = "stress-rate@flashai.io";

      // Request 1: Allowed, remaining = 2
      const r1 = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r1.status).toBe(200);
      expect(r1.headers.get("X-RateLimit-Remaining")).toBe("2");
      const d1 = await r1.json();
      expect(d1.success).toBe(true);

      // Request 2: Allowed, remaining = 1
      const r2 = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r2.status).toBe(200);
      expect(r2.headers.get("X-RateLimit-Remaining")).toBe("1");

      // Request 3: Allowed, remaining = 0
      const r3 = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r3.status).toBe(200);
      expect(r3.headers.get("X-RateLimit-Remaining")).toBe("0");

      // Request 4 (Boundary Breached): Must return HTTP 429
      const r4 = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r4.status).toBe(429);
      expect(r4.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(Number(r4.headers.get("Retry-After"))).toBeGreaterThan(0);
      const d4 = await r4.json();
      expect(d4.error).toContain("Too many verification code requests");
      expect(d4.retryAfter).toBeGreaterThan(0);

      // Request 5 and 6: Continued rejection under rate limit
      const r5 = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r5.status).toBe(429);
    });

    it("enforces rate limits across casing variations", async () => {
      const emailVariations = [
        "Victim@FlashAI.io",
        "victim@flashai.io",
        "VICTIM@flashai.io",
        "victim@FLASHAI.IO",
      ];

      // Requests 1-3 with varying casing
      for (let i = 0; i < 3; i++) {
        const res = await sendCodePost(
          new Request("http://localhost/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailVariations[i] }),
          })
        );
        expect(res.status).toBe(200);
      }

      // 4th request with 4th casing variation must still be blocked
      const r4 = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailVariations[3] }),
        })
      );
      expect(r4.status).toBe(429);
    });

    it("trims and normalizes email with leading/trailing spaces and varying casing", async () => {
      const res = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "  user@flashai.io  " }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("Verification code sent");
    });

    it("resets rate limit window after 10 minutes", () => {
      vi.useFakeTimers();
      const email = "timer-test@flashai.io";

      // Exhaust 3 requests
      expect(checkSendCodeRateLimit(email).allowed).toBe(true);
      expect(checkSendCodeRateLimit(email).allowed).toBe(true);
      expect(checkSendCodeRateLimit(email).allowed).toBe(true);
      expect(checkSendCodeRateLimit(email).allowed).toBe(false);

      // Fast-forward 9 minutes (should still be blocked)
      vi.advanceTimersByTime(9 * 60 * 1000);
      expect(checkSendCodeRateLimit(email).allowed).toBe(false);

      // Fast-forward another 1 minute + 1 second (total > 10 minutes)
      vi.advanceTimersByTime(61 * 1000);
      const afterWindow = checkSendCodeRateLimit(email);
      expect(afterWindow.allowed).toBe(true);
      expect(afterWindow.remaining).toBe(2);
    });

    it("handles concurrent burst floods: allows at most 3 out of 25 simultaneous calls", async () => {
      const email = "concurrency-flood@flashai.io";
      const tasks = Array.from({ length: 25 }, () =>
        sendCodePost(
          new Request("http://localhost/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          })
        )
      );

      const results = await Promise.all(tasks);
      const okCount = results.filter((r) => r.status === 200).length;
      const rejectedCount = results.filter((r) => r.status === 429).length;

      expect(okCount).toBe(3);
      expect(rejectedCount).toBe(22);
    });

    it("isolates rate limits between distinct user emails", async () => {
      const email1 = "user1@flashai.io";
      const email2 = "user2@flashai.io";

      // Exhaust email1
      for (let i = 0; i < 3; i++) {
        await sendCodePost(
          new Request("http://localhost/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email1 }),
          })
        );
      }

      // Email1 is locked out
      const r1Blocked = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email1 }),
        })
      );
      expect(r1Blocked.status).toBe(429);

      // Email2 must still be fully permitted
      const r2Allowed = await sendCodePost(
        new Request("http://localhost/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email2 }),
        })
      );
      expect(r2Allowed.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. BRUTE FORCE LOCKOUT STRESS TESTS
  // =========================================================================
  describe("2. Brute Force Lockout & Anti-Hammering Verification", () => {
    it("locks out verification after exactly 3 failed attempts and rejects 4th attempt even if code is correct", async () => {
      const email = "lockout-victim@flashai.io";
      const realCode = "842109";
      await storeVerificationCode(email, realCode);

      // Attempt 1: Invalid code
      const res1 = await verifyCodePost(
        new Request("http://localhost/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "000001" }),
        })
      );
      expect(res1.status).toBe(400);
      const d1 = await res1.json();
      expect(d1.error).toContain("2 attempt(s) remaining");

      // Attempt 2: Invalid code
      const res2 = await verifyCodePost(
        new Request("http://localhost/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "000002" }),
        })
      );
      expect(res2.status).toBe(400);
      const d2 = await res2.json();
      expect(d2.error).toContain("1 attempt(s) remaining");

      // Attempt 3: Invalid code -> Reaches max attempts
      const res3 = await verifyCodePost(
        new Request("http://localhost/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "000003" }),
        })
      );
      expect(res3.status).toBe(400);
      const d3 = await res3.json();
      expect(d3.error).toContain("Maximum attempts reached");

      // Attempt 4: Even with the CORRECT code, must be REJECTED due to lockout!
      const res4 = await verifyCodePost(
        new Request("http://localhost/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: realCode }),
        })
      );
      expect(res4.status).toBe(400);
      const d4 = await res4.json();
      expect(d4.error).toContain("Maximum verification attempts exceeded");

      // Attempt 5: Another attempt with correct code remains locked out
      const res5 = await verifyCodePost(
        new Request("http://localhost/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: realCode }),
        })
      );
      expect(res5.status).toBe(400);
      const d5 = await res5.json();
      expect(d5.error).toContain("Maximum verification attempts exceeded");
    });

    it("resets lockout state when a NEW code is legitimately requested after previous lockout", async () => {
      const email = "renew-after-lockout@flashai.io";
      const oldCode = "111111";
      await storeVerificationCode(email, oldCode);

      // Lockout the first code with 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await verifyCodeAndLinkAccount({ email, code: "999999" });
      }
      const lockedTry = await verifyCodeAndLinkAccount({ email, code: oldCode });
      expect(lockedTry.success).toBe(false);
      expect(lockedTry.error).toContain("Maximum verification attempts exceeded");

      // Now user requests a new code after a short delay
      await new Promise((r) => setTimeout(r, 15));
      const newCode = "222222";
      await storeVerificationCode(email, newCode);

      // Verifying with the new code succeeds
      const newTry = await verifyCodeAndLinkAccount({ email, code: newCode });
      expect(newTry.success).toBe(true);
      expect(newTry.user?.email).toBe(email);
    });

    it("guarantees fresh attempts and unlocks user even if codes are generated in the same millisecond", async () => {
      const email = "sub-millisecond-collision@flashai.io";
      const code1 = "111111";
      const code2 = "222222";

      // Mock Date.now to return current timestamp for both code creations
      const realNow = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(realNow);

      await storeVerificationCode(email, code1);
      // Lockout code 1
      for (let i = 0; i < 3; i++) {
        await verifyCodeAndLinkAccount({ email, code: "000000" });
      }

      // Generate code 2 at the exact same millisecond: invalidates prior unverified code1
      await storeVerificationCode(email, code2);

      // Previous code1 was invalidated/deleted, so code2 receives fresh attempts
      const verifyAttempt = await verifyCodeAndLinkAccount({ email, code: code2 });
      vi.restoreAllMocks();

      expect(verifyAttempt.success).toBe(true);
      expect(verifyAttempt.user?.email).toBe(email);
    });
  });

  // =========================================================================
  // 3. CODE EXPIRY STRESS TESTS
  // =========================================================================
  describe("3. Code Expiry Stress Verification", () => {
    it("accepts code just before 10-minute expiry and rejects it immediately after expiry", async () => {
      vi.useFakeTimers();
      const email = "expiry-test@flashai.io";
      const code = "789123";

      const record = await storeVerificationCode(email, code);
      expect(record.code).toBe(code);

      // Fast-forward 9 minutes and 59 seconds (within 10-minute TTL)
      vi.advanceTimersByTime(9 * 60 * 1000 + 59 * 1000);

      // Test before expiry: should still be active
      // (We test with wrong code first to check it wasn't expired yet)
      const attemptBefore = await verifyCodeAndLinkAccount({ email, code: "000000" });
      expect(attemptBefore.success).toBe(false);
      expect(attemptBefore.error).toContain("2 attempt(s) remaining");

      // Advance another 2 seconds (now past 10 minutes total)
      vi.advanceTimersByTime(2000);

      // Now past expiry: must be rejected with expired message
      const attemptAfter = await verifyCodeAndLinkAccount({ email, code });
      expect(attemptAfter.success).toBe(false);
      expect(attemptAfter.error).toContain("No active verification code found for this email, or code has expired.");
    });

    it("rejects expired code even if 0 attempts were made against it", async () => {
      vi.useFakeTimers();
      const email = "zero-attempt-expired@flashai.io";
      const code = "555666";

      await storeVerificationCode(email, code);

      // Fast forward 11 minutes
      vi.advanceTimersByTime(11 * 60 * 1000);

      const res = await verifyCodeAndLinkAccount({ email, code });
      expect(res.success).toBe(false);
      expect(res.error).toContain("code has expired");
    });

    it("selects valid active code when previous older code is expired", async () => {
      vi.useFakeTimers();
      const email = "multi-code-expiry@flashai.io";
      const code1 = "123123";

      await storeVerificationCode(email, code1);

      // Advance 12 minutes so code1 expires
      vi.advanceTimersByTime(12 * 60 * 1000);

      // Issue code2
      const code2 = "456456";
      await storeVerificationCode(email, code2);

      // Trying code1 fails because it's expired
      const res1 = await verifyCodeAndLinkAccount({ email, code: code1 });
      // Code 2 is the active code, so entering code1 will count as an invalid attempt against code2
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("Invalid verification code");

      // Trying code2 succeeds
      const res2 = await verifyCodeAndLinkAccount({ email, code: code2 });
      expect(res2.success).toBe(true);
      expect(res2.user?.email).toBe(email);
    });
  });

  // =========================================================================
  // 4. HMAC-SHA256 TOKEN TAMPERING STRESS TESTS
  // =========================================================================
  describe("4. HMAC-SHA256 Session Token Tampering & Cryptographic Integrity", () => {
    it("successfully creates and verifies a legitimate session token", () => {
      const token = createSessionToken({
        userId: "user-legit-001",
        email: "legit@flashai.io",
        isGuest: false,
      });

      const session = verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe("user-legit-001");
      expect(session?.email).toBe("legit@flashai.io");
      expect(session?.isGuest).toBe(false);
    });

    it("rejects token when payload userId is tampered", () => {
      const token = createSessionToken({
        userId: "victim-user-123",
        email: "victim@flashai.io",
        isGuest: false,
      });

      const [dataB64, sig] = token.split(".");
      const decoded = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf8"));
      decoded.userId = "attacker-admin-000"; // Privilege escalation attempt
      const tamperedDataB64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
      const tamperedToken = `${tamperedDataB64}.${sig}`;

      expect(verifySessionToken(tamperedToken)).toBeNull();
    });

    it("rejects token when payload isGuest flag is tampered", () => {
      const token = createSessionToken({
        userId: "guest-user-999",
        isGuest: true,
      });

      const [dataB64, sig] = token.split(".");
      const decoded = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf8"));
      decoded.isGuest = false;
      const tamperedDataB64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
      const tamperedToken = `${tamperedDataB64}.${sig}`;

      expect(verifySessionToken(tamperedToken)).toBeNull();
    });

    it("rejects token when signature bits are altered or truncated", () => {
      const token = createSessionToken({
        userId: "user-sig-test",
        email: "sig@flashai.io",
      });

      const [dataB64, sig] = token.split(".");

      // Single character replacement in signature
      const lastChar = sig[sig.length - 1];
      const alteredChar = lastChar === "a" ? "b" : "a";
      const tamperedSig = sig.slice(0, -1) + alteredChar;
      expect(verifySessionToken(`${dataB64}.${tamperedSig}`)).toBeNull();

      // Truncated signature
      expect(verifySessionToken(`${dataB64}.${sig.slice(0, 10)}`)).toBeNull();

      // Extended signature
      expect(verifySessionToken(`${dataB64}.${sig}extra`)).toBeNull();
    });

    it("rejects alg-none and empty signature attacks", () => {
      const token = createSessionToken({ userId: "user-none" });
      const [dataB64] = token.split(".");

      expect(verifySessionToken(`${dataB64}.`)).toBeNull();
      expect(verifySessionToken(`${dataB64}`)).toBeNull();
      expect(verifySessionToken("")).toBeNull();
      expect(verifySessionToken("...")).toBeNull();
      expect(verifySessionToken("invalid.token.structure")).toBeNull();
    });

    it("rejects expired session tokens", () => {
      vi.useFakeTimers();
      const token = createSessionToken({
        userId: "user-time-expired",
        email: "time@flashai.io",
      });

      // Token has 30 days expiry. Advance time by 31 days
      vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

      expect(verifySessionToken(token)).toBeNull();
    });

    it("rejects tokens signed with an arbitrary external secret", () => {
      const session = {
        userId: "hacker-user-666",
        email: "hacker@evil.com",
        isGuest: false,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const dataB64 = Buffer.from(JSON.stringify(session)).toString("base64url");
      const rogueSignature = crypto
        .createHmac("sha256", "rogue-secret-attacker-controlled")
        .update(dataB64)
        .digest("base64url");

      const rogueToken = `${dataB64}.${rogueSignature}`;
      expect(verifySessionToken(rogueToken)).toBeNull();
    });
  });

  // =========================================================================
  // 5. ROUTE HANDLERS & SESSION RESOLUTION STRESS TESTS
  // =========================================================================
  describe("5. Route Handlers Integration & Session Resolution", () => {
    it("verify-code route sets secure auth and user cookies upon success", async () => {
      const email = "cookie-test@flashai.io";
      const code = "654321";
      await storeVerificationCode(email, code);

      const res = await verifyCodePost(
        new Request("http://localhost/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code, currentUserId: "guest-test-123" }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();

      // Check cookies
      const authCookie = res.cookies.get(AUTH_COOKIE_NAME);
      const userCookie = res.cookies.get(USER_COOKIE_KEY);

      expect(authCookie?.value).toBe(data.token);
      expect(authCookie?.httpOnly).toBe(true);
      expect(authCookie?.path).toBe("/");

      expect(userCookie?.value).toBe(data.user.id);
      expect(userCookie?.httpOnly).toBe(false);
    });

    it("GET /api/auth/me resolves session from Bearer authorization header", async () => {
      const token = createSessionToken({
        userId: "bearer-user-777",
        email: "bearer@flashai.io",
        isGuest: false,
      });

      saveMemoryUser({
        id: "bearer-user-777",
        name: "BearerLearner",
        email: "bearer@flashai.io",
        isGuest: false,
        points: 400,
        xp: 400,
        streak: 7,
      });

      const res = await meGet(
        new Request("http://localhost/api/auth/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user?.id).toBe("bearer-user-777");
      expect(data.user?.email).toBe("bearer@flashai.io");
      expect(data.isGuest).toBe(false);
    });

    it("GET /api/auth/me resolves session from flashai_auth_token cookie", async () => {
      const token = createSessionToken({
        userId: "cookie-user-888",
        email: "cookie@flashai.io",
        isGuest: false,
      });

      saveMemoryUser({
        id: "cookie-user-888",
        name: "CookieLearner",
        email: "cookie@flashai.io",
        isGuest: false,
      });

      const res = await meGet(
        new Request("http://localhost/api/auth/me", {
          method: "GET",
          headers: {
            Cookie: `${AUTH_COOKIE_NAME}=${token}`,
          },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user?.id).toBe("cookie-user-888");
      expect(data.isGuest).toBe(false);
    });

    it("GET /api/auth/me falls back to guest profile when token is tampered", async () => {
      const token = createSessionToken({
        userId: "fake-user",
        email: "fake@flashai.io",
      });
      const tamperedToken = `${token}tampered`;

      const res = await meGet(
        new Request("http://localhost/api/auth/me", {
          method: "GET",
          headers: {
            Cookie: `${AUTH_COOKIE_NAME}=${tamperedToken}; ${USER_COOKIE_KEY}=guest-fallback-1`,
          },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      // Token rejected, falls back to guest cookie
      expect(data.user?.id).toBe("guest-fallback-1");
      expect(data.isGuest).toBe(true);
    });

    it("POST /api/auth/logout clears auth cookie and re-initializes fresh guest ID", async () => {
      const res = await logoutPost();
      expect(res.status).toBe(200);

      const authCookie = res.cookies.get(AUTH_COOKIE_NAME);
      const userCookie = res.cookies.get(USER_COOKIE_KEY);

      expect(authCookie?.value).toBe("");
      expect(authCookie?.maxAge).toBe(0);

      expect(userCookie?.value).toMatch(/^user-[a-f0-9-]+$/);
      expect(userCookie?.maxAge).toBe(365 * 24 * 60 * 60);
    });
  });

  // =========================================================================
  // 6. CONCURRENCY & ACCOUNT MERGE RACE CONDITIONS
  // =========================================================================
  describe("6. Concurrency & Replay Attack Resistance", () => {
    it("prevents single-use OTP replay when submitted twice sequentially", async () => {
      const email = "replay-seq@flashai.io";
      const code = "987654";
      await storeVerificationCode(email, code);

      const first = await verifyCodeAndLinkAccount({ email, code, currentUserId: "guest-a" });
      expect(first.success).toBe(true);

      const second = await verifyCodeAndLinkAccount({ email, code, currentUserId: "guest-b" });
      expect(second.success).toBe(false);
      expect(second.error).toContain("No active verification code found for this email, or code has expired.");
    });

    it("merges stats correctly between existing account and guest account", async () => {
      const email = "sync-stats@flashai.io";
      const existingId = "existing-account-1";
      const guestId = "guest-account-2";

      saveMemoryUser({
        id: existingId,
        email,
        isGuest: false,
        xp: 500,
        points: 500,
        streak: 12,
      });

      saveMemoryUser({
        id: guestId,
        isGuest: true,
        xp: 250,
        points: 250,
        streak: 15,
      });

      registerMemoryDeck("guest-deck-01", guestId);

      await storeVerificationCode(email, "333444");

      const res = await verifyCodeAndLinkAccount({
        email,
        code: "333444",
        currentUserId: guestId,
      });

      expect(res.success).toBe(true);
      expect(res.isMerged).toBe(true);
      expect(res.user?.id).toBe(existingId);
      expect(res.user?.xp).toBe(750); // 500 + 250
      expect(res.user?.points).toBe(750);
      expect(res.user?.streak).toBe(15); // max(12, 15)
      expect(res.user?.isGuest).toBe(false);
    });

    it("safely handles 10 concurrent requests attempting to redeem the exact same single-use code", async () => {
      const email = "race-otp@flashai.io";
      const code = "543210";
      await storeVerificationCode(email, code);

      // 10 concurrent verification requests
      const tasks = Array.from({ length: 10 }, (_, i) =>
        verifyCodeAndLinkAccount({
          email,
          code,
          currentUserId: `guest-concurrent-${i}`,
        })
      );

      const results = await Promise.all(tasks);

      // In Node.js single-threaded async execution, code deletion occurs synchronously after code validation.
      // Therefore, exactly one attempt must consume the code and succeed, or all sequential checks evaluate atomically.
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(9);
      for (const f of failed) {
        expect(f.error).toContain("No active verification code found for this email, or code has expired.");
      }
    });

    it("evaluates concurrent brute force attempts: prevents infinite bypass under concurrency", async () => {
      const email = "concurrent-bruteforce@flashai.io";
      const realCode = "777111";
      await storeVerificationCode(email, realCode);

      // Fire 15 invalid submissions concurrently
      const badTasks = Array.from({ length: 15 }, (_, i) =>
        verifyCodeAndLinkAccount({
          email,
          code: `00000${i}`,
          currentUserId: `attacker-${i}`,
        })
      );

      const results = await Promise.all(badTasks);
      // All invalid submissions must fail
      for (const res of results) {
        expect(res.success).toBe(false);
      }

      // Next attempt must definitely be locked out
      const postFloodAttempt = await verifyCodeAndLinkAccount({
        email,
        code: realCode,
        currentUserId: "attacker-followup",
      });
      expect(postFloodAttempt.success).toBe(false);
      expect(postFloodAttempt.error).toContain("Maximum verification attempts exceeded");
    });
  });
});
