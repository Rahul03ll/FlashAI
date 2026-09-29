import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 10 - Deck Cloning & Popularity Metrics (R3)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("10.1 deep-clones deck and all its flashcards for target user", () => {
    const authorId = "author-1";
    const clonerId = "cloner-1";

    const sourceDeck = db.createDeck({
      title: "Spanish Vocabulary",
      userId: authorId,
      isPublic: true,
    });
    db.createCard({ deckId: sourceDeck.id, question: "Hola", answer: "Hello" });
    db.createCard({ deckId: sourceDeck.id, question: "Gracias", answer: "Thank you" });

    const cloneRes = api.cloneDeck(sourceDeck.id, clonerId);
    expect(cloneRes.status).toBe(200);
    expect(cloneRes.data.success).toBe(true);
    expect(cloneRes.data.cardCount).toBe(2);
    expect(cloneRes.data.title).toContain("(My Copy)");

    const clonedDeck = db.getDeck(cloneRes.data.deckId!);
    expect(clonedDeck).toBeDefined();
    expect(clonedDeck?.userId).toBe(clonerId);
    expect(clonedDeck?.cards.length).toBe(2);
  });

  it("10.2 resets SM-2 metrics on cloned cards to baseline defaults", () => {
    const sourceDeck = db.createDeck({ title: "French Verbs", isPublic: true });
    // Source cards have advanced SM-2 state from original owner
    db.createCard({
      deckId: sourceDeck.id,
      question: "Parler",
      answer: "To speak",
      ease: 2.8,
      interval: 45,
      repetitions: 6,
    });

    const cloneRes = api.cloneDeck(sourceDeck.id, "cloner-fresh");
    const clonedDeck = db.getDeck(cloneRes.data.deckId!)!;
    const clonedCard = clonedDeck.cards[0];

    expect(clonedCard.ease).toBe(2.5);
    expect(clonedCard.interval).toBe(1);
    expect(clonedCard.repetitions).toBe(0);
    expect(clonedCard.difficultyScore).toBe(0);
  });

  it("10.3 increments cloneCount popularity metric on source community deck", () => {
    const sourceDeck = db.createDeck({ title: "Organic Reactions", isPublic: true });
    expect(sourceDeck.cloneCount).toBe(0);

    api.cloneDeck(sourceDeck.id, "cloner-a");
    api.cloneDeck(sourceDeck.id, "cloner-b");

    const updatedSource = db.getDeck(sourceDeck.id);
    expect(updatedSource?.cloneCount).toBe(2);
  });

  it("10.4 cloned deck modifications do not mutate the original source deck", () => {
    const sourceDeck = db.createDeck({ title: "Ancient Rome", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "First Emperor?", answer: "Augustus" });

    const cloneRes = api.cloneDeck(sourceDeck.id, "cloner-mutator");
    const clonedDeckId = cloneRes.data.deckId!;

    // Modify cloned deck title and card
    db.updateDeck(clonedDeckId, { title: "Custom Roman Empire Notes" });
    const clonedCards = db.getCardsForDeck(clonedDeckId);
    db.updateCard(clonedCards[0].id, { question: "Who founded the Principate?" });

    // Verify original remains pristine
    const original = db.getDeck(sourceDeck.id)!;
    expect(original.title).toBe("Ancient Rome");
    expect(original.cards[0].question).toBe("First Emperor?");
  });

  it("10.5 returns 404 when attempting to clone nonexistent deck", () => {
    const res = api.cloneDeck("ghost-deck-id", "user-123");
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Source deck not found");
  });

  it("10.6 requires valid deckId and userId to clone", () => {
    const res1 = api.cloneDeck("", "user-1");
    expect(res1.status).toBe(400);

    const res2 = api.cloneDeck("deck-1", "");
    expect(res2.status).toBe(400);
  });
});
