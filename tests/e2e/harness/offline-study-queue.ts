/**
 * Client-Side Offline Study Queue Simulator for FlashAI E2E Test Suite.
 * Mirrors lib/study-queue.ts behavior:
 * Preserves reviews in localStorage during network disconnects and replays them on reconnect.
 */

export interface QueuedReview {
  id: string;
  cardId: string;
  deckId?: string;
  quality: "hard" | "good" | "easy";
  clientTimestamp: number;
  retryCount: number;
}

export class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class OfflineStudyQueue {
  private storage: MockLocalStorage;
  private storageKey: string;
  private isOnline = true;

  constructor(storage = new MockLocalStorage(), storageKey = "flashai_offline_study_queue") {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  setOnlineStatus(online: boolean) {
    this.isOnline = online;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  getQueue(): QueuedReview[] {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedReview[]) {
    this.storage.setItem(this.storageKey, JSON.stringify(queue));
  }

  enqueue(cardId: string, quality: "hard" | "good" | "easy", clientTimestamp = Date.now(), deckId?: string): QueuedReview {
    const queue = this.getQueue();
    // Deduplication check: do not add identical cardId with identical clientTimestamp
    const existing = queue.find((r) => r.cardId === cardId && r.clientTimestamp === clientTimestamp);
    if (existing) return existing;

    const item: QueuedReview = {
      id: `rev-${Math.random().toString(36).substring(2, 9)}`,
      cardId,
      deckId,
      quality,
      clientTimestamp,
      retryCount: 0,
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  async flush(
    syncHandler: (review: QueuedReview) => Promise<boolean>
  ): Promise<{ synced: number; failed: number; remaining: number }> {
    if (!this.isOnline) {
      return { synced: 0, failed: 0, remaining: this.getQueue().length };
    }

    const queue = this.getQueue();
    if (queue.length === 0) {
      return { synced: 0, failed: 0, remaining: 0 };
    }

    const remainingQueue: QueuedReview[] = [];
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const success = await syncHandler(item);
        if (success) {
          synced++;
        } else {
          item.retryCount++;
          remainingQueue.push(item);
          failed++;
        }
      } catch {
        item.retryCount++;
        remainingQueue.push(item);
        failed++;
      }
    }

    this.saveQueue(remainingQueue);
    return { synced, failed, remaining: remainingQueue.length };
  }

  clear() {
    this.storage.removeItem(this.storageKey);
  }
}
