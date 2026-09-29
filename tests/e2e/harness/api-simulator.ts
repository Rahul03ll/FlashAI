/**
 * API Route Simulator for FlashAI Multi-User E2E Test Suite.
 * Mirrors all Next.js API route contracts defined in PROJECT.md and ORIGINAL_REQUEST.md.
 */

import { InMemoryDb, globalTestDb } from "./in-memory-db";
import { SlidingWindowRateLimiter, globalRateLimiter } from "./rate-limiter";
import { PresenceTracker, globalPresenceTracker } from "./presence-tracker";
import { applySm2, StudyQuality } from "@/lib/sm2";
import { getLevel, ACTION_POINTS } from "@/lib/gamification";
import type { Flashcard } from "@/types/flashcard";

export interface UserProfile {
  id: string;
  name: string;
  displayName: string | null;
  email?: string | null;
  xp: number;
  streak: number;
  points: number;
  level: "Beginner" | "Learner" | "Master";
}

export class FlashAiApiSimulator {
  db: InMemoryDb;
  rateLimiter: SlidingWindowRateLimiter;
  presenceTracker: PresenceTracker;

  constructor(
    db: InMemoryDb = globalTestDb,
    rateLimiter: SlidingWindowRateLimiter = globalRateLimiter,
    presenceTracker: PresenceTracker = globalPresenceTracker,
  ) {
    this.db = db;
    this.rateLimiter = rateLimiter;
    this.presenceTracker = presenceTracker;
  }

  reset() {
    this.db.reset();
    this.rateLimiter.reset();
    this.presenceTracker.reset();
  }

  // --- 1. User Bootstrap (Guest Onboarding) ---
  bootstrapUser(userId: string): { status: number; data: { user?: UserProfile; error?: string } } {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return { status: 400, data: { error: "User ID is required." } };
    }
    const cleanId = userId.trim();
    let user = this.db.getUser(cleanId);
    if (!user) {
      const alphaNum = cleanId.replace(/[^a-zA-Z0-9]/g, "");
      const suffix = (alphaNum.slice(-4) || "0000").toUpperCase().padStart(4, "0");
      user = this.db.createUser({
        id: cleanId,
        name: `Learner-${suffix}`,
        points: 0,
        xp: 0,
        streak: 0,
      });
    }

    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      xp: user.xp,
      streak: user.streak,
      points: user.points,
      level: getLevel(user.points),
    };

    return { status: 200, data: { user: profile } };
  }

  // --- 2. Email OTP Send ---
  sendOtpCode(email: string, now = Date.now()): {
    status: number;
    headers: Record<string, string>;
    data: { success?: boolean; message?: string; error?: string; retryAfter?: number };
  } {
    if (!email || typeof email !== "string") {
      return { status: 400, headers: {}, data: { error: "Email is required." } };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { status: 400, headers: {}, data: { error: "Invalid email format." } };
    }

    // Rate limit: max 3 requests per 60 seconds per email
    const rateCheck = this.rateLimiter.checkRateLimit(`otp:${email.toLowerCase()}`, 3, 60_000, now);
    const headers = this.rateLimiter.getHeaders(rateCheck, 3, now);

    if (!rateCheck.allowed) {
      return {
        status: 429,
        headers,
        data: {
          error: "Too many verification code requests. Please wait before retrying.",
          retryAfter: rateCheck.retryAfterSec,
        },
      };
    }

    // Generate random 6-digit numeric OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.db.saveOtp(email.trim(), code, 10 * 60 * 1000, now); // 10 min expiry

    return {
      status: 200,
      headers,
      data: {
        success: true,
        message: "Verification code sent successfully.",
      },
    };
  }

  // --- 3. Email OTP Verify & Account Linking ---
  verifyOtpCode(
    email: string,
    code: string,
    currentUserId?: string,
    now = Date.now(),
  ): {
    status: number;
    data: { success?: boolean; user?: UserProfile; token?: string; error?: string };
  } {
    if (!email || !code) {
      return { status: 400, data: { error: "Email and verification code are required." } };
    }

    const otp = this.db.getOtp(email);
    if (!otp) {
      return { status: 400, data: { error: "No active verification code found for this email." } };
    }

    // Check expiration
    if (new Date(now) > otp.expiresAt) {
      this.db.deleteOtp(email);
      return { status: 400, data: { error: "Verification code has expired." } };
    }

    // Check attempts lockout (>5)
    if (otp.attempts >= 5) {
      this.db.deleteOtp(email);
      return { status: 429, data: { error: "Too many failed attempts. Code invalidated." } };
    }

    if (otp.code !== code.trim()) {
      this.db.incrementOtpAttempts(email);
      return { status: 400, data: { error: "Incorrect verification code." } };
    }

    // Code is valid! Delete OTP
    this.db.deleteOtp(email);

    // Find or create user for this email
    let user = this.db.findUserByEmail(email);
    const guestUser = currentUserId ? this.db.getUser(currentUserId) : null;

    if (!user) {
      if (guestUser && !guestUser.email) {
        // Upgrade current guest user into verified email account
        user = this.db.updateUser(guestUser.id, { email: email.toLowerCase() });
      } else {
        const newId = `user-${Math.random().toString(36).substring(2, 9)}`;
        user = this.db.createUser({
          id: newId,
          email: email.toLowerCase(),
          name: email.split("@")[0],
        });
      }
    } else {
      // User with this email already exists: merge guest data if guest provided
      if (guestUser && guestUser.id !== user.id) {
        // Merge guest decks to authenticated user
        const guestDecks = this.db.getDecksForUser(guestUser.id);
        for (const deck of guestDecks) {
          this.db.updateDeck(deck.id, { userId: user.id });
        }
        // Merge XP & Streak
        const mergedXp = user.xp + guestUser.xp;
        const mergedPoints = user.points + guestUser.points;
        const mergedStreak = Math.max(user.streak, guestUser.streak);
        user = this.db.updateUser(user.id, {
          xp: mergedXp,
          points: mergedPoints,
          streak: mergedStreak,
        });
        // Remove merged guest account
        this.db.users.delete(guestUser.id);
      }
    }

    const token = `session_${user.id}_${now}`;
    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      xp: user.xp,
      streak: user.streak,
      points: user.points,
      level: getLevel(user.points),
    };

    return {
      status: 200,
      data: {
        success: true,
        user: profile,
        token,
      },
    };
  }

  // --- 4. Session Verification (/api/auth/me) ---
  getMe(userIdOrToken: string | null): {
    status: number;
    data: { user: UserProfile | null; isGuest: boolean };
  } {
    if (!userIdOrToken) {
      return { status: 200, data: { user: null, isGuest: true } };
    }

    let userId = userIdOrToken;
    if (userIdOrToken.startsWith("session_")) {
      const parts = userIdOrToken.split("_");
      userId = parts[1];
    }

    const user = this.db.getUser(userId);
    if (!user) {
      return { status: 200, data: { user: null, isGuest: true } };
    }

    const isGuest = !user.email;
    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      xp: user.xp,
      streak: user.streak,
      points: user.points,
      level: getLevel(user.points),
    };

    return {
      status: 200,
      data: {
        user: profile,
        isGuest,
      },
    };
  }

  // --- 5. Logout (/api/auth/logout) ---
  logout(): { status: number; data: { success: boolean } } {
    return { status: 200, data: { success: true } };
  }

  // --- 6. Live Presence Heartbeat ---
  heartbeat(userId: string, now = Date.now()): {
    status: number;
    data: { activeUsers?: number; error?: string };
  } {
    try {
      const res = this.presenceTracker.recordHeartbeat(userId, now);
      return { status: 200, data: { activeUsers: res.activeUsers } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid heartbeat";
      return { status: 400, data: { error: msg } };
    }
  }

  // --- 7. Community Activity Feed ---
  getActivity(now = Date.now()): {
    status: number;
    data: { events: { id: string; type: string; text: string; timestamp: Date }[]; liveCount: number };
  } {
    const liveCount = this.presenceTracker.getActiveCount(now);
    const events = this.db.getRecentActivities();
    if (events.length === 0) {
      events.push({
        id: "e1",
        type: "welcome",
        text: "🚀 Welcome to FlashAI Community! Create or clone a deck to begin.",
        timestamp: new Date(now),
      });
    }
    return {
      status: 200,
      data: {
        events,
        liveCount,
      },
    };
  }

  // --- 8. Community Deck Upvoting ---
  upvoteDeck(
    deckId: string,
    userId: string,
  ): { status: number; data: { success?: boolean; upvoted?: boolean; upvoteCount?: number; error?: string } } {
    if (!deckId || !userId) {
      return { status: 400, data: { error: "Deck ID and User ID are required." } };
    }
    try {
      const res = this.db.toggleUpvote(deckId, userId);
      return {
        status: 200,
        data: {
          success: true,
          upvoted: res.upvoted,
          upvoteCount: res.count,
        },
      };
    } catch {
      return { status: 404, data: { error: "Deck not found." } };
    }
  }

  // --- 9. Community Deck Bookmarking ---
  bookmarkDeck(
    deckId: string,
    userId: string,
  ): { status: number; data: { success?: boolean; bookmarked?: boolean; error?: string } } {
    if (!deckId || !userId) {
      return { status: 400, data: { error: "Deck ID and User ID are required." } };
    }
    try {
      const res = this.db.toggleBookmark(deckId, userId);
      return {
        status: 200,
        data: {
          success: true,
          bookmarked: res.bookmarked,
        },
      };
    } catch {
      return { status: 404, data: { error: "Deck not found." } };
    }
  }

  // --- 10. Deck Cloning ---
  cloneDeck(
    deckId: string,
    userId: string,
  ): {
    status: number;
    data: { success?: boolean; deckId?: string; title?: string; cardCount?: number; error?: string };
  } {
    if (!deckId || !userId) {
      return { status: 400, data: { error: "Deck ID and User ID are required." } };
    }

    const sourceDeck = this.db.getDeck(deckId);
    if (!sourceDeck) {
      return { status: 404, data: { error: "Source deck not found." } };
    }

    // Ensure user exists
    if (!this.db.getUser(userId)) {
      this.db.createUser({ id: userId });
    }

    // Increment clone count on source deck
    sourceDeck.cloneCount += 1;
    this.db.updateDeck(sourceDeck.id, { cloneCount: sourceDeck.cloneCount });

    // Create cloned deck
    const clonedDeck = this.db.createDeck({
      title: `${sourceDeck.title} (My Copy)`,
      sourceFileName: sourceDeck.sourceFileName,
      userId,
      isPublic: false,
    });

    // Deep copy cards with initial SM-2 defaults
    for (const card of sourceDeck.cards) {
      this.db.createCard({
        deckId: clonedDeck.id,
        question: card.question,
        answer: card.answer,
        type: card.type,
        difficultyScore: 0,
        ease: 2.5,
        interval: 1,
        repetitions: 0,
        dueDate: new Date(),
      });
    }

    return {
      status: 200,
      data: {
        success: true,
        deckId: clonedDeck.id,
        title: clonedDeck.title,
        cardCount: sourceDeck.cards.length,
      },
    };
  }

  // --- 11 & 12. Atomic Card Review Processing ---
  reviewCard(
    cardId: string,
    userId: string,
    payload: { quality: StudyQuality; clientTimestamp?: number },
  ): {
    status: number;
    data: {
      card?: Flashcard;
      gainedXp?: number;
      currentStreak?: number;
      isLevelUp?: boolean;
      error?: string;
    };
  } {
    if (!cardId || !userId) {
      return { status: 400, data: { error: "Card ID and User ID are required." } };
    }

    if (!payload || !["hard", "good", "easy"].includes(payload.quality)) {
      return { status: 400, data: { error: "Valid quality ('hard' | 'good' | 'easy') is required." } };
    }

    const card = this.db.getCard(cardId);
    if (!card) {
      return { status: 404, data: { error: "Card not found." } };
    }

    const deck = this.db.getDeck(card.deckId);
    if (!deck) {
      return { status: 404, data: { error: "Associated deck not found." } };
    }

    // Ownership check: user must own deck
    if (deck.userId && deck.userId !== userId) {
      return { status: 403, data: { error: "Unauthorized: You do not own this card." } };
    }

    // SM-2 calculation using applySm2 from lib/sm2
    const currentCardDto: Flashcard = {
      id: card.id,
      question: card.question,
      answer: card.answer,
      type: card.type as any,
      difficultyScore: card.difficultyScore,
      ease: card.ease,
      interval: card.interval,
      repetitions: card.repetitions,
      dueDate: card.dueDate.toISOString(),
    };

    const updatedCardDto = applySm2(currentCardDto, payload.quality);

    // Save updated card in DB
    this.db.updateCard(card.id, {
      ease: updatedCardDto.ease,
      interval: updatedCardDto.interval,
      repetitions: updatedCardDto.repetitions,
      dueDate: new Date(updatedCardDto.dueDate),
    });

    // Award XP and points based on quality
    const gainedXp = ACTION_POINTS[payload.quality] || 5;
    let user = this.db.getUser(userId);
    if (!user) {
      user = this.db.createUser({ id: userId });
    }

    const prevLevel = getLevel(user.points);
    const newPoints = user.points + gainedXp;
    const newXp = user.xp + gainedXp;
    const newStreak = user.streak + 1;
    const newLevel = getLevel(newPoints);
    const isLevelUp = prevLevel !== newLevel;

    this.db.updateUser(userId, {
      points: newPoints,
      xp: newXp,
      streak: newStreak,
      lastStudiedDate: new Date(),
    });

    return {
      status: 200,
      data: {
        card: updatedCardDto,
        gainedXp,
        currentStreak: newStreak,
        isLevelUp,
      },
    };
  }
}

export const globalApiSimulator = new FlashAiApiSimulator();
