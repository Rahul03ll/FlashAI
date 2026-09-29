/**
 * In-Memory Database Simulator for FlashAI Multi-User E2E Test Suite.
 * Mirrors Prisma data models and relations with transaction-like isolation.
 */

export interface DbUser {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
  points: number;
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  lastStudiedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbDeck {
  id: string;
  title: string;
  sourceFileName: string | null;
  shareToken: string | null;
  isPublic: boolean;
  userId: string | null;
  upvoteCount: number;
  cloneCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastStudied: Date | null;
}

export interface DbFlashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
  difficultyScore: number;
  ease: number;
  interval: number;
  repetitions: number;
  dueDate: Date;
  deckId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbOtpRecord {
  email: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

export interface DbActivityEvent {
  id: string;
  type: "deck" | "streak" | "xp" | "welcome" | "tip";
  text: string;
  timestamp: Date;
}

export class InMemoryDb {
  users = new Map<string, DbUser>();
  decks = new Map<string, DbDeck>();
  cards = new Map<string, DbFlashcard>();
  upvotes = new Set<string>(); // key: `${userId}:${deckId}`
  bookmarks = new Set<string>(); // key: `${userId}:${deckId}`
  otps = new Map<string, DbOtpRecord>(); // key: email
  activities: DbActivityEvent[] = [];

  reset() {
    this.users.clear();
    this.decks.clear();
    this.cards.clear();
    this.upvotes.clear();
    this.bookmarks.clear();
    this.otps.clear();
    this.activities = [];
  }

  // --- User Operations ---
  createUser(data: Partial<DbUser> & { id: string }): DbUser {
    const user: DbUser = {
      id: data.id,
      name: data.name ?? `Learner-${data.id.slice(-4).toUpperCase()}`,
      displayName: data.displayName ?? null,
      email: data.email ?? null,
      points: data.points ?? 0,
      xp: data.xp ?? 0,
      streak: data.streak ?? 0,
      lastActiveDay: data.lastActiveDay ?? null,
      lastStudiedDate: data.lastStudiedDate ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return { ...user };
  }

  getUser(id: string): DbUser | null {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  findUserByEmail(email: string): DbUser | null {
    for (const user of this.users.values()) {
      if (user.email?.toLowerCase() === email.toLowerCase()) {
        return { ...user };
      }
    }
    return null;
  }

  updateUser(id: string, updates: Partial<DbUser>): DbUser {
    const existing = this.users.get(id);
    if (!existing) throw new Error(`User not found: ${id}`);
    const updated: DbUser = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return { ...updated };
  }

  // --- Deck Operations ---
  createDeck(data: Partial<DbDeck> & { title: string; userId?: string | null }): DbDeck {
    const id = data.id ?? `deck-${Math.random().toString(36).substring(2, 9)}`;
    const deck: DbDeck = {
      id,
      title: data.title,
      sourceFileName: data.sourceFileName ?? null,
      shareToken: data.shareToken ?? null,
      isPublic: data.isPublic ?? false,
      userId: data.userId ?? null,
      upvoteCount: data.upvoteCount ?? 0,
      cloneCount: data.cloneCount ?? 0,
      createdAt: data.createdAt ?? new Date(),
      updatedAt: new Date(),
      lastStudied: data.lastStudied ?? null,
    };
    this.decks.set(id, deck);
    return { ...deck };
  }

  getDeck(id: string): (DbDeck & { cards: DbFlashcard[] }) | null {
    const deck = this.decks.get(id);
    if (!deck) return null;
    const cards = this.getCardsForDeck(id);
    return { ...deck, cards };
  }

  getDecksForUser(userId: string): DbDeck[] {
    return Array.from(this.decks.values())
      .filter((d) => d.userId === userId)
      .map((d) => ({ ...d }));
  }

  getPublicDecks(): (DbDeck & { cards: DbFlashcard[] })[] {
    return Array.from(this.decks.values())
      .filter((d) => d.isPublic)
      .map((d) => ({ ...d, cards: this.getCardsForDeck(d.id) }));
  }

  updateDeck(id: string, updates: Partial<DbDeck>): DbDeck {
    const existing = this.decks.get(id);
    if (!existing) throw new Error(`Deck not found: ${id}`);
    const updated: DbDeck = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.decks.set(id, updated);
    return { ...updated };
  }

  // --- Flashcard Operations ---
  createCard(data: Partial<DbFlashcard> & { deckId: string; question: string; answer: string }): DbFlashcard {
    const id = data.id ?? `card-${Math.random().toString(36).substring(2, 9)}`;
    const card: DbFlashcard = {
      id,
      deckId: data.deckId,
      question: data.question,
      answer: data.answer,
      type: data.type ?? "definition",
      difficultyScore: data.difficultyScore ?? 0,
      ease: data.ease ?? 2.5,
      interval: data.interval ?? 1,
      repetitions: data.repetitions ?? 0,
      dueDate: data.dueDate ?? new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cards.set(id, card);
    return { ...card };
  }

  getCard(id: string): DbFlashcard | null {
    const card = this.cards.get(id);
    return card ? { ...card } : null;
  }

  getCardsForDeck(deckId: string): DbFlashcard[] {
    return Array.from(this.cards.values())
      .filter((c) => c.deckId === deckId)
      .map((c) => ({ ...c }));
  }

  updateCard(id: string, updates: Partial<DbFlashcard>): DbFlashcard {
    const existing = this.cards.get(id);
    if (!existing) throw new Error(`Card not found: ${id}`);
    const updated: DbFlashcard = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.cards.set(id, updated);
    return { ...updated };
  }

  // --- Upvote Operations ---
  toggleUpvote(deckId: string, userId: string): { upvoted: boolean; count: number } {
    const deck = this.decks.get(deckId);
    if (!deck) throw new Error(`Deck not found: ${deckId}`);
    const key = `${userId}:${deckId}`;
    let upvoted = false;
    if (this.upvotes.has(key)) {
      this.upvotes.delete(key);
      deck.upvoteCount = Math.max(0, deck.upvoteCount - 1);
      upvoted = false;
    } else {
      this.upvotes.add(key);
      deck.upvoteCount += 1;
      upvoted = true;
    }
    return { upvoted, count: deck.upvoteCount };
  }

  hasUpvoted(deckId: string, userId: string): boolean {
    return this.upvotes.has(`${userId}:${deckId}`);
  }

  // --- Bookmark Operations ---
  toggleBookmark(deckId: string, userId: string): { bookmarked: boolean } {
    const deck = this.decks.get(deckId);
    if (!deck) throw new Error(`Deck not found: ${deckId}`);
    const key = `${userId}:${deckId}`;
    let bookmarked = false;
    if (this.bookmarks.has(key)) {
      this.bookmarks.delete(key);
      bookmarked = false;
    } else {
      this.bookmarks.add(key);
      bookmarked = true;
    }
    return { bookmarked };
  }

  hasBookmarked(deckId: string, userId: string): boolean {
    return this.bookmarks.has(`${userId}:${deckId}`);
  }

  getBookmarkedDecks(userId: string): DbDeck[] {
    const deckIds = Array.from(this.bookmarks)
      .filter((key) => key.startsWith(`${userId}:`))
      .map((key) => key.split(":")[1]);
    return deckIds.map((id) => this.decks.get(id)!).filter(Boolean).map((d) => ({ ...d }));
  }

  // --- OTP Operations ---
  saveOtp(email: string, code: string, ttlMs = 10 * 60 * 1000, now = Date.now()): DbOtpRecord {
    const record: DbOtpRecord = {
      email: email.toLowerCase(),
      code,
      expiresAt: new Date(now + ttlMs),
      attempts: 0,
      createdAt: new Date(now),
    };
    this.otps.set(email.toLowerCase(), record);
    return { ...record };
  }

  getOtp(email: string): DbOtpRecord | null {
    const record = this.otps.get(email.toLowerCase());
    return record ? { ...record } : null;
  }

  incrementOtpAttempts(email: string): number {
    const record = this.otps.get(email.toLowerCase());
    if (!record) return 0;
    record.attempts += 1;
    return record.attempts;
  }

  deleteOtp(email: string) {
    this.otps.delete(email.toLowerCase());
  }

  // --- Activity Event Operations ---
  addActivity(event: Omit<DbActivityEvent, "id">): DbActivityEvent {
    const fullEvent: DbActivityEvent = {
      id: `event-${Math.random().toString(36).substring(2, 9)}`,
      ...event,
    };
    this.activities.unshift(fullEvent);
    if (this.activities.length > 50) {
      this.activities.pop();
    }
    return fullEvent;
  }

  getRecentActivities(limit = 8): DbActivityEvent[] {
    return this.activities.slice(0, limit);
  }
}

export const globalTestDb = new InMemoryDb();
