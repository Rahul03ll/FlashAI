import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 2 - OTP Generation & Verification Boundaries", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B2.1 strictly rejects OTP verification after 10-minute expiry window passes", () => {
    const email = "expired@example.com";
    const t0 = 1_000_000;
    api.sendOtpCode(email, t0);
    const otp = db.getOtp(email)!;

    // 1 millisecond past 10 minutes (10 * 60 * 1000 = 600,000 ms)
    const tExpired = t0 + 600_001;
    const res = api.verifyOtpCode(email, otp.code, undefined, tExpired);

    expect(res.status).toBe(400);
    expect(res.data.error).toContain("expired");
    // Verify OTP record was cleaned up
    expect(db.getOtp(email)).toBeNull();
  });

  it("B2.2 rejects non-numeric or malformed OTP codes", () => {
    const email = "format@example.com";
    api.sendOtpCode(email);

    const malformedCodes = ["abcdef", "12a456", "12345", "1234567", "", " "];
    for (const badCode of malformedCodes) {
      const res = api.verifyOtpCode(email, badCode);
      expect(res.status).toBe(400);
    }
  });

  it("B2.3 locks out verification after 5 consecutive failed attempts and returns 429", () => {
    const email = "bruteforce@example.com";
    api.sendOtpCode(email);

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const failRes = api.verifyOtpCode(email, "999999");
      expect(failRes.status).toBe(400);
    }

    // 6th attempt should trigger lockout
    const lockoutRes = api.verifyOtpCode(email, "999999");
    expect(lockoutRes.status).toBe(429);
    expect(lockoutRes.data.error).toContain("Too many failed attempts");
    expect(db.getOtp(email)).toBeNull();
  });

  it("B2.4 rejects reuse of previously verified OTP code", () => {
    const email = "reuse@example.com";
    api.sendOtpCode(email);
    const code = db.getOtp(email)!.code;

    // First verification succeeds
    const res1 = api.verifyOtpCode(email, code);
    expect(res1.status).toBe(200);

    // Second verification with same code fails
    const res2 = api.verifyOtpCode(email, code);
    expect(res2.status).toBe(400);
    expect(res2.data.error).toContain("No active verification code");
  });

  it("B2.5 treats email addresses case-insensitively during OTP lifecycle", () => {
    const mixedEmail = "CaseSensitiveUser@Example.COM";
    const lowerEmail = "casesensitiveuser@example.com";

    api.sendOtpCode(mixedEmail);
    const code = db.getOtp(mixedEmail)!.code;

    // Verify using lowercase
    const verifyRes = api.verifyOtpCode(lowerEmail, code);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.email).toBe(lowerEmail);
  });
});
