import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 12 - Atomic Review Processing (R4)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("12.1 atomic review updates card SM-2 state, user XP, and streak in single transaction", () => {
    const user = db.createUser({ id: "reviewer-1", xp: 0, streak: 0, points: 0 });
    const deck = db.createDeck({ title: "Study Set", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    const res = api.reviewCard(card.id, user.id, { quality: "good" });
    expect(res.status).toBe(200);
    expect(res.data.gainedXp).toBe(5);
    expect(res.data.currentStreak).toBe(1);
    expect(res.data.card).toBeDefined();

    // Verify DB state
    const updatedUser = db.getUser(user.id)!;
    expect(updatedUser.xp).toBe(5);
    expect(updatedUser.streak).toBe(1);

    const updatedCard = db.getCard(card.id)!;
    expect(updatedCard.repetitions).toBe(1);
  });

  it("12.2 awards correct XP based on rating quality (hard: 2, good: 5, easy: 10)", () => {
    const user = db.createUser({ id: "reviewer-xp" });
    const deck = db.createDeck({ title: "XP Deck", userId: user.id });

    const c1 = db.createCard({ deckId: deck.id, question: "Q1", answer: "A1" });
    const c2 = db.createCard({ deckId: deck.id, question: "Q2", answer: "A2" });
    const c3 = db.createCard({ deckId: deck.id, question: "Q3", answer: "A3" });

    const rHard = api.reviewCard(c1.id, user.id, { quality: "hard" });
    expect(rHard.data.gainedXp).toBe(2);

    const rGood = api.reviewCard(c2.id, user.id, { quality: "good" });
    expect(rGood.data.gainedXp).toBe(5);

    const rEasy = api.reviewCard(c3.id, user.id, { quality: "easy" });
    expect(rEasy.data.gainedXp).toBe(10);
  });

  it("12.3 increments user study streak upon successful card review", () => {
    const user = db.createUser({ id: "streak-tester", streak: 4 });
    const deck = db.createDeck({ title: "Streak Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    const res = api.reviewCard(card.id, user.id, { quality: "good" });
    expect(res.data.currentStreak).toBe(5);
  });

  it("12.4 detects and returns isLevelUp: true when XP threshold is crossed", () => {
    // Beginner -> Learner at 500 points
    const user = db.createUser({ id: "levelup-user", points: 495, xp: 495 });
    const deck = db.createDeck({ title: "Level Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    // Review with "easy" (+10 pts) -> 505 pts -> level up to Learner
    const res = api.reviewCard(card.id, user.id, { quality: "easy" });
    expect(res.status).toBe(200);
    expect(res.data.isLevelUp).toBe(true);

    const updatedUser = db.getUser(user.id)!;
    expect(updatedUser.points).toBe(505);
  });

  it("12.5 rejects review if card does not belong to requesting user (403 Forbidden)", () => {
    const owner = db.createUser({ id: "real-owner" });
    const imposter = db.createUser({ id: "imposter-user" });

    const deck = db.createDeck({ title: "Private Deck", userId: owner.id });
    const card = db.createCard({ deckId: deck.id, question: "Private Q", answer: "Private A" });

    const res = api.reviewCard(card.id, imposter.id, { quality: "easy" });
    expect(res.status).toBe(403);
    expect(res.data.error).toContain("Unauthorized");
  });

  it("12.6 rejects review with invalid quality value (400 Bad Request)", () => {
    const user = db.createUser({ id: "bad-quality-user" });
    const deck = db.createDeck({ title: "Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    const res = api.reviewCard(card.id, user.id, { quality: "super-easy" as any });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("Valid quality");
  });
});
