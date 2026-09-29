import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 8 - Community Deck Upvoting (R3)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("8.1 allows user to upvote public community deck and increments upvoteCount", () => {
    const deck = db.createDeck({ title: "Calculus Deep Dive", isPublic: true });
    const user = db.createUser({ id: "voter-1" });

    const res = api.upvoteDeck(deck.id, user.id);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.upvoted).toBe(true);
    expect(res.data.upvoteCount).toBe(1);

    const updatedDeck = db.getDeck(deck.id);
    expect(updatedDeck?.upvoteCount).toBe(1);
  });

  it("8.2 toggles upvote off when clicked a second time and decrements count", () => {
    const deck = db.createDeck({ title: "Organic Chemistry", isPublic: true });
    const user = db.createUser({ id: "voter-toggle" });

    // First upvote
    api.upvoteDeck(deck.id, user.id);

    // Second upvote (untoggles)
    const toggleRes = api.upvoteDeck(deck.id, user.id);
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.data.upvoted).toBe(false);
    expect(toggleRes.data.upvoteCount).toBe(0);

    expect(db.hasUpvoted(deck.id, user.id)).toBe(false);
  });

  it("8.3 prevents duplicate upvotes by same user on single deck", () => {
    const deck = db.createDeck({ title: "World History", isPublic: true });
    const user = db.createUser({ id: "voter-dup" });

    api.upvoteDeck(deck.id, user.id);
    expect(db.hasUpvoted(deck.id, user.id)).toBe(true);

    // Cannot have multiple upvotes from same user
    const upvotesCount = Array.from(db.upvotes).filter((k) => k === `${user.id}:${deck.id}`).length;
    expect(upvotesCount).toBe(1);
  });

  it("8.4 upvote count accurately reflects concurrent upvotes from multiple distinct users", () => {
    const deck = db.createDeck({ title: "Computer Architecture", isPublic: true });

    api.upvoteDeck(deck.id, "user-A");
    api.upvoteDeck(deck.id, "user-B");
    const resC = api.upvoteDeck(deck.id, "user-C");

    expect(resC.data.upvoteCount).toBe(3);
    const storedDeck = db.getDeck(deck.id);
    expect(storedDeck?.upvoteCount).toBe(3);
  });

  it("8.5 returns 404 error when attempting to upvote nonexistent deck", () => {
    const res = api.upvoteDeck("nonexistent-deck-id", "user-123");
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Deck not found");
  });

  it("8.6 requires valid deckId and userId parameters", () => {
    const res1 = api.upvoteDeck("", "user-1");
    expect(res1.status).toBe(400);

    const res2 = api.upvoteDeck("deck-1", "");
    expect(res2.status).toBe(400);
  });
});
