import { describe, it, expect, beforeEach } from "vitest";
import { OfflineStudyQueue, MockLocalStorage } from "../harness/offline-study-queue";

describe("Tier 2: Boundary 13 - Offline Queue Edge Cases & Disconnects", () => {
  let storage: MockLocalStorage;
  let queue: OfflineStudyQueue;

  beforeEach(() => {
    storage = new MockLocalStorage();
    queue = new OfflineStudyQueue(storage);
  });

  it("B13.1 flushing empty offline queue returns 0 synced and 0 failed without error", async () => {
    const res = await queue.flush(async () => true);
    expect(res.synced).toBe(0);
    expect(res.failed).toBe(0);
    expect(res.remaining).toBe(0);
  });

  it("B13.2 partial network failure during flush retains unsynced items with incremented retry count", async () => {
    queue.enqueue("card-1", "good");
    queue.enqueue("card-2", "easy");
    queue.enqueue("card-3", "hard");

    let counter = 0;
    const res = await queue.flush(async () => {
      counter++;
      // card-2 fails
      return counter !== 2;
    });

    expect(res.synced).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.remaining).toBe(1);

    const remainingItems = queue.getQueue();
    expect(remainingItems.length).toBe(1);
    expect(remainingItems[0].cardId).toBe("card-2");
    expect(remainingItems[0].retryCount).toBe(1);
  });

  it("B13.3 large offline queue (30 reviews) flushes completely in sequential order", async () => {
    const processedOrder: string[] = [];

    for (let i = 0; i < 30; i++) {
      queue.enqueue(`card-bulk-${i}`, "good", 1000 + i);
    }

    const res = await queue.flush(async (r) => {
      processedOrder.push(r.cardId);
      return true;
    });

    expect(res.synced).toBe(30);
    expect(processedOrder.length).toBe(30);
    expect(processedOrder[0]).toBe("card-bulk-0");
    expect(processedOrder[29]).toBe("card-bulk-29");
  });

  it("B13.4 duplicate identical review attempts are deduplicated in queue", () => {
    const t = 1234567;
    queue.enqueue("card-same", "good", t);
    queue.enqueue("card-same", "good", t);

    expect(queue.getQueue().length).toBe(1);
  });

  it("B13.5 corrupt/unparseable localStorage content handled gracefully by falling back to empty queue", () => {
    storage.setItem("flashai_offline_study_queue", "{ broken json bad syntax");

    const items = queue.getQueue();
    expect(items).toEqual([]);
  });
});
