import { describe, it, expect, beforeEach } from "vitest";
import { OfflineStudyQueue, MockLocalStorage } from "../harness/offline-study-queue";

describe("Tier 1: Feature 13 - Client Offline Study Queue (R4)", () => {
  let storage: MockLocalStorage;
  let queue: OfflineStudyQueue;

  beforeEach(() => {
    storage = new MockLocalStorage();
    queue = new OfflineStudyQueue(storage);
  });

  it("13.1 enqueues card reviews in client storage when offline", () => {
    queue.setOnlineStatus(false);
    const item = queue.enqueue("card-101", "easy");

    expect(item).toBeDefined();
    expect(item.cardId).toBe("card-101");
    expect(item.quality).toBe("easy");

    const items = queue.getQueue();
    expect(items.length).toBe(1);
    expect(items[0].cardId).toBe("card-101");
  });

  it("13.2 persists queued reviews across simulated page reloads", () => {
    queue.setOnlineStatus(false);
    queue.enqueue("card-reload-1", "good");
    queue.enqueue("card-reload-2", "hard");

    // Simulate page reload by constructing new queue instance with same storage
    const reloadedQueue = new OfflineStudyQueue(storage);
    const stored = reloadedQueue.getQueue();

    expect(stored.length).toBe(2);
    expect(stored[0].cardId).toBe("card-reload-1");
    expect(stored[1].cardId).toBe("card-reload-2");
  });

  it("13.3 preserves review order (FIFO) and recorded client timestamps", () => {
    const t0 = 1_000_000;
    queue.enqueue("card-1", "easy", t0);
    queue.enqueue("card-2", "good", t0 + 100);
    queue.enqueue("card-3", "hard", t0 + 200);

    const items = queue.getQueue();
    expect(items.map((i) => i.cardId)).toEqual(["card-1", "card-2", "card-3"]);
    expect(items[0].clientTimestamp).toBe(t0);
    expect(items[2].clientTimestamp).toBe(t0 + 200);
  });

  it("13.4 flushes and replays all queued reviews to server when connection restores", async () => {
    queue.setOnlineStatus(false);
    queue.enqueue("card-flush-1", "good");
    queue.enqueue("card-flush-2", "easy");

    // Network restores
    queue.setOnlineStatus(true);
    const syncedCards: string[] = [];

    const flushResult = await queue.flush(async (review) => {
      syncedCards.push(review.cardId);
      return true; // Server processed successfully
    });

    expect(flushResult.synced).toBe(2);
    expect(flushResult.failed).toBe(0);
    expect(flushResult.remaining).toBe(0);
    expect(syncedCards).toEqual(["card-flush-1", "card-flush-2"]);
    expect(queue.getQueue().length).toBe(0);
  });

  it("13.5 handles retry logic and retains items when server request fails during flush", async () => {
    queue.setOnlineStatus(true);
    queue.enqueue("card-ok", "good");
    queue.enqueue("card-fail", "hard");

    const flushResult = await queue.flush(async (review) => {
      if (review.cardId === "card-fail") {
        return false; // Server error
      }
      return true;
    });

    expect(flushResult.synced).toBe(1);
    expect(flushResult.failed).toBe(1);
    expect(flushResult.remaining).toBe(1);

    const remaining = queue.getQueue();
    expect(remaining.length).toBe(1);
    expect(remaining[0].cardId).toBe("card-fail");
    expect(remaining[0].retryCount).toBe(1);
  });

  it("13.6 deduplicates reviews if identical action was already queued", () => {
    const timestamp = 500_000;
    queue.enqueue("card-dup", "easy", timestamp);
    queue.enqueue("card-dup", "easy", timestamp); // Identical

    const items = queue.getQueue();
    expect(items.length).toBe(1);
  });
});
