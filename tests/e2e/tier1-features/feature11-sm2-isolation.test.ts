import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";

describe("Tier 1: Feature 11 - SM-2 Multi-User Isolation (R4)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    db = new InMemoryDb();
    api = new FlashAiApiSimulator(db);
  });

  it("11.1 User A's review of a card does not modify User B's card state", () => {
    const sourceDeck = db.createDeck({ title: "Algorithms 101", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Binary search runtime?", answer: "O(log n)" });

    // User A and User B both clone the deck
    const cloneA = api.cloneDeck(sourceDeck.id, "user-A");
    const cloneB = api.cloneDeck(sourceDeck.id, "user-B");

    const cardAId = db.getCardsForDeck(cloneA.data.deckId!)[0].id;
    const cardBId = db.getCardsForDeck(cloneB.data.deckId!)[0].id;

    // User A rates card "easy"
    const revA = api.reviewCard(cardAId, "user-A", { quality: "easy" });
    expect(revA.status).toBe(200);

    const cardA = db.getCard(cardAId)!;
    const cardB = db.getCard(cardBId)!;

    // User A card updated
    expect(cardA.repetitions).toBe(1);
    expect(cardA.ease).toBe(2.6); // 2.5 + 0.1

    // User B card remains unstudied
    expect(cardB.repetitions).toBe(0);
    expect(cardB.ease).toBe(2.5);
    expect(cardB.interval).toBe(1);
  });

  it("11.2 cloned cards maintain completely independent ease factors for each learner", () => {
    const sourceDeck = db.createDeck({ title: "Discrete Math", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "P vs NP?", answer: "Unresolved" });

    const cloneA = api.cloneDeck(sourceDeck.id, "user-fast");
    const cloneB = api.cloneDeck(sourceDeck.id, "user-struggling");

    const cardAId = db.getCardsForDeck(cloneA.data.deckId!)[0].id;
    const cardBId = db.getCardsForDeck(cloneB.data.deckId!)[0].id;

    // User A rates "easy", User B rates "hard"
    api.reviewCard(cardAId, "user-fast", { quality: "easy" });
    api.reviewCard(cardBId, "user-struggling", { quality: "hard" });

    const cardA = db.getCard(cardAId)!;
    const cardB = db.getCard(cardBId)!;

    expect(cardA.ease).toBe(2.6);
    expect(cardB.ease).toBe(2.3); // 2.5 - 0.2
  });

  it("11.3 different qualities produce divergent repetition counts and intervals", () => {
    const sourceDeck = db.createDeck({ title: "Data Structures", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Hash map lookup?", answer: "O(1) average" });

    const cloneA = api.cloneDeck(sourceDeck.id, "learner-good");
    const cloneB = api.cloneDeck(sourceDeck.id, "learner-hard");

    const cardAId = db.getCardsForDeck(cloneA.data.deckId!)[0].id;
    const cardBId = db.getCardsForDeck(cloneB.data.deckId!)[0].id;

    // Review 1
    api.reviewCard(cardAId, "learner-good", { quality: "good" });
    api.reviewCard(cardBId, "learner-hard", { quality: "hard" });

    // Review 2
    api.reviewCard(cardAId, "learner-good", { quality: "good" });
    api.reviewCard(cardBId, "learner-hard", { quality: "hard" });

    const cardA = db.getCard(cardAId)!;
    const cardB = db.getCard(cardBId)!;

    expect(cardA.repetitions).toBe(2);
    expect(cardA.interval).toBe(6);

    expect(cardB.repetitions).toBe(0);
    expect(cardB.interval).toBe(1);
  });

  it("11.4 due dates advance independently per user based on review scheduling", () => {
    const sourceDeck = db.createDeck({ title: "OS Concepts", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Deadlock conditions?", answer: "Mutual exclusion..." });

    const cloneA = api.cloneDeck(sourceDeck.id, "learner-due-a");
    const cloneB = api.cloneDeck(sourceDeck.id, "learner-due-b");

    const cardAId = db.getCardsForDeck(cloneA.data.deckId!)[0].id;
    const cardBId = db.getCardsForDeck(cloneB.data.deckId!)[0].id;

    // Both do 2 reviews
    api.reviewCard(cardAId, "learner-due-a", { quality: "good" });
    api.reviewCard(cardAId, "learner-due-a", { quality: "good" }); // rep=2 -> interval=6

    api.reviewCard(cardBId, "learner-due-b", { quality: "hard" }); // rep=0 -> interval=1

    const cardA = db.getCard(cardAId)!;
    const cardB = db.getCard(cardBId)!;

    expect(cardA.dueDate.getTime()).toBeGreaterThan(cardB.dueDate.getTime());
  });

  it("11.5 concurrent reviews on identical card questions execute without race conditions", async () => {
    const sourceDeck = db.createDeck({ title: "Concurrency Lab", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Mutex vs Semaphore?", answer: "Ownership differences" });

    const cloneA = api.cloneDeck(sourceDeck.id, "concurrent-A");
    const cloneB = api.cloneDeck(sourceDeck.id, "concurrent-B");

    const cardAId = db.getCardsForDeck(cloneA.data.deckId!)[0].id;
    const cardBId = db.getCardsForDeck(cloneB.data.deckId!)[0].id;

    const [resA, resB] = await Promise.all([
      Promise.resolve(api.reviewCard(cardAId, "concurrent-A", { quality: "easy" })),
      Promise.resolve(api.reviewCard(cardBId, "concurrent-B", { quality: "good" })),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.data.gainedXp).toBe(10);
    expect(resB.data.gainedXp).toBe(5);
  });
});
