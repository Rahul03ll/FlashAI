import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 1 - Guest Profile & Onboarding (R1)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("1.1 instantly assigns a unique guest profile upon bootstrap", () => {
    const guestId = "guest-uuid-101";
    const res = api.bootstrapUser(guestId);

    expect(res.status).toBe(200);
    expect(res.data.user).toBeDefined();
    expect(res.data.user?.id).toBe(guestId);
    expect(res.data.user?.name).toMatch(/^Learner-[A-Z0-9]{4}$/);
  });

  it("1.2 initializes guest user with 0 XP, 0 streak, 0 points, and Beginner level", () => {
    const guestId = "guest-uuid-102";
    const res = api.bootstrapUser(guestId);

    expect(res.status).toBe(200);
    const user = res.data.user!;
    expect(user.xp).toBe(0);
    expect(user.streak).toBe(0);
    expect(user.points).toBe(0);
    expect(user.level).toBe("Beginner");
    expect(user.email).toBeNull();
  });

  it("1.3 is idempotent: re-requesting bootstrap with same ID preserves existing progress", () => {
    const guestId = "guest-uuid-103";
    api.bootstrapUser(guestId);

    // Simulate progress: user earns XP
    db.updateUser(guestId, { xp: 80, points: 80, streak: 3 });

    // Subsequent bootstrap
    const reRes = api.bootstrapUser(guestId);
    expect(reRes.status).toBe(200);
    expect(reRes.data.user?.xp).toBe(80);
    expect(reRes.data.user?.streak).toBe(3);
    expect(reRes.data.user?.points).toBe(80);
  });

  it("1.4 allows guest user to create a personal flashcard deck and add cards", () => {
    const guestId = "guest-uuid-104";
    api.bootstrapUser(guestId);

    const deck = db.createDeck({
      title: "Biology 101",
      userId: guestId,
      isPublic: false,
    });
    expect(deck.id).toBeDefined();
    expect(deck.userId).toBe(guestId);

    const card = db.createCard({
      deckId: deck.id,
      question: "What is mitochondria?",
      answer: "Powerhouse of the cell",
    });

    expect(card.id).toBeDefined();
    expect(card.deckId).toBe(deck.id);
    expect(card.ease).toBe(2.5);
    expect(card.interval).toBe(1);
    expect(card.repetitions).toBe(0);

    const userDecks = db.getDecksForUser(guestId);
    expect(userDecks.length).toBe(1);
    expect(userDecks[0].title).toBe("Biology 101");
  });

  it("1.5 allows guest user to customize their display name", () => {
    const guestId = "guest-uuid-105";
    api.bootstrapUser(guestId);

    db.updateUser(guestId, { displayName: "StudyNinja" });
    const user = db.getUser(guestId);
    expect(user?.displayName).toBe("StudyNinja");

    const meRes = api.getMe(guestId);
    expect(meRes.data.user?.displayName).toBe("StudyNinja");
    expect(meRes.data.isGuest).toBe(true);
  });

  it("1.6 rejects bootstrap with empty or whitespace-only userId", () => {
    const res1 = api.bootstrapUser("");
    expect(res1.status).toBe(400);
    expect(res1.data.error).toBeDefined();

    const res2 = api.bootstrapUser("   ");
    expect(res2.status).toBe(400);
    expect(res2.data.error).toBeDefined();
  });
});
