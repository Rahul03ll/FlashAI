import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";
import { OfflineStudyQueue } from "../harness/offline-study-queue";

import { PresenceTracker } from "../harness/presence-tracker";
import { SlidingWindowRateLimiter } from "../harness/rate-limiter";

describe("Tier 3: Cross-Feature Combinations (Pairwise Interactions)", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;
  let offlineQueue: OfflineStudyQueue;
  let presence: PresenceTracker;
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    db = new InMemoryDb();
    presence = new PresenceTracker(60_000);
    limiter = new SlidingWindowRateLimiter();
    api = new FlashAiApiSimulator(db, limiter, presence);
    offlineQueue = new OfflineStudyQueue();
  });

  it("T3.1 guest user studies cards offline, links email OTP, then flushes offline queue to linked account", async () => {
    const guestId = "guest-combo-1";
    api.bootstrapUser(guestId);

    const deck = db.createDeck({ title: "Offline Study Deck", userId: guestId });
    const card = db.createCard({ deckId: deck.id, question: "Question 1", answer: "Answer 1" });

    // 1. Study card offline
    offlineQueue.setOnlineStatus(false);
    offlineQueue.enqueue(card.id, "easy", Date.now());

    // 2. Link account with email OTP
    const email = "combo1@example.com";
    api.sendOtpCode(email);
    const otp = db.getOtp(email)!;
    const verifyRes = api.verifyOtpCode(email, otp.code, guestId);
    expect(verifyRes.status).toBe(200);
    const authenticatedId = verifyRes.data.user!.id;

    // 3. Reconnect and flush offline queue against review handler
    offlineQueue.setOnlineStatus(true);
    const flushRes = await offlineQueue.flush(async (queued) => {
      const res = api.reviewCard(queued.cardId, authenticatedId, {
        quality: queued.quality,
        clientTimestamp: queued.clientTimestamp,
      });
      return res.status === 200;
    });

    expect(flushRes.synced).toBe(1);
    expect(flushRes.remaining).toBe(0);

    const updatedUser = db.getUser(authenticatedId)!;
    expect(updatedUser.xp).toBe(10); // Easy gives 10 XP
    expect(updatedUser.streak).toBe(1);
  });

  it("T3.2 concurrent users clone same community deck and study simultaneously with independent SM-2 intervals", () => {
    const sourceDeck = db.createDeck({ title: "Shared Biology", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Cell wall function?", answer: "Structural support" });

    const cloneA = api.cloneDeck(sourceDeck.id, "learner-A");
    const cloneB = api.cloneDeck(sourceDeck.id, "learner-B");

    const cardAId = db.getCardsForDeck(cloneA.data.deckId!)[0].id;
    const cardBId = db.getCardsForDeck(cloneB.data.deckId!)[0].id;

    // Learner A rates "easy" twice
    api.reviewCard(cardAId, "learner-A", { quality: "easy" });
    api.reviewCard(cardAId, "learner-A", { quality: "easy" });

    // Learner B rates "hard" twice
    api.reviewCard(cardBId, "learner-B", { quality: "hard" });
    api.reviewCard(cardBId, "learner-B", { quality: "hard" });

    const cardA = db.getCard(cardAId)!;
    const cardB = db.getCard(cardBId)!;

    expect(cardA.ease).toBe(2.7); // 2.5 + 0.1 + 0.1
    expect(cardA.interval).toBe(6);
    expect(cardA.repetitions).toBe(2);

    expect(cardB.ease).toBeCloseTo(2.1, 5); // 2.5 - 0.2 - 0.2
    expect(cardB.interval).toBe(1);
    expect(cardB.repetitions).toBe(0);
  });

  it("T3.3 rate-limited user on AI/generation routes can still access community feeds and upvote decks", () => {
    const userEmail = "exhausted@example.com";
    const now = Date.now();

    // Exhaust OTP/AI rate limit
    api.sendOtpCode(userEmail, now);
    api.sendOtpCode(userEmail, now + 10);
    api.sendOtpCode(userEmail, now + 20);
    const blockedRes = api.sendOtpCode(userEmail, now + 30);
    expect(blockedRes.status).toBe(429);

    // Community activity feed remains fully operational
    const activityRes = api.getActivity(now + 40);
    expect(activityRes.status).toBe(200);

    // Community deck upvoting remains accessible
    const publicDeck = db.createDeck({ title: "Community Star", isPublic: true });
    const upvoteRes = api.upvoteDeck(publicDeck.id, "exhausted-user");
    expect(upvoteRes.status).toBe(200);
    expect(upvoteRes.data.upvoted).toBe(true);
  });

  it("T3.4 user heartbeats presence, clones deck, upvotes original deck -> all metrics increment correctly", () => {
    const user = "active-contributor";
    const sourceDeck = db.createDeck({ title: "Chemistry 101", isPublic: true });

    // 1. Record heartbeat
    const hbRes = api.heartbeat(user);
    expect(hbRes.data.activeUsers).toBeGreaterThanOrEqual(1);

    // 2. Clone deck
    const cloneRes = api.cloneDeck(sourceDeck.id, user);
    expect(cloneRes.status).toBe(200);

    // 3. Upvote original deck
    const upvoteRes = api.upvoteDeck(sourceDeck.id, user);
    expect(upvoteRes.status).toBe(200);

    const updatedSource = db.getDeck(sourceDeck.id)!;
    expect(updatedSource.cloneCount).toBe(1);
    expect(updatedSource.upvoteCount).toBe(1);
  });

  it("T3.5 user links account while active presence heartbeat is running without count disruption", () => {
    const guestId = "guest-presence-link";
    const t0 = 1_000_000;

    api.bootstrapUser(guestId);
    api.heartbeat(guestId, t0);
    expect(api.presenceTracker.getActiveCount(t0)).toBe(1);

    // Verify code and link
    const email = "presencelink@example.com";
    api.sendOtpCode(email, t0);
    const otp = db.getOtp(email)!;
    const verifyRes = api.verifyOtpCode(email, otp.code, guestId, t0 + 1_000);
    expect(verifyRes.status).toBe(200);

    // New heartbeat with linked user ID
    api.heartbeat(verifyRes.data.user!.id, t0 + 2_000);
    expect(api.presenceTracker.getActiveCount(t0 + 2_000)).toBe(1);
  });

  it("T3.6 offline review queue replay succeeds during rate limiting on other endpoints", async () => {
    const user = db.createUser({ id: "reviewer-isolated" });
    const deck = db.createDeck({ title: "Deck", userId: user.id });
    const card = db.createCard({ deckId: deck.id, question: "Q", answer: "A" });

    // AI/OTP rate limit is currently triggered
    api.sendOtpCode("flood2@example.com");
    api.sendOtpCode("flood2@example.com");
    api.sendOtpCode("flood2@example.com");
    expect(api.sendOtpCode("flood2@example.com").status).toBe(429);

    // Replaying review queue is not rate-limited by AI limits
    offlineQueue.enqueue(card.id, "good");
    const flushRes = await offlineQueue.flush(async (r) => {
      const res = api.reviewCard(r.cardId, user.id, { quality: r.quality });
      return res.status === 200;
    });

    expect(flushRes.synced).toBe(1);
  });

  it("T3.7 user bookmarks deck, author edits original deck -> bookmark reference remains intact", () => {
    const author = db.createUser({ id: "author-editor" });
    const deck = db.createDeck({ title: "Original Title", userId: author.id, isPublic: true });
    const user = "bookmarker-user";

    api.bookmarkDeck(deck.id, user);

    // Author updates deck title
    db.updateDeck(deck.id, { title: "Updated Title By Author" });

    const bookmarks = db.getBookmarkedDecks(user);
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].title).toBe("Updated Title By Author");
  });

  it("T3.8 two users simultaneously upvote the same deck -> atomic upvote counter increments by 2", async () => {
    const deck = db.createDeck({ title: "Popular Science", isPublic: true });

    await Promise.all([
      Promise.resolve(api.upvoteDeck(deck.id, "user-voter-1")),
      Promise.resolve(api.upvoteDeck(deck.id, "user-voter-2")),
    ]);

    const updated = db.getDeck(deck.id)!;
    expect(updated.upvoteCount).toBe(2);
  });

  it("T3.9 user logs out (/api/auth/logout), subsequent getMe returns guest status", () => {
    const user = db.createUser({ id: "user-logout-test", email: "logout@example.com" });
    const token = `session_${user.id}_123`;

    expect(api.getMe(token).data.isGuest).toBe(false);

    api.logout();

    // When client resets token
    expect(api.getMe(null).data.isGuest).toBe(true);
    expect(api.getMe(null).data.user).toBeNull();
  });

  it("T3.10 burst of reviews on multiple cards in a deck updates user's streak and XP atomically", () => {
    const user = db.createUser({ id: "burst-reviewer", streak: 0, xp: 0 });
    const deck = db.createDeck({ title: "Deck 5 Cards", userId: user.id });
    const cards = Array.from({ length: 5 }, (_, i) =>
      db.createCard({ deckId: deck.id, question: `Q${i}`, answer: `A${i}` }),
    );

    // Review all 5 cards with "good" (5 XP each)
    for (const card of cards) {
      api.reviewCard(card.id, user.id, { quality: "good" });
    }

    const updatedUser = db.getUser(user.id)!;
    expect(updatedUser.xp).toBe(25);
    expect(updatedUser.streak).toBe(5);
  });

  it("T3.11 expired OTP during account link does not corrupt existing guest profile or decks", () => {
    const guestId = "guest-safe-fail";
    api.bootstrapUser(guestId);
    const deck = db.createDeck({ title: "Valuable Deck", userId: guestId });

    const email = "failtest@example.com";
    const t0 = 1_000_000;
    api.sendOtpCode(email, t0);
    const otp = db.getOtp(email)!;

    // Try linking 15 minutes later (expired)
    const res = api.verifyOtpCode(email, otp.code, guestId, t0 + 15 * 60 * 1000);
    expect(res.status).toBe(400);

    // Guest profile and decks are untouched
    const guestUser = db.getUser(guestId);
    expect(guestUser).toBeDefined();
    expect(db.getDecksForUser(guestId).length).toBe(1);
    expect(db.getDeck(deck.id)?.title).toBe("Valuable Deck");
  });

  it("T3.12 deck with cards having extreme SM-2 qualities is cloned -> clone resets cards to baseline", () => {
    const sourceDeck = db.createDeck({ title: "Mastered Math", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Q1", answer: "A1", ease: 1.3, repetitions: 0, interval: 1 });
    db.createCard({ deckId: sourceDeck.id, question: "Q2", answer: "A2", ease: 3.0, repetitions: 15, interval: 300 });

    const cloneRes = api.cloneDeck(sourceDeck.id, "learner-clean-slate");
    const clonedDeck = db.getDeck(cloneRes.data.deckId!)!;

    for (const card of clonedDeck.cards) {
      expect(card.ease).toBe(2.5);
      expect(card.interval).toBe(1);
      expect(card.repetitions).toBe(0);
    }
  });

  it("T3.13 cloned deck mutation leaves original public community deck completely intact", () => {
    const sourceDeck = db.createDeck({ title: "Original Public Knowledge", isPublic: true });
    db.createCard({ deckId: sourceDeck.id, question: "Static Q", answer: "Static A" });

    const cloneRes = api.cloneDeck(sourceDeck.id, "editor-user");
    const cloneId = cloneRes.data.deckId!;

    db.updateDeck(cloneId, { title: "Heavily Modified Version" });
    const cloneCard = db.getCardsForDeck(cloneId)[0];
    db.updateCard(cloneCard.id, { question: "Changed Q" });

    const source = db.getDeck(sourceDeck.id)!;
    expect(source.title).toBe("Original Public Knowledge");
    expect(source.cards[0].question).toBe("Static Q");
  });

  it("T3.14 rapid presence heartbeats from single user over 60s do not inflate active count beyond 1", () => {
    const user = "solo-active-user";
    const t0 = 100_000;

    for (let sec = 0; sec < 60; sec += 5) {
      api.heartbeat(user, t0 + sec * 1000);
      expect(api.presenceTracker.getActiveCount(t0 + sec * 1000)).toBe(1);
    }
  });

  it("T3.15 user transitions from Beginner to Learner level via offline review replay", async () => {
    const user = db.createUser({ id: "offline-promoted-user", points: 485, xp: 485 });
    const deck = db.createDeck({ title: "Level Up Deck", userId: user.id });
    const c1 = db.createCard({ deckId: deck.id, question: "Q1", answer: "A1" });
    const c2 = db.createCard({ deckId: deck.id, question: "Q2", answer: "A2" });

    // User reviews 2 cards offline with "easy" (+10 pts each = +20 pts total) -> 505 pts
    offlineQueue.enqueue(c1.id, "easy");
    offlineQueue.enqueue(c2.id, "easy");

    let levelUpObserved = false;
    await offlineQueue.flush(async (r) => {
      const res = api.reviewCard(r.cardId, user.id, { quality: r.quality });
      if (res.data.isLevelUp) levelUpObserved = true;
      return res.status === 200;
    });

    expect(levelUpObserved).toBe(true);
    const updated = db.getUser(user.id)!;
    expect(updated.points).toBe(505);
    expect(api.getMe(user.id).data.user?.level).toBe("Learner");
  });
});
