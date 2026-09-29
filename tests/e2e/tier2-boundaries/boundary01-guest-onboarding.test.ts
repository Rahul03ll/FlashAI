import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 1 - Guest Onboarding Edge Cases", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B1.1 rejects empty string, whitespace-only, and tab-separated userIds with status 400", () => {
    const invalidIds = ["", "   ", "\t\t", "\n\r"];
    for (const badId of invalidIds) {
      const res = api.bootstrapUser(badId);
      expect(res.status).toBe(400);
      expect(res.data.error).toBeDefined();
    }
  });

  it("B1.2 safely handles extremely long userId (>300 characters)", () => {
    const longId = "user-" + "a".repeat(300);
    const res = api.bootstrapUser(longId);
    expect(res.status).toBe(200);
    expect(res.data.user?.id).toBe(longId);
  });

  it("B1.3 preserves Unicode, emojis, and special characters in userId", () => {
    const unicodeId = "user-🚀-studious-learner-日本語";
    const res = api.bootstrapUser(unicodeId);
    expect(res.status).toBe(200);
    expect(res.data.user?.id).toBe(unicodeId);
  });

  it("B1.4 concurrent bootstrap calls with identical guest ID resolve idempotently to the same user", async () => {
    const guestId = "guest-concurrent-id";
    const [res1, res2, res3] = await Promise.all([
      Promise.resolve(api.bootstrapUser(guestId)),
      Promise.resolve(api.bootstrapUser(guestId)),
      Promise.resolve(api.bootstrapUser(guestId)),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
    expect(res1.data.user?.id).toBe(guestId);
    expect(res2.data.user?.id).toBe(guestId);
    expect(res3.data.user?.id).toBe(guestId);

    // Verify only one user record in DB
    const allUsers = Array.from(db.users.values()).filter((u) => u.id === guestId);
    expect(allUsers.length).toBe(1);
  });

  it("B1.5 repeat bootstrap calls preserve custom display name and earned XP", () => {
    const guestId = "guest-preservation-test";
    api.bootstrapUser(guestId);
    db.updateUser(guestId, { displayName: "SuperScholar", xp: 150, points: 150 });

    const rebootstrap = api.bootstrapUser(guestId);
    expect(rebootstrap.data.user?.displayName).toBe("SuperScholar");
    expect(rebootstrap.data.user?.xp).toBe(150);
  });
});
