import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 2 - Email OTP Send & Verification (R1)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("2.1 generates 6-digit numeric OTP code for valid email", () => {
    const email = "learner@example.com";
    const res = api.sendOtpCode(email);

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.message).toContain("sent successfully");

    const otp = db.getOtp(email);
    expect(otp).toBeDefined();
    expect(otp?.code).toMatch(/^\d{6}$/);
  });

  it("2.2 sets 10-minute expiry time on generated OTP record", () => {
    const email = "timer@example.com";
    const now = Date.now();
    api.sendOtpCode(email, now);

    const otp = db.getOtp(email);
    expect(otp).toBeDefined();
    const expiryDiff = otp!.expiresAt.getTime() - now;
    expect(expiryDiff).toBe(10 * 60 * 1000);
  });

  it("2.3 successfully verifies valid OTP code and invalidates it after use", () => {
    const email = "verify@example.com";
    api.sendOtpCode(email);
    const otp = db.getOtp(email)!;

    const verifyRes = api.verifyOtpCode(email, otp.code);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.success).toBe(true);
    expect(verifyRes.data.user?.email).toBe(email);
    expect(verifyRes.data.token).toBeDefined();

    // Verify OTP was invalidated (deleted)
    const afterOtp = db.getOtp(email);
    expect(afterOtp).toBeNull();
  });

  it("2.4 rejects verification attempt with incorrect OTP code", () => {
    const email = "wrongcode@example.com";
    api.sendOtpCode(email);

    const verifyRes = api.verifyOtpCode(email, "000000");
    expect(verifyRes.status).toBe(400);
    expect(verifyRes.data.error).toContain("Incorrect");

    // Attempts incremented
    const otp = db.getOtp(email);
    expect(otp?.attempts).toBe(1);
  });

  it("2.5 rejects verification for non-existent or unrequested email", () => {
    const res = api.verifyOtpCode("unknown@example.com", "123456");
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("No active verification code");
  });

  it("2.6 rejects OTP generation for malformed email addresses", () => {
    const invalidEmails = ["notanemail", "@missinguser.com", "spaces in@mail.com", "plainaddress"];
    for (const badEmail of invalidEmails) {
      const res = api.sendOtpCode(badEmail);
      expect(res.status).toBe(400);
      expect(res.data.error).toContain("Invalid email format");
    }
  });
});
