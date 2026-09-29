import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 9 - Bookmarking Boundaries & Stress Cases", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B9.1 bookmarking non-existent deck returns 404 cleanly", () => {
    const res = api.bookmarkDeck("ghost-deck", "user-1");
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Deck not found");
  });

  it("B9.2 double bookmark toggle returns to unbookmarked state cleanly", () => {
    const deck = db.createDeck({ title: "Double Toggle Deck", isPublic: true });
    const user = "bookmarker-2";

    api.bookmarkDeck(deck.id, user);
    const unmark = api.bookmarkDeck(deck.id, user);

    expect(unmark.status).toBe(200);
    expect(unmark.data.bookmarked).toBe(false);
    expect(db.hasBookmarked(deck.id, user)).toBe(false);
  });

  it("B9.3 user bookmarking 30 decks retains all 30 bookmarks without truncation", () => {
    const user = "avid-reader";
    const createdDecks = Array.from({ length: 30 }, (_, i) =>
      db.createDeck({ title: `Community Deck #${i}`, isPublic: true }),
    );

    for (const d of createdDecks) {
      api.bookmarkDeck(d.id, user);
    }

    const saved = db.getBookmarkedDecks(user);
    expect(saved.length).toBe(30);
  });

  it("B9.4 fetching bookmarks for brand new user with 0 bookmarks returns empty array", () => {
    const emptyList = db.getBookmarkedDecks("newbie-zero-bookmarks");
    expect(emptyList).toEqual([]);
  });

  it("B9.5 handles deckIds with hyphens, underscores, and UUIDs seamlessly", () => {
    const complexId = "deck-uuid-9f1c34a2_v2.0";
    const deck = db.createDeck({ id: complexId, title: "Special ID Deck", isPublic: true });

    const res = api.bookmarkDeck(deck.id, "user-special");
    expect(res.status).toBe(200);
    expect(res.data.bookmarked).toBe(true);
    expect(db.hasBookmarked(complexId, "user-special")).toBe(true);
  });
});
