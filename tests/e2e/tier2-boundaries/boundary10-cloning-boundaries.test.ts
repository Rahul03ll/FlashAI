import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 2: Boundary 10 - Deck Cloning Boundaries & Extreme Sizes", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("B10.1 cloning deck with 0 flashcards succeeds and creates empty cloned deck", () => {
    const emptyDeck = db.createDeck({ title: "Empty Template Deck", isPublic: true });
    const cloneRes = api.cloneDeck(emptyDeck.id, "cloner-empty");

    expect(cloneRes.status).toBe(200);
    expect(cloneRes.data.cardCount).toBe(0);

    const clonedDeck = db.getDeck(cloneRes.data.deckId!)!;
    expect(clonedDeck.cards.length).toBe(0);
  });

  it("B10.2 cloning deck with 50 flashcards clones all 50 cards with correct associations", () => {
    const bigDeck = db.createDeck({ title: "Medical Terminology 1000", isPublic: true });
    for (let i = 0; i < 50; i++) {
      db.createCard({ deckId: bigDeck.id, question: `Term ${i}`, answer: `Definition ${i}` });
    }

    const cloneRes = api.cloneDeck(bigDeck.id, "med-student");
    expect(cloneRes.status).toBe(200);
    expect(cloneRes.data.cardCount).toBe(50);

    const clonedDeck = db.getDeck(cloneRes.data.deckId!)!;
    expect(clonedDeck.cards.length).toBe(50);
    // All cards point to cloned deck
    expect(clonedDeck.cards.every((c) => c.deckId === clonedDeck.id)).toBe(true);
  });

  it("B10.3 cloning deck with extremely long title preserves title with copy suffix", () => {
    const longTitle = "A".repeat(150);
    const sourceDeck = db.createDeck({ title: longTitle, isPublic: true });

    const cloneRes = api.cloneDeck(sourceDeck.id, "user-long-title");
    expect(cloneRes.status).toBe(200);
    expect(cloneRes.data.title).toContain(longTitle);
    expect(cloneRes.data.title).toContain("(My Copy)");
  });

  it("B10.4 user re-cloning same source deck multiple times creates distinct independent clones", () => {
    const sourceDeck = db.createDeck({ title: "JavaScript ES2024", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Object.groupBy", answer: "Groups items" });

    const clone1 = api.cloneDeck(sourceDeck.id, "repeat-cloner");
    const clone2 = api.cloneDeck(sourceDeck.id, "repeat-cloner");

    expect(clone1.data.deckId).not.toBe(clone2.data.deckId);

    const userDecks = db.getDecksForUser("repeat-cloner");
    expect(userDecks.length).toBe(2);
  });

  it("B10.5 rejects cloning with empty userId or empty deckId with status 400", () => {
    expect(api.cloneDeck("", "user-1").status).toBe(400);
    expect(api.cloneDeck("deck-1", "").status).toBe(400);
  });
});
