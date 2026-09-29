import { describe, it, expect, beforeEach } from "vitest";
import { AiConcurrencyQueue } from "../harness/ai-queue";

describe("Tier 2: Boundary 6 - AI Concurrency Queue Edge Cases", () => {
  let queue: AiConcurrencyQueue;

  beforeEach(() => {
    queue = new AiConcurrencyQueue(1); // Serial execution
  });

  it("B6.1 concurrency limit of 1 enforces strict serial execution", async () => {
    const activeAtAnyTime: number[] = [];
    let currentlyRunning = 0;

    const makeTask = (delayMs: number) => async () => {
      currentlyRunning++;
      activeAtAnyTime.push(currentlyRunning);
      await new Promise((r) => setTimeout(r, delayMs));
      currentlyRunning--;
      return delayMs;
    };

    const p1 = queue.run(makeTask(20));
    const p2 = queue.run(makeTask(20));
    const p3 = queue.run(makeTask(20));

    await Promise.all([p1, p2, p3]);

    expect(Math.max(...activeAtAnyTime)).toBe(1);
    expect(queue.stats.totalCompleted).toBe(3);
  });

  it("B6.2 heavy burst load of 25 simultaneous asynchronous tasks resolves all 25 without drops", async () => {
    const q2 = new AiConcurrencyQueue(3);
    const tasks = Array.from({ length: 25 }, (_, i) => () => Promise.resolve(`task-${i}`));

    const results = await Promise.all(tasks.map((t) => q2.run(t)));
    expect(results.length).toBe(25);
    expect(q2.stats.totalCompleted).toBe(25);
    expect(q2.stats.queued).toBe(0);
    expect(q2.stats.active).toBe(0);
  });

  it("B6.3 task throwing uncaught error does not stall subsequent queued tasks", async () => {
    const q = new AiConcurrencyQueue(1);

    const failingTask = q.run(async () => {
      throw new Error("AI Model Timeout");
    });
    const succeedingTask = q.run(async () => "recovered-data");

    await expect(failingTask).rejects.toThrow("AI Model Timeout");
    const result = await succeedingTask;

    expect(result).toBe("recovered-data");
    expect(q.stats.totalFailed).toBe(1);
    expect(q.stats.totalCompleted).toBe(1);
  });

  it("B6.4 handles immediate zero-delay synchronous returns without race conditions", async () => {
    const q = new AiConcurrencyQueue(2);
    const promises: Promise<number>[] = [];

    for (let i = 0; i < 10; i++) {
      promises.push(q.run(async () => i * 2));
    }

    const resolved = await Promise.all(promises);
    expect(resolved).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  });

  it("B6.5 dynamic task completion with varying durations finishes cleanly", async () => {
    const q = new AiConcurrencyQueue(2);
    const completed: string[] = [];

    const tFast = q.run(async () => {
      await new Promise((r) => setTimeout(r, 10));
      completed.push("fast");
    });
    const tSlow = q.run(async () => {
      await new Promise((r) => setTimeout(r, 40));
      completed.push("slow");
    });
    const tQueued = q.run(async () => {
      completed.push("queued");
    });

    await Promise.all([tFast, tSlow, tQueued]);
    // tFast completes first, liberating a slot for tQueued before tSlow finishes
    expect(completed).toEqual(["fast", "queued", "slow"]);
  });
});
