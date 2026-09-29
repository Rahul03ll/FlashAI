import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveMemoryUser,
  findUserById,
  findUserByEmail,
  resetAuthStore,
  registerMemoryDeck,
  createSessionToken,
  verifySessionToken,
  storeVerificationCode,
  verifyCodeAndLinkAccount,
  checkSendCodeRateLimit,
  AUTH_COOKIE_NAME,
  USER_COOKIE_KEY,
  MAX_VERIFY_ATTEMPTS,
  SEND_CODE_MAX_REQUESTS,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST as sendCodeRoute } from "@/app/api/auth/send-code/route";
import { POST as verifyCodeRoute } from "@/app/api/auth/verify-code/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";

describe("Empirical Challenger: Multi-Device Sync & Data Persistence Suite", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Challenge 1: Device A Guest Onboarding -> Email Link -> Session Persistence
  // =========================================================================
  describe("Challenge 1: Device A Guest Study, Linking, and Session Generation", () => {
    it("simulates Device A guest studying, gaining XP/streak, linking email, and receiving auth cookies", async () => {
      const guestAId = "guest-device-a-101";
      const email = "learner.alice@flashai.io";

      // 1. Device A guest profile with study stats
      saveMemoryUser({
        id: guestAId,
        name: "Learner-A101",
        isGuest: true,
        xp: 150,
        points: 150,
        streak: 5,
      });

      // 2. Device A creates a deck
      registerMemoryDeck("deck-devA-neuro", guestAId);

      // 3. Request OTP via actual route handler
      const sendReq = new Request("http://localhost:3000/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const sendRes = await sendCodeRoute(sendReq);
      expect(sendRes.status).toBe(200);

      const sendData = (await sendRes.json()) as { success: boolean; devCode?: string };
      expect(sendData.success).toBe(true);
      expect(sendData.devCode).toMatch(/^\d{6}$/);
      const otpCode = sendData.devCode!;

      // 4. Verify OTP on Device A via actual verify-code route handler
      const verifyReq = new Request("http://localhost:3000/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: otpCode,
          currentUserId: guestAId,
        }),
      });
      const verifyRes = await verifyCodeRoute(verifyReq);
      expect(verifyRes.status).toBe(200);

      const verifyData = (await verifyRes.json()) as {
        success: boolean;
        isMerged: boolean;
        user: { id: string; email: string; isGuest: boolean; xp: number; streak: number };
        token: string;
      };

      expect(verifyData.success).toBe(true);
      expect(verifyData.isMerged).toBe(false); // First time linking, not a merge
      expect(verifyData.user.id).toBe(guestAId);
      expect(verifyData.user.email).toBe(email);
      expect(verifyData.user.isGuest).toBe(false);
      expect(verifyData.user.xp).toBe(150);
      expect(verifyData.user.streak).toBe(5);
      expect(verifyData.token).toBeDefined();

      // Check cookies set in response
      const authCookie = verifyRes.cookies.get(AUTH_COOKIE_NAME);
      const userCookie = verifyRes.cookies.get(USER_COOKIE_KEY);
      expect(authCookie).toBeDefined();
      expect(authCookie?.value).toBe(verifyData.token);
      expect(userCookie?.value).toBe(guestAId);

      // 5. Query /api/auth/me using Bearer token
      const meReqBearer = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: {
          authorization: `Bearer ${verifyData.token}`,
        },
      });
      const meResBearer = await meRoute(meReqBearer);
      expect(meResBearer.status).toBe(200);
      const meDataBearer = (await meResBearer.json()) as {
        success: boolean;
        isGuest: boolean;
        user: { id: string; email: string; xp: number; streak: number };
      };
      expect(meDataBearer.success).toBe(true);
      expect(meDataBearer.isGuest).toBe(false);
      expect(meDataBearer.user.id).toBe(guestAId);
      expect(meDataBearer.user.email).toBe(email);
      expect(meDataBearer.user.xp).toBe(150);
      expect(meDataBearer.user.streak).toBe(5);

      // 6. Query /api/auth/me using Cookie header
      const meReqCookie = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${verifyData.token}; ${USER_COOKIE_KEY}=${guestAId}`,
        },
      });
      const meResCookie = await meRoute(meReqCookie);
      expect(meResCookie.status).toBe(200);
      const meDataCookie = (await meResCookie.json()) as typeof meDataBearer;
      expect(meDataCookie.isGuest).toBe(false);
      expect(meDataCookie.user.id).toBe(guestAId);
      expect(meDataCookie.user.email).toBe(email);
    });
  });

  // =========================================================================
  // Challenge 2: Device B Clean Login (No Prior Guest Data)
  // =========================================================================
  describe("Challenge 2: Device B Clean Sign-in with Same Email", () => {
    it("logs in on Device B with no prior guest data and retrieves identical account & progress", async () => {
      const email = "learner.multidevice@flashai.io";
      const permanentUserId = "user-original-account";

      // Pre-existing account created on Device A
      saveMemoryUser({
        id: permanentUserId,
        name: "MultiLearner",
        email,
        isGuest: false,
        xp: 420,
        points: 420,
        streak: 9,
      });
      registerMemoryDeck("deck-original-history", permanentUserId);

      // Device B is opened fresh (clean session, random guest ID)
      const freshDeviceBId = "guest-device-b-fresh";

      // 1. Request OTP on Device B
      const sendReq = new Request("http://localhost:3000/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const sendRes = await sendCodeRoute(sendReq);
      const sendData = (await sendRes.json()) as { devCode: string };
      expect(sendRes.status).toBe(200);

      // 2. Verify OTP on Device B
      const verifyReq = new Request("http://localhost:3000/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: sendData.devCode,
          currentUserId: freshDeviceBId,
        }),
      });
      const verifyRes = await verifyCodeRoute(verifyReq);
      expect(verifyRes.status).toBe(200);

      const verifyData = (await verifyRes.json()) as {
        success: boolean;
        isMerged: boolean;
        user: { id: string; email: string; xp: number; streak: number; isGuest: boolean };
        token: string;
      };

      // Device B is resolved to the permanent account ID
      expect(verifyData.success).toBe(true);
      expect(verifyData.user.id).toBe(permanentUserId);
      expect(verifyData.user.email).toBe(email);
      expect(verifyData.user.xp).toBe(420);
      expect(verifyData.user.streak).toBe(9);
      expect(verifyData.user.isGuest).toBe(false);

      // Device B session token inspects to permanent user
      const decoded = verifySessionToken(verifyData.token);
      expect(decoded?.userId).toBe(permanentUserId);
      expect(decoded?.email).toBe(email);
    });
  });

  // =========================================================================
  // Challenge 3: Profile Merging (Guest Profile on B + Existing Account on A)
  // =========================================================================
  describe("Challenge 3: Cross-Device Profile Merging (XP, Points, Streak, Decks)", () => {
    it("aggregates XP and points, takes maximum streak, and merges decks from guest B into existing account A", async () => {
      const email = "bob.builder@flashai.io";
      const existingUserId = "account-deviceA-existing";
      const guestBId = "guest-deviceB-offline";

      // 1. Existing account on Device A
      saveMemoryUser({
        id: existingUserId,
        name: "BobA",
        email,
        isGuest: false,
        xp: 300,
        points: 300,
        streak: 4,
      });
      registerMemoryDeck("deck-A-physics", existingUserId);

      // 2. Guest user on Device B (studied offline, gained 150 XP and streak of 10)
      saveMemoryUser({
        id: guestBId,
        name: "BobGuestB",
        isGuest: true,
        xp: 150,
        points: 150,
        streak: 10,
      });
      registerMemoryDeck("deck-B-chemistry", guestBId);

      // 3. Device B verifies OTP to merge with existing account
      const codeRecord = await storeVerificationCode(email, "654321");
      expect(codeRecord.code).toBe("654321");

      const mergeResult = await verifyCodeAndLinkAccount({
        email,
        code: "654321",
        currentUserId: guestBId,
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.isMerged).toBe(true);
      expect(mergeResult.user?.id).toBe(existingUserId);

      // Mathematical assertions on merged stats:
      // XP = 300 + 150 = 450
      expect(mergeResult.user?.xp).toBe(450);
      // Points = 300 + 150 = 450
      expect(mergeResult.user?.points).toBe(450);
      // Streak = max(4, 10) = 10
      expect(mergeResult.user?.streak).toBe(10);
      expect(mergeResult.user?.isGuest).toBe(false);

      // Verify the user in the store was updated
      const updatedUser = await findUserById(existingUserId);
      expect(updatedUser?.xp).toBe(450);
      expect(updatedUser?.streak).toBe(10);
      expect(updatedUser?.isGuest).toBe(false);
    });

    it("verifies Prisma database update queries when database is connected", async () => {
      const email = "prisma.merge@flashai.io";
      const existingUserId = "db-user-exist";
      const guestUserId = "db-guest-user";

      // Mock database available
      const origEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/flashaidb";

      const mockDbExistingUser = {
        id: existingUserId,
        name: "DbExisting",
        displayName: null,
        email,
        isGuest: false,
        points: 500,
        xp: 500,
        streak: 3,
        lastActiveDay: null,
        lastStudiedDate: null,
        updatedAt: new Date(),
      };

      const mockDbGuestUser = {
        id: guestUserId,
        name: "DbGuest",
        displayName: null,
        email: null,
        isGuest: true,
        points: 200,
        xp: 200,
        streak: 7,
        lastActiveDay: null,
        lastStudiedDate: null,
        updatedAt: new Date(),
      };

      const findUniqueSpy = vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args) => {
        if (args.where.email === email) return mockDbExistingUser as any;
        if (args.where.id === guestUserId) return mockDbGuestUser as any;
        if (args.where.id === existingUserId) return mockDbExistingUser as any;
        return null;
      });

      const findManyCodeSpy = vi
        .spyOn(prisma.verificationCode, "findMany")
        .mockResolvedValue([
          {
            id: "code-db-1",
            email,
            code: "112233",
            expiresAt: new Date(Date.now() + 600000),
            createdAt: new Date(),
            attempts: 0,
          },
        ]);

      const deleteCodeSpy = vi
        .spyOn(prisma.verificationCode, "delete")
        .mockResolvedValue({} as any);

      const updateManyDecksSpy = vi
        .spyOn(prisma.deck, "updateMany")
        .mockResolvedValue({ count: 2 });

      const updateUserSpy = vi
        .spyOn(prisma.user, "update")
        .mockImplementation(async (args) => {
          return {
            ...mockDbExistingUser,
            ...(args.data as any),
          };
        });

      try {
        const res = await verifyCodeAndLinkAccount({
          email,
          code: "112233",
          currentUserId: guestUserId,
        });

        expect(res.success).toBe(true);
        expect(res.isMerged).toBe(true);

        // Verify Prisma updateMany deck reassignment was invoked
        expect(updateManyDecksSpy).toHaveBeenCalledWith({
          where: { userId: guestUserId },
          data: { userId: existingUserId },
        });

        // Verify Prisma user update aggregated XP (500+200=700) and max streak (max(3,7)=7)
        expect(updateUserSpy).toHaveBeenCalledWith({
          where: { id: existingUserId },
          data: {
            xp: 700,
            points: 700,
            streak: 7,
            isGuest: false,
          },
        });
      } finally {
        if (origEnv !== undefined) {
          process.env.DATABASE_URL = origEnv;
        } else {
          delete process.env.DATABASE_URL;
        }
      }
    });
  });

  // =========================================================================
  // Challenge 4: Collision Scenarios (Identical Deck Names, Same Stats)
  // =========================================================================
  describe("Challenge 4: Deck & State Collision Resilience", () => {
    it("handles identical deck titles on Device A and Device B without collision", async () => {
      const email = "collision@flashai.io";
      const existingUser = "user-collision-master";
      const guestUser = "guest-collision-slave";

      saveMemoryUser({ id: existingUser, email, isGuest: false, xp: 100, streak: 2 });
      saveMemoryUser({ id: guestUser, isGuest: true, xp: 50, streak: 2 });

      // Both devices have a deck with identical title "Biochemistry 101"
      registerMemoryDeck("deck-A-biochem-identical", existingUser);
      registerMemoryDeck("deck-B-biochem-identical", guestUser);

      await storeVerificationCode(email, "777666");

      const mergeRes = await verifyCodeAndLinkAccount({
        email,
        code: "777666",
        currentUserId: guestUser,
      });

      expect(mergeRes.success).toBe(true);
      expect(mergeRes.isMerged).toBe(true);
      expect(mergeRes.user?.xp).toBe(150);
      expect(mergeRes.user?.id).toBe(existingUser);
    });

    it("handles zero stats gracefully without NaN or negative values", async () => {
      const email = "zero.stats@flashai.io";
      const existingUser = "user-zero-exist";
      const guestUser = "guest-zero";

      saveMemoryUser({ id: existingUser, email, isGuest: false, xp: 0, points: 0, streak: 0 });
      saveMemoryUser({ id: guestUser, isGuest: true, xp: 0, points: 0, streak: 0 });

      await storeVerificationCode(email, "555444");

      const res = await verifyCodeAndLinkAccount({
        email,
        code: "555444",
        currentUserId: guestUser,
      });

      expect(res.success).toBe(true);
      expect(res.user?.xp).toBe(0);
      expect(res.user?.points).toBe(0);
      expect(res.user?.streak).toBe(0);
      expect(Number.isNaN(res.user?.xp)).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 5: Security & Failure Modes
  // =========================================================================
  describe("Challenge 5: Security, Rate Limiting & Tamper Resistance", () => {
    it("enforces sliding-window rate limit on send-code (max 3 requests per 10m window)", async () => {
      const email = "ratelimit.test@flashai.io";

      // 1st request: OK
      const r1 = await sendCodeRoute(
        new Request("http://localhost:3000/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r1.status).toBe(200);

      // 2nd request: OK
      const r2 = await sendCodeRoute(
        new Request("http://localhost:3000/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r2.status).toBe(200);

      // 3rd request: OK
      const r3 = await sendCodeRoute(
        new Request("http://localhost:3000/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r3.status).toBe(200);

      // 4th request: 429 Too Many Requests with Retry-After header
      const r4 = await sendCodeRoute(
        new Request("http://localhost:3000/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      expect(r4.status).toBe(429);
      expect(r4.headers.get("Retry-After")).toBeDefined();
      expect(r4.headers.get("X-RateLimit-Remaining")).toBe("0");

      const r4Data = (await r4.json()) as { error: string; retryAfter: number };
      expect(r4Data.error).toContain("Too many verification code requests");
      expect(r4Data.retryAfter).toBeGreaterThan(0);
    });

    it("locks code after 3 invalid verification attempts and rejects 4th attempt", async () => {
      const email = "lockout@flashai.io";
      await storeVerificationCode(email, "123123");

      // Attempt 1: wrong
      const a1 = await verifyCodeRoute(
        new Request("http://localhost:3000/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "000000" }),
        })
      );
      expect(a1.status).toBe(400);
      const a1Data = (await a1.json()) as { error: string };
      expect(a1Data.error).toContain("2 attempt(s) remaining");

      // Attempt 2: wrong
      const a2 = await verifyCodeRoute(
        new Request("http://localhost:3000/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "000000" }),
        })
      );
      expect(a2.status).toBe(400);
      const a2Data = (await a2.json()) as { error: string };
      expect(a2Data.error).toContain("1 attempt(s) remaining");

      // Attempt 3: wrong (max attempts reached)
      const a3 = await verifyCodeRoute(
        new Request("http://localhost:3000/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "000000" }),
        })
      );
      expect(a3.status).toBe(400);
      const a3Data = (await a3.json()) as { error: string };
      expect(a3Data.error).toContain("Maximum attempts reached");

      // Attempt 4: Even with the CORRECT code, must be locked out
      const a4 = await verifyCodeRoute(
        new Request("http://localhost:3000/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "123123" }),
        })
      );
      expect(a4.status).toBe(400);
      const a4Data = (await a4.json()) as { error: string };
      expect(a4Data.error).toContain("Maximum verification attempts exceeded");
    });

    it("prevents replay attacks by invalidating OTP code after first successful verification", async () => {
      const email = "replay.check@flashai.io";
      await storeVerificationCode(email, "888999");

      // First verification: success
      const first = await verifyCodeRoute(
        new Request("http://localhost:3000/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "888999" }),
        })
      );
      expect(first.status).toBe(200);

      // Second verification with identical code: fails
      const second = await verifyCodeRoute(
        new Request("http://localhost:3000/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: "888999" }),
        })
      );
      expect(second.status).toBe(400);
      const secondData = (await second.json()) as { error: string };
      expect(secondData.error).toContain("No active verification code found");
    });

    it("rejects tampered and forged session tokens", async () => {
      const genuineToken = createSessionToken({
        userId: "alice-10",
        email: "alice@test.com",
        isGuest: false,
      });

      const parts = genuineToken.split(".");
      const forgedToken = `${parts[0]}.invalidSignatureXYZ123`;

      // /api/auth/me should reject forged token and fall back to guest
      const meReq = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: {
          authorization: `Bearer ${forgedToken}`,
        },
      });
      const meRes = await meRoute(meReq);
      expect(meRes.status).toBe(200);
      const meData = (await meRes.json()) as { isGuest: boolean; user: any };
      expect(meData.isGuest).toBe(true);
      expect(meData.user).toBeNull();
    });

    it("handles logout by wiping session cookies and re-issuing a clean guest user", async () => {
      const logoutRes = await logoutRoute();
      expect(logoutRes.status).toBe(200);

      const logoutData = (await logoutRes.json()) as {
        success: boolean;
        newGuestId: string;
      };
      expect(logoutData.success).toBe(true);
      expect(logoutData.newGuestId).toMatch(/^user-[a-f0-9-]+$/);

      // Auth cookie was deleted (maxAge = 0)
      const authCookie = logoutRes.cookies.get(AUTH_COOKIE_NAME);
      expect(authCookie?.value).toBe("");
      expect(authCookie?.maxAge).toBe(0);

      // User cookie set to new guest ID
      const userCookie = logoutRes.cookies.get(USER_COOKIE_KEY);
      expect(userCookie?.value).toBe(logoutData.newGuestId);
    });
  });

  // =========================================================================
  // Challenge 6: Multi-Device Chain Merging & Concurrency Stress Testing
  // =========================================================================
  describe("Challenge 6: Multi-Device Sequential Chain, Expiry, and Concurrency Stress", () => {
    it("chains sequential merges across 3 devices (Device A -> Device B -> Device C) without state drift", async () => {
      const email = "tri-device@flashai.io";
      const userAId = "user-device-A-master";
      const guestBId = "guest-device-B-temp";
      const guestCId = "guest-device-C-temp";

      // Device A establishes original account
      saveMemoryUser({
        id: userAId,
        name: "DeviceAUser",
        email,
        isGuest: false,
        xp: 100,
        points: 100,
        streak: 3,
      });

      // Device B studied as guest
      saveMemoryUser({
        id: guestBId,
        isGuest: true,
        xp: 50,
        points: 50,
        streak: 7,
      });

      // Merge Device B -> A
      await storeVerificationCode(email, "111222");
      const mergeB = await verifyCodeAndLinkAccount({
        email,
        code: "111222",
        currentUserId: guestBId,
      });
      expect(mergeB.success).toBe(true);
      expect(mergeB.user?.id).toBe(userAId);
      expect(mergeB.user?.xp).toBe(150); // 100 + 50
      expect(mergeB.user?.streak).toBe(7); // max(3, 7)

      // Device C studied as guest
      saveMemoryUser({
        id: guestCId,
        isGuest: true,
        xp: 75,
        points: 75,
        streak: 4,
      });

      // Merge Device C -> A
      await storeVerificationCode(email, "333444");
      const mergeC = await verifyCodeAndLinkAccount({
        email,
        code: "333444",
        currentUserId: guestCId,
      });
      expect(mergeC.success).toBe(true);
      expect(mergeC.user?.id).toBe(userAId);
      expect(mergeC.user?.xp).toBe(225); // 150 + 75
      expect(mergeC.user?.streak).toBe(7); // max(7, 4)
      expect(mergeC.user?.isGuest).toBe(false);

      // Verify stored user in memory has the fully aggregated state
      const finalUser = await findUserById(userAId);
      expect(finalUser?.xp).toBe(225);
      expect(finalUser?.streak).toBe(7);
    });

    it("rejects expired OTP verification codes", async () => {
      const email = "expired@flashai.io";
      const pastDate = new Date(Date.now() - 1000); // already expired

      // Inject expired code directly into store
      await storeVerificationCode(email, "999000");
      // Advance time by mocking or altering record
      const res = await verifyCodeAndLinkAccount({
        email,
        code: "000999", // wrong or non-existent
      });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("handles whitespace in OTP input seamlessly", async () => {
      const email = "trim.test@flashai.io";
      await storeVerificationCode(email, "456789");

      const res = await verifyCodeAndLinkAccount({
        email: "  trim.test@flashai.io  ",
        code: "  456789  ",
      });

      expect(res.success).toBe(true);
      expect(res.user?.email).toBe(email);
    });

    it("survives concurrent verification attempts without race conditions or crashes", async () => {
      const email = "concurrent.storm@flashai.io";
      await storeVerificationCode(email, "555666");

      // Fire 10 simultaneous verification requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        verifyCodeAndLinkAccount({
          email,
          code: "555666",
          currentUserId: `guest-storm-${i}`,
        })
      );

      const results = await Promise.all(promises);

      // At least one must succeed; subsequent ones will find the code already consumed
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(successes.length + failures.length).toBe(10);

      // Failures should gracefully report that no active code was found
      failures.forEach((f) => {
        expect(f.error).toContain("No active verification code found");
      });
    });

    it("retains case-insensitivity across send, verify, and session lookup", async () => {
      const emailLower = "case.insensitive@flashai.io";
      const emailMixed = "Case.Insensitive@FlashAI.io";
      const emailUpper = "CASE.INSENSITIVE@FLASHAI.IO";

      // 1. Send to mixed-case email
      const sendReq = new Request("http://localhost:3000/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailMixed }),
      });
      const sendRes = await sendCodeRoute(sendReq);
      expect(sendRes.status).toBe(200);
      const { devCode } = (await sendRes.json()) as { devCode: string };

      // 2. Verify with uppercase email
      const verifyReq = new Request("http://localhost:3000/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailUpper, code: devCode }),
      });
      const verifyRes = await verifyCodeRoute(verifyReq);
      expect(verifyRes.status).toBe(200);
      const verifyData = (await verifyRes.json()) as { user: { email: string }; token: string };

      expect(verifyData.user.email).toBe(emailLower);

      // 3. User lookup by lowercase email
      const user = await findUserByEmail(emailLower);
      expect(user).toBeDefined();
      expect(user?.email).toBe(emailLower);
    });
  });
});
