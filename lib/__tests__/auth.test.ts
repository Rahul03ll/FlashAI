import { describe, it, expect, beforeEach } from "vitest";
import {
  generateOtp,
  checkSendCodeRateLimit,
  storeVerificationCode,
  verifyCodeAndLinkAccount,
  createSessionToken,
  verifySessionToken,
  saveMemoryUser,
  registerMemoryDeck,
  findUserById,
  findUserByEmail,
  resetAuthStore,
  MAX_VERIFY_ATTEMPTS,
  SEND_CODE_MAX_REQUESTS,
} from "@/lib/auth";

describe("lib/auth - Authentication and Identity Persistence Unit Tests", () => {
  beforeEach(() => {
    resetAuthStore();
  });

  describe("OTP Generation & Format", () => {
    it("generates a 6-digit numeric string", () => {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    });

    it("generates random codes across successive calls", () => {
      const codes = new Set(Array.from({ length: 15 }, () => generateOtp()));
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe("Send Code Rate Limiting", () => {
    it("allows up to 3 requests within the 10-minute window", () => {
      const email = "learner@example.com";

      const r1 = checkSendCodeRateLimit(email);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkSendCodeRateLimit(email);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkSendCodeRateLimit(email);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th request exceeds rate limit
      const r4 = checkSendCodeRateLimit(email);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.resetMs).toBeGreaterThan(0);
    });

    it("treats email normalization case-insensitively for rate limiting", () => {
      checkSendCodeRateLimit("STUDENT@FLASHAI.IO");
      checkSendCodeRateLimit("student@flashai.io");
      const r3 = checkSendCodeRateLimit("Student@FlashAI.io");
      expect(r3.allowed).toBe(true);

      const r4 = checkSendCodeRateLimit("student@flashai.io");
      expect(r4.allowed).toBe(false);
    });
  });

  describe("Verification Code Store & Validation", () => {
    it("stores and validates an OTP code", async () => {
      const email = "persist@example.com";
      const record = await storeVerificationCode(email, "654321");
      expect(record.email).toBe(email);
      expect(record.code).toBe("654321");

      const res = await verifyCodeAndLinkAccount({
        email,
        code: "654321",
        currentUserId: "guest-user-1",
      });

      expect(res.success).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user?.email).toBe(email);
      expect(res.user?.isGuest).toBe(false);
      expect(res.token).toBeDefined();
    });

    it("rejects invalid code and tracks attempt count", async () => {
      const email = "retry@example.com";
      await storeVerificationCode(email, "123456");

      const fail1 = await verifyCodeAndLinkAccount({
        email,
        code: "000000",
        currentUserId: "guest-user-2",
      });
      expect(fail1.success).toBe(false);
      expect(fail1.error).toContain("2 attempt(s) remaining");

      const fail2 = await verifyCodeAndLinkAccount({
        email,
        code: "000000",
        currentUserId: "guest-user-2",
      });
      expect(fail2.success).toBe(false);
      expect(fail2.error).toContain("1 attempt(s) remaining");

      const fail3 = await verifyCodeAndLinkAccount({
        email,
        code: "000000",
        currentUserId: "guest-user-2",
      });
      expect(fail3.success).toBe(false);
      expect(fail3.error).toContain("Maximum attempts reached");

      // 4th try rejected immediately due to max attempts
      const fail4 = await verifyCodeAndLinkAccount({
        email,
        code: "123456",
        currentUserId: "guest-user-2",
      });
      expect(fail4.success).toBe(false);
      expect(fail4.error).toContain("Maximum verification attempts exceeded");
    });

    it("invalidates code after successful verification preventing replay", async () => {
      const email = "replay@example.com";
      await storeVerificationCode(email, "777888");

      const firstTry = await verifyCodeAndLinkAccount({
        email,
        code: "777888",
        currentUserId: "guest-user-3",
      });
      expect(firstTry.success).toBe(true);

      const secondTry = await verifyCodeAndLinkAccount({
        email,
        code: "777888",
        currentUserId: "guest-user-3",
      });
      expect(secondTry.success).toBe(false);
      expect(secondTry.error).toContain("No active verification code found");
    });

    it("invalidates prior unverified codes and resets attempt count when a new code is requested", async () => {
      const email = "reset-lockout@example.com";
      await storeVerificationCode(email, "111222");

      // Exhaust 3 attempts on the first code
      for (let i = 0; i < 3; i++) {
        const fail = await verifyCodeAndLinkAccount({
          email,
          code: "000000",
          currentUserId: "guest-user-lockout",
        });
        expect(fail.success).toBe(false);
      }

      // Check user is currently locked out
      const lockedAttempt = await verifyCodeAndLinkAccount({
        email,
        code: "111222",
        currentUserId: "guest-user-lockout",
      });
      expect(lockedAttempt.success).toBe(false);
      expect(lockedAttempt.error).toContain("Maximum verification attempts exceeded");

      // User requests a new code
      const newRecord = await storeVerificationCode(email, "333444");
      expect(newRecord.code).toBe("333444");
      expect(newRecord.attempts).toBe(0);

      // Verifying with the new code immediately succeeds with fresh attempts
      const successAttempt = await verifyCodeAndLinkAccount({
        email,
        code: "333444",
        currentUserId: "guest-user-lockout",
      });
      expect(successAttempt.success).toBe(true);
      expect(successAttempt.user?.email).toBe(email);
    });

    it("normalizes email inputs with whitespace and casing across storage and verification", async () => {
      const untrimmedEmail = "  Student.Scholar@FlashAI.IO  ";
      const normalizedEmail = "student.scholar@flashai.io";

      await storeVerificationCode(untrimmedEmail, "654321");

      // Verify using different casing and spacing
      const verifyRes = await verifyCodeAndLinkAccount({
        email: "  STUDENT.SCHOLAR@flashai.io ",
        code: "654321",
        currentUserId: "guest-normalize-1",
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user?.email).toBe(normalizedEmail);

      // Lookup user with yet another casing/whitespace variation
      const foundUser = await findUserByEmail("   student.scholar@FLASHAI.io   ");
      expect(foundUser).not.toBeNull();
      expect(foundUser?.email).toBe(normalizedEmail);
    });
  });

  describe("Account Merging & Cross-Device Sync", () => {
    it("merges guest decks and stats into an existing account with the same email", async () => {
      const email = "shared@flashai.io";
      const existingUserId = "existing-user-100";
      const guestUserId = "guest-user-200";

      // 1. Existing user has 250 XP and 3 streak
      saveMemoryUser({
        id: existingUserId,
        name: "ExistingLearner",
        email,
        isGuest: false,
        xp: 250,
        points: 250,
        streak: 3,
      });

      // 2. Guest user studied offline and gained 100 XP and 5 streak
      saveMemoryUser({
        id: guestUserId,
        name: "GuestLearner",
        isGuest: true,
        xp: 100,
        points: 100,
        streak: 5,
      });

      // 3. Guest created a deck
      registerMemoryDeck("deck-guest-1", guestUserId);

      // 4. Guest enters code to link to existing email
      await storeVerificationCode(email, "999888");

      const res = await verifyCodeAndLinkAccount({
        email,
        code: "999888",
        currentUserId: guestUserId,
      });

      expect(res.success).toBe(true);
      expect(res.isMerged).toBe(true);
      expect(res.user?.id).toBe(existingUserId);
      expect(res.user?.xp).toBe(350); // 250 + 100
      expect(res.user?.points).toBe(350);
      expect(res.user?.streak).toBe(5); // max(3, 5)
      expect(res.user?.isGuest).toBe(false);
    });
  });

  describe("Session Token Generation & Verification", () => {
    it("creates and verifies a valid signed session token", () => {
      const token = createSessionToken({
        userId: "user-alpha-99",
        email: "alice@test.com",
        isGuest: false,
      });

      expect(token).toContain(".");
      const session = verifySessionToken(token);
      expect(session).toBeDefined();
      expect(session?.userId).toBe("user-alpha-99");
      expect(session?.email).toBe("alice@test.com");
      expect(session?.isGuest).toBe(false);
    });

    it("rejects tampered session tokens", () => {
      const token = createSessionToken({
        userId: "user-beta-01",
        email: "beta@test.com",
      });

      const parts = token.split(".");
      const tampered = `${parts[0]}xyz.${parts[1]}`;
      expect(verifySessionToken(tampered)).toBeNull();
    });

    it("rejects malformed tokens", () => {
      expect(verifySessionToken("not-a-token")).toBeNull();
      expect(verifySessionToken("")).toBeNull();
    });
  });
});
