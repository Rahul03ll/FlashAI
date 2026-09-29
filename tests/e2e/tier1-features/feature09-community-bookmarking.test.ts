import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 9 - Community Deck Bookmarking (R3)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("9.1 adds public deck to user's saved bookmark collection", () => {
    const deck = db.createDeck({ title: "Neuroscience Fundamentals", isPublic: true });
    const user = db.createUser({ id: "scholar-1" });

    const res = api.bookmarkDeck(deck.id, user.id);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.bookmarked).toBe(true);

    expect(db.hasBookmarked(deck.id, user.id)).toBe(true);
  });

  it("9.2 toggles bookmark off when requested a second time", () => {
    const deck = db.createDeck({ title: "Quantum Mechanics", isPublic: true });
    const user = db.createUser({ id: "scholar-toggle" });

    api.bookmarkDeck(deck.id, user.id);
    const unbookmark = api.bookmarkDeck(deck.id, user.id);

    expect(unbookmark.status).toBe(200);
    expect(unbookmark.data.bookmarked).toBe(false);
    expect(db.hasBookmarked(deck.id, user.id)).toBe(false);
  });

  it("9.3 retrieves user's bookmarked decks accurately", () => {
    const user = db.createUser({ id: "scholar-collector" });
    const d1 = db.createDeck({ title: "Deck A", isPublic: true });
    const d2 = db.createDeck({ title: "Deck B", isPublic: true });
    const d3 = db.createDeck({ title: "Deck C", isPublic: true });

    api.bookmarkDeck(d1.id, user.id);
    api.bookmarkDeck(d3.id, user.id);

    const bookmarks = db.getBookmarkedDecks(user.id);
    expect(bookmarks.length).toBe(2);
    const titles = bookmarks.map((d) => d.title).sort();
    expect(titles).toEqual(["Deck A", "Deck C"]);
  });

  it("9.4 bookmarking does not mutate original deck title, cards, or public visibility", () => {
    const deck = db.createDeck({ title: "Linear Algebra", isPublic: true });
    db.createCard({ deckId: deck.id, question: "What is an eigenvalue?", answer: "Scalar lambda..." });

    api.bookmarkDeck(deck.id, "user-bookmark-pure");
    const freshDeck = db.getDeck(deck.id);

    expect(freshDeck?.title).toBe("Linear Algebra");
    expect(freshDeck?.isPublic).toBe(true);
    expect(freshDeck?.cards.length).toBe(1);
  });

  it("9.5 returns 404 when attempting to bookmark non-existent deck", () => {
    const res = api.bookmarkDeck("nonexistent-deck", "user-123");
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Deck not found");
  });

  it("9.6 multiple users can bookmark the same deck independently", () => {
    const deck = db.createDeck({ title: "Shared Knowledge Deck", isPublic: true });

    api.bookmarkDeck(deck.id, "user-1");
    api.bookmarkDeck(deck.id, "user-2");

    expect(db.hasBookmarked(deck.id, "user-1")).toBe(true);
    expect(db.hasBookmarked(deck.id, "user-2")).toBe(true);

    // User 1 unbookmarks without affecting User 2
    api.bookmarkDeck(deck.id, "user-1");
    expect(db.hasBookmarked(deck.id, "user-1")).toBe(false);
    expect(db.hasBookmarked(deck.id, "user-2")).toBe(true);
  });
});
