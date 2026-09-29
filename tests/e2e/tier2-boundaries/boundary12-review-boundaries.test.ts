import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 12 - Review Processing Boundaries & Permissions", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B12.1 reviewing non-existent cardId returns 404 cleanly", () => {
    const res = api.reviewCard("card-does-not-exist", "user-1", { quality: "good" });
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Card not found");
  });

  it("B12.2 reviewing someone else's deck card returns 403 Forbidden", () => {
    const owner = db.createUser({ id: "legit-owner" });
    const deck = db.createDeck({ title: "Secret Deck", userId: owner.id });
    const card = db.createCard({ deckId: deck.id, question: "Secret Q", answer: "Secret A" });

    const res = api.reviewCard(card.id, "unauthorized-viewer", { quality: "good" });
    expect(res.status).toBe(403);
    expect(res.data.error).toContain("Unauthorized");
  });

  it("B12.3 invalid quality values ('super', '123', empty string) return status 400", () => {
    const user = db.createUser({ id: "user-bad-q" });
    const deck = db.createDeck({ title: "Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    const badQualities = ["super", "123", "", "easy-peasy", null, undefined];
    for (const badQ of badQualities) {
      const res = api.reviewCard(card.id, user.id, { quality: badQ as any });
      expect(res.status).toBe(400);
      expect(res.data.error).toContain("Valid quality");
    }
  });

  it("B12.4 points threshold boundary: exact point 500 triggers level up from Beginner to Learner", () => {
    const user = db.createUser({ id: "border-learner", points: 490, xp: 490 });
    const deck = db.createDeck({ title: "Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    // Review with "easy" (+10 pts) -> exactly 500 points
    const res = api.reviewCard(card.id, user.id, { quality: "easy" });
    expect(res.status).toBe(200);
    expect(res.data.isLevelUp).toBe(true);

    const updated = db.getUser(user.id)!;
    expect(updated.points).toBe(500);
  });

  it("B12.5 points threshold boundary: exact point 2000 triggers level up to Master", () => {
    const user = db.createUser({ id: "border-master", points: 1990, xp: 1990 });
    const deck = db.createDeck({ title: "Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    // Review with "easy" (+10 pts) -> exactly 2000 points
    const res = api.reviewCard(card.id, user.id, { quality: "easy" });
    expect(res.status).toBe(200);
    expect(res.data.isLevelUp).toBe(true);

    const updated = db.getUser(user.id)!;
    expect(updated.points).toBe(2000);
  });
});
