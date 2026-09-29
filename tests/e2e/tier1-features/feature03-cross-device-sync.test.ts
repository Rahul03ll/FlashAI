import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 3 - Cross-Device Account Linking & Merging (R1)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("3.1 links guest user profile with verified email address", () => {
    const guestId = "guest-sync-1";
    api.bootstrapUser(guestId);

    const email = "syncuser@example.com";
    api.sendOtpCode(email);
    const otp = db.getOtp(email)!;

    const verifyRes = api.verifyOtpCode(email, otp.code, guestId);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.id).toBe(guestId);
    expect(verifyRes.data.user?.email).toBe(email);

    const meRes = api.getMe(guestId);
    expect(meRes.data.isGuest).toBe(false);
    expect(meRes.data.user?.email).toBe(email);
  });

  it("3.2 migrates guest flashcard decks to authenticated user account", () => {
    const guestId = "guest-sync-decks";
    api.bootstrapUser(guestId);

    // Guest creates 2 decks
    const deck1 = db.createDeck({ title: "Deck 1", userId: guestId });
    const deck2 = db.createDeck({ title: "Deck 2", userId: guestId });
    db.createCard({ deckId: deck1.id, question: "Q1", answer: "A1" });
    db.createCard({ deckId: deck2.id, question: "Q2", answer: "A2" });

    // Existing authenticated user
    const existingUser = db.createUser({
      id: "auth-user-existing",
      email: "existing@example.com",
      name: "ExistingLearner",
    });

    api.sendOtpCode(existingUser.email!);
    const otp = db.getOtp(existingUser.email!)!;

    // Link guest into existing account
    const verifyRes = api.verifyOtpCode(existingUser.email!, otp.code, guestId);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.id).toBe(existingUser.id);

    // Verify decks migrated to existing account
    const mergedDecks = db.getDecksForUser(existingUser.id);
    expect(mergedDecks.length).toBe(2);
    expect(mergedDecks.map((d) => d.id).sort()).toEqual([deck1.id, deck2.id].sort());
  });

  it("3.3 merges guest XP and points into existing account without data loss", () => {
    const guestId = "guest-xp-merge";
    api.bootstrapUser(guestId);
    db.updateUser(guestId, { xp: 120, points: 120 });

    const existingUser = db.createUser({
      id: "auth-xp-account",
      email: "xpuser@example.com",
      xp: 250,
      points: 250,
    });

    api.sendOtpCode(existingUser.email!);
    const otp = db.getOtp(existingUser.email!)!;

    const verifyRes = api.verifyOtpCode(existingUser.email!, otp.code, guestId);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.xp).toBe(370);
    expect(verifyRes.data.user?.points).toBe(370);
  });

  it("3.4 preserves maximum streak when merging guest and authenticated account", () => {
    const guestId = "guest-streak-merge";
    api.bootstrapUser(guestId);
    db.updateUser(guestId, { streak: 12 });

    const existingUser = db.createUser({
      id: "auth-streak-account",
      email: "streakuser@example.com",
      streak: 5,
    });

    api.sendOtpCode(existingUser.email!);
    const otp = db.getOtp(existingUser.email!)!;

    const verifyRes = api.verifyOtpCode(existingUser.email!, otp.code, guestId);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.streak).toBe(12);
  });

  it("3.5 second device authenticating with same email retrieves the linked decks and progress", () => {
    const email = "crossdevice@example.com";
    const user = db.createUser({
      id: "user-cross-device",
      email,
      name: "DeviceExplorer",
      xp: 400,
      streak: 8,
    });
    db.createDeck({ title: "Physics Formulas", userId: user.id });

    // Device B signs in with email OTP
    api.sendOtpCode(email);
    const otp = db.getOtp(email)!;
    const verifyRes = api.verifyOtpCode(email, otp.code);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.id).toBe(user.id);
    expect(verifyRes.data.user?.xp).toBe(400);

    const decks = db.getDecksForUser(user.id);
    expect(decks.length).toBe(1);
    expect(decks[0].title).toBe("Physics Formulas");
  });

  it("3.6 session endpoint /api/auth/me verifies session token and guest status", () => {
    const user = db.createUser({
      id: "user-me-test",
      email: "metest@example.com",
      name: "MeTest",
    });

    const token = `session_${user.id}_12345678`;
    const meRes = api.getMe(token);

    expect(meRes.status).toBe(200);
    expect(meRes.data.isGuest).toBe(false);
    expect(meRes.data.user?.id).toBe(user.id);
    expect(meRes.data.user?.email).toBe("metest@example.com");
  });
});
