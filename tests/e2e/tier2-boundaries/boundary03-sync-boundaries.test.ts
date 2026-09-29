import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 3 - Account Sync & Merge Boundary Cases", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B3.1 merging empty guest user (0 decks, 0 XP) leaves authenticated account intact", () => {
    const guestId = "guest-empty";
    api.bootstrapUser(guestId);

    const existingUser = db.createUser({
      id: "auth-established",
      email: "steady@example.com",
      xp: 500,
      streak: 7,
    });
    db.createDeck({ title: "My Existing Deck", userId: existingUser.id });

    api.sendOtpCode(existingUser.email!);
    const otp = db.getOtp(existingUser.email!)!;

    const res = api.verifyOtpCode(existingUser.email!, otp.code, guestId);
    expect(res.status).toBe(200);
    expect(res.data.user?.xp).toBe(500);
    expect(res.data.user?.streak).toBe(7);

    const decks = db.getDecksForUser(existingUser.id);
    expect(decks.length).toBe(1);
  });

  it("B3.2 merging when guest and authenticated user have identical deck titles preserves both", () => {
    const guestId = "guest-dupe-title";
    api.bootstrapUser(guestId);
    db.createDeck({ title: "Biology", userId: guestId });

    const authUser = db.createUser({
      id: "auth-dupe-user",
      email: "biologist@example.com",
    });
    db.createDeck({ title: "Biology", userId: authUser.id });

    api.sendOtpCode(authUser.email!);
    const otp = db.getOtp(authUser.email!)!;

    api.verifyOtpCode(authUser.email!, otp.code, guestId);

    const decks = db.getDecksForUser(authUser.id);
    expect(decks.length).toBe(2);
    expect(decks.every((d) => d.title === "Biology")).toBe(true);
  });

  it("B3.3 linking with unknown or already deleted guest ID gracefully creates/resolves user", () => {
    const email = "freshlink@example.com";
    api.sendOtpCode(email);
    const otp = db.getOtp(email)!;

    const res = api.verifyOtpCode(email, otp.code, "non-existent-guest-id");
    expect(res.status).toBe(200);
    expect(res.data.user?.email).toBe(email);
  });

  it("B3.4 re-linking verified user to same email does not create duplicate user records", () => {
    const email = "singleuser@example.com";
    api.sendOtpCode(email);
    const otp1 = db.getOtp(email)!;
    const res1 = api.verifyOtpCode(email, otp1.code);
    const userId = res1.data.user!.id;

    // Login again with fresh OTP
    api.sendOtpCode(email);
    const otp2 = db.getOtp(email)!;
    const res2 = api.verifyOtpCode(email, otp2.code, userId);

    expect(res2.status).toBe(200);
    expect(res2.data.user!.id).toBe(userId);

    const matchingUsers = Array.from(db.users.values()).filter((u) => u.email === email);
    expect(matchingUsers.length).toBe(1);
  });

  it("B3.5 large deck migration (guest with 20 decks) merges without data loss", () => {
    const guestId = "guest-prolific";
    api.bootstrapUser(guestId);

    for (let i = 0; i < 20; i++) {
      db.createDeck({ title: `Deck #${i + 1}`, userId: guestId });
    }

    const email = "prolific@example.com";
    api.sendOtpCode(email);
    const otp = db.getOtp(email)!;

    const res = api.verifyOtpCode(email, otp.code, guestId);
    expect(res.status).toBe(200);

    const mergedDecks = db.getDecksForUser(res.data.user!.id);
    expect(mergedDecks.length).toBe(20);
  });
});
