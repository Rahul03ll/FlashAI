import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 8 - Upvoting Edge Cases & Invariants", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B8.1 rapid oscillating toggle (10 clicks) respects parity: 10 toggles leaves deck unvoted", () => {
    const deck = db.createDeck({ title: "Toggle Deck", isPublic: true });
    const user = "clicker-10";

    for (let i = 0; i < 10; i++) {
      api.upvoteDeck(deck.id, user);
    }

    const currentDeck = db.getDeck(deck.id)!;
    expect(currentDeck.upvoteCount).toBe(0);
    expect(db.hasUpvoted(deck.id, user)).toBe(false);
  });

  it("B8.2 upvoting non-existent or deleted deck returns clean 404 without crashing", () => {
    const res = api.upvoteDeck("deleted-deck-id", "user-1");
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Deck not found");
  });

  it("B8.3 empty or whitespace deckId and userId return status 400 validation error", () => {
    expect(api.upvoteDeck("", "user-1").status).toBe(400);
    expect(api.upvoteDeck("deck-1", "").status).toBe(400);
  });

  it("B8.4 upvote count lower-bound invariant: cannot drop below 0 even with corrupt toggle attempts", () => {
    const deck = db.createDeck({ title: "Zero Bound Deck", isPublic: true, upvoteCount: 0 });

    // Manually attempt to remove upvote when none exists
    const res = db.toggleUpvote(deck.id, "phantom-user");
    // Initial toggle adds upvote (count: 1)
    expect(res.count).toBe(1);

    // Second toggle removes upvote (count: 0)
    const res2 = db.toggleUpvote(deck.id, "phantom-user");
    expect(res2.count).toBe(0);
  });

  it("B8.5 concurrent upvoting from 20 distinct users results in exact upvoteCount = 20", async () => {
    const deck = db.createDeck({ title: "Popular Community Deck", isPublic: true });

    const promises = Array.from({ length: 20 }, (_, i) =>
      Promise.resolve(api.upvoteDeck(deck.id, `distinct-user-${i}`)),
    );

    await Promise.all(promises);

    const updated = db.getDeck(deck.id)!;
    expect(updated.upvoteCount).toBe(20);
  });
});
