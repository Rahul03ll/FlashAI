import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { InMemoryDb } from "../harness/in-memory-db";
import { SlidingWindowRateLimiter } from "../harness/rate-limiter";
import { PresenceTracker } from "../harness/presence-tracker";
import { OfflineStudyQueue, MockLocalStorage } from "../harness/offline-study-queue";
import { AiConcurrencyQueue } from "../harness/ai-queue";

describe("Tier 4: Real-World Application Workload Scenarios", () => {
  let db: InMemoryDb;
  let api: FlashAiApiSimulator;
  let presence: PresenceTracker;
  let rateLimiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    db = new InMemoryDb();
    presence = new PresenceTracker(60_000);
    rateLimiter = new SlidingWindowRateLimiter();
    api = new FlashAiApiSimulator(db, rateLimiter, presence);
  });

  // =========================================================================
  // Scenario 1: Seamless Onboarding to Authenticated Sync (F1, F2, F3, F10)
  // =========================================================================
  it("Scenario 1: Seamless Onboarding to Authenticated Sync (Alice's Journey)", () => {
    // 1. Alice lands on FlashAI with no account -> instant guest profile
    const aliceGuestId = "guest-alice-deviceA";
    const initRes = api.bootstrapUser(aliceGuestId);
    expect(initRes.status).toBe(200);
    expect(initRes.data.user?.level).toBe("Beginner");
    expect(initRes.data.user?.xp).toBe(0);

    // 2. Discovers public community deck "Intro to Neuroscience", clones it
    const author = db.createUser({ id: "neuro-prof", name: "Prof. Ramachandran" });
    const publicDeck = db.createDeck({
      title: "Intro to Neuroscience",
      userId: author.id,
      isPublic: true,
    });
    const c1 = db.createCard({ deckId: publicDeck.id, question: "Action potential threshold?", answer: "-55 mV" });
    const c2 = db.createCard({ deckId: publicDeck.id, question: "Myelin function?", answer: "Insulates axon" });

    const cloneRes = api.cloneDeck(publicDeck.id, aliceGuestId);
    expect(cloneRes.status).toBe(200);
    const aliceDeckId = cloneRes.data.deckId!;

    // 3. Alice studies Card 1 ("good") and Card 2 ("easy")
    const aliceCards = db.getCardsForDeck(aliceDeckId);
    const rev1 = api.reviewCard(aliceCards[0].id, aliceGuestId, { quality: "good" }); // +5 XP
    const rev2 = api.reviewCard(aliceCards[1].id, aliceGuestId, { quality: "easy" }); // +10 XP

    expect(rev1.data.gainedXp).toBe(5);
    expect(rev2.data.gainedXp).toBe(10);
    const aliceGuestUser = db.getUser(aliceGuestId)!;
    expect(aliceGuestUser.xp).toBe(15);
    expect(aliceGuestUser.streak).toBe(2);

    // 4. Alice enters email to link account and persist progress
    const email = "alice@university.edu";
    const sendRes = api.sendOtpCode(email);
    expect(sendRes.status).toBe(200);
    const otp = db.getOtp(email)!;

    // 5. Verifies OTP -> account upgraded, decks and XP migrated
    const verifyRes = api.verifyOtpCode(email, otp.code, aliceGuestId);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.data.user?.email).toBe(email);
    expect(verifyRes.data.user?.xp).toBe(15);
    expect(verifyRes.data.user?.streak).toBe(2);

    const verifiedUserId = verifyRes.data.user!.id;
    const verifiedDecks = db.getDecksForUser(verifiedUserId);
    expect(verifiedDecks.length).toBe(1);
    expect(verifiedDecks[0].id).toBe(aliceDeckId);

    // 6. Device B login: Alice logs in on laptop via email OTP
    api.sendOtpCode(email);
    const laptopOtp = db.getOtp(email)!;
    const laptopLogin = api.verifyOtpCode(email, laptopOtp.code);

    expect(laptopLogin.status).toBe(200);
    expect(laptopLogin.data.user?.id).toBe(verifiedUserId);
    expect(laptopLogin.data.user?.xp).toBe(15);

    // Laptop sees same deck and SM-2 progress
    const laptopDecks = db.getDecksForUser(verifiedUserId);
    expect(laptopDecks.length).toBe(1);
    const laptopCards = db.getCardsForDeck(laptopDecks[0].id);
    expect(laptopCards[0].repetitions).toBe(1);
    expect(laptopCards[1].repetitions).toBe(1);
  });

  // =========================================================================
  // Scenario 2: Concurrent Multi-Learner Study of Shared Deck (F1, F10, F11, F12)
  // =========================================================================
  it("Scenario 2: Concurrent Multi-Learner Study of Shared Deck (Bob & Charlie)", () => {
    // 1. Author publishes community deck "Organic Chemistry 101"
    const author = db.createUser({ id: "chem-author" });
    const chemDeck = db.createDeck({ title: "Organic Chemistry 101", userId: author.id, isPublic: true });
    db.createCard({ deckId: chemDeck.id, question: "SN1 vs SN2 mechanism?", answer: "Unimolecular vs Bimolecular" });
    db.createCard({ deckId: chemDeck.id, question: "Markovnikov rule?", answer: "Hydrogen adds to less substituted C" });

    // 2. Bob and Charlie concurrently clone the deck
    const cloneBob = api.cloneDeck(chemDeck.id, "learner-bob");
    const cloneCharlie = api.cloneDeck(chemDeck.id, "learner-charlie");

    const bobDeckId = cloneBob.data.deckId!;
    const charlieDeckId = cloneCharlie.data.deckId!;
    const bobCards = db.getCardsForDeck(bobDeckId);
    const charlieCards = db.getCardsForDeck(charlieDeckId);

    // 3. Round 1: Bob rates "easy" (mastery), Charlie rates "hard" (struggling)
    api.reviewCard(bobCards[0].id, "learner-bob", { quality: "easy" });
    api.reviewCard(bobCards[1].id, "learner-bob", { quality: "easy" });

    api.reviewCard(charlieCards[0].id, "learner-charlie", { quality: "hard" });
    api.reviewCard(charlieCards[1].id, "learner-charlie", { quality: "hard" });

    // 4. Round 2: Bob rates "easy" again, Charlie rates "good"
    api.reviewCard(bobCards[0].id, "learner-bob", { quality: "easy" });
    api.reviewCard(charlieCards[0].id, "learner-charlie", { quality: "good" });

    const finalBobCard0 = db.getCard(bobCards[0].id)!;
    const finalCharlieCard0 = db.getCard(charlieCards[0].id)!;

    // Bob: Repetitions=2, Interval=6, Ease=2.7
    expect(finalBobCard0.repetitions).toBe(2);
    expect(finalBobCard0.interval).toBe(6);
    expect(finalBobCard0.ease).toBeCloseTo(2.7, 5);

    // Charlie: Repetitions=1, Interval=1, Ease=2.3
    expect(finalCharlieCard0.repetitions).toBe(1);
    expect(finalCharlieCard0.interval).toBe(1);
    expect(finalCharlieCard0.ease).toBeCloseTo(2.3, 5);

    // Both earned XP independently
    const bobUser = db.getUser("learner-bob")!;
    const charlieUser = db.getUser("learner-charlie")!;
    expect(bobUser.xp).toBe(30); // 10 + 10 + 10
    expect(charlieUser.xp).toBe(9); // 2 + 2 + 5
  });

  // =========================================================================
  // Scenario 3: Burst Traffic & Resilient Queueing Under Load (F4, F5, F6)
  // =========================================================================
  it("Scenario 3: Burst Traffic & Resilient Queueing Under Load (Lecture Hall Burst)", async () => {
    const aiQueue = new AiConcurrencyQueue(2); // Max 2 concurrent AI generation tasks
    const clientIp = "ip:10.0.0.1-lecture-hall";
    const limit = 5;
    const windowMs = 5_000;
    const now = 1_000_000;

    const acceptedJobs: Promise<string>[] = [];
    const rejectedRequests: { allowed: boolean; retryAfter: number }[] = [];

    // 10 students hit the generate button at the same instant
    for (let req = 1; req <= 10; req++) {
      const rateCheck = rateLimiter.checkRateLimit(clientIp, limit, windowMs, now);
      if (rateCheck.allowed) {
        // Enqueue into AI concurrency queue
        acceptedJobs.push(
          aiQueue.run(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return `generated-deck-${req}`;
          }),
        );
      } else {
        rejectedRequests.push({
          allowed: false,
          retryAfter: rateCheck.retryAfterSec,
        });
      }
    }

    // Exactly 5 allowed by rate limiter, exactly 5 rejected with 429
    expect(acceptedJobs.length).toBe(5);
    expect(rejectedRequests.length).toBe(5);
    expect(rejectedRequests[0].retryAfter).toBeGreaterThan(0);

    // All accepted jobs process cleanly through AI queue without deadlocks
    const results = await Promise.all(acceptedJobs);
    expect(results.length).toBe(5);
    expect(aiQueue.stats.totalCompleted).toBe(5);
    expect(aiQueue.stats.queued).toBe(0);

    // After window expires, rejected users can now submit successfully
    const afterWindow = now + windowMs + 100;
    const retryRes = rateLimiter.checkRateLimit(clientIp, limit, windowMs, afterWindow);
    expect(retryRes.allowed).toBe(true);
  });

  // =========================================================================
  // Scenario 4: Offline Study Session with Automatic Reconnect Sync (F11, F12, F13, F14)
  // =========================================================================
  it("Scenario 4: Offline Study Session with Automatic Reconnect Sync (David's Commute)", async () => {
    const storage = new MockLocalStorage();
    const clientQueue = new OfflineStudyQueue(storage);

    const user = db.createUser({ id: "david-commuter", xp: 10, streak: 1, points: 10 });
    const deck = db.createDeck({ title: "Commute Language Deck", userId: user.id });
    const cards = Array.from({ length: 4 }, (_, i) =>
      db.createCard({ deckId: deck.id, question: `German Word ${i}`, answer: `English Def ${i}` }),
    );

    // 1. Enters subway tunnel -> network disconnects
    clientQueue.setOnlineStatus(false);

    // 2. Reviews 3 cards while underground
    clientQueue.enqueue(cards[0].id, "good", 100_000);
    clientQueue.enqueue(cards[1].id, "easy", 100_050);
    clientQueue.enqueue(cards[2].id, "hard", 100_100);

    // 3. Browser reload occurs while underground
    const reloadedQueue = new OfflineStudyQueue(storage);
    reloadedQueue.setOnlineStatus(false);
    expect(reloadedQueue.getQueue().length).toBe(3);

    // 4. Reviews 4th card after reload
    reloadedQueue.enqueue(cards[3].id, "good", 100_150);
    expect(reloadedQueue.getQueue().length).toBe(4);

    // 5. Train emerges into station -> network reconnects
    reloadedQueue.setOnlineStatus(true);

    const syncReport = await reloadedQueue.flush(async (queuedReview) => {
      const res = api.reviewCard(queuedReview.cardId, user.id, {
        quality: queuedReview.quality,
        clientTimestamp: queuedReview.clientTimestamp,
      });
      return res.status === 200;
    });

    // 6. All 4 cards synced atomically
    expect(syncReport.synced).toBe(4);
    expect(syncReport.failed).toBe(0);
    expect(syncReport.remaining).toBe(0);

    // 7. Verify cumulative progression
    const finalUser = db.getUser(user.id)!;
    // initial(10) + good(5) + easy(10) + hard(2) + good(5) = 32 XP
    expect(finalUser.xp).toBe(32);
    expect(finalUser.streak).toBe(5); // initial(1) + 4 reviews = 5

    // Verify SM-2 states on cards
    expect(db.getCard(cards[0].id)!.repetitions).toBe(1);
    expect(db.getCard(cards[1].id)!.repetitions).toBe(1);
    expect(db.getCard(cards[2].id)!.repetitions).toBe(0); // hard resets rep to 0
    expect(db.getCard(cards[3].id)!.repetitions).toBe(1);
  });

  // =========================================================================
  // Scenario 5: Community Deck Discovery, Upvoting & Cloning Flow (F7, F8, F9, F10, F15)
  // =========================================================================
  it("Scenario 5: Community Deck Discovery, Upvoting & Cloning Flow", () => {
    const t0 = Date.now();

    // 1. Live presence active: 3 learners online
    api.heartbeat("elena", t0);
    api.heartbeat("frank", t0 + 100);
    api.heartbeat("grace", t0 + 200);

    const activity1 = api.getActivity(t0 + 250);
    expect(activity1.data.liveCount).toBe(3);

    // 2. Elena publishes community deck "Mastering Rust"
    const elena = db.createUser({ id: "elena", displayName: "Elena Rustacean" });
    const rustDeck = db.createDeck({
      title: "Mastering Rust & Memory Safety",
      userId: elena.id,
      isPublic: true,
    });
    db.createCard({ deckId: rustDeck.id, question: "What is borrow checker?", answer: "Enforces ownership rules" });
    db.createCard({ deckId: rustDeck.id, question: "Rc vs Arc?", answer: "Single vs Thread-safe reference counter" });

    // Activity broadcast
    db.addActivity({
      type: "deck",
      text: `📚 Elena shared a public deck: "${rustDeck.title}" (2 cards)`,
      timestamp: new Date(t0 + 300),
    });

    // 3. Frank and Grace discover the deck; both upvote
    api.upvoteDeck(rustDeck.id, "frank");
    api.upvoteDeck(rustDeck.id, "grace");

    // 4. Frank bookmarks it
    api.bookmarkDeck(rustDeck.id, "frank");
    expect(db.hasBookmarked(rustDeck.id, "frank")).toBe(true);

    // 5. Grace clones the deck
    const graceClone = api.cloneDeck(rustDeck.id, "grace");
    expect(graceClone.status).toBe(200);

    // 6. Grace completes study session on her cloned copy
    const graceDeckCards = db.getCardsForDeck(graceClone.data.deckId!);
    api.reviewCard(graceDeckCards[0].id, "grace", { quality: "easy" }); // +10 XP
    api.reviewCard(graceDeckCards[1].id, "grace", { quality: "easy" }); // +10 XP

    db.addActivity({
      type: "xp",
      text: "⚡ Grace earned 20 XP studying flashcards!",
      timestamp: new Date(t0 + 500),
    });

    // 7. Verify deck popularity metrics
    const updatedSource = db.getDeck(rustDeck.id)!;
    expect(updatedSource.upvoteCount).toBe(2);
    expect(updatedSource.cloneCount).toBe(1);

    // 8. Verify activity feed contains both Elena's deck creation and Grace's XP gain
    const feed = api.getActivity(t0 + 600);
    const feedTexts = feed.data.events.map((e) => e.text);
    expect(feedTexts.some((t) => t.includes("Elena shared a public deck"))).toBe(true);
    expect(feedTexts.some((t) => t.includes("Grace earned 20 XP"))).toBe(true);
  });
});
