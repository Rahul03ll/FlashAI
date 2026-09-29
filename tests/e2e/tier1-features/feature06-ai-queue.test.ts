import { describe, it, expect, beforeEach } from "vitest";
import { AiConcurrencyQueue } from "../harness/ai-queue";

describe("Tier 1: Feature 6 - Groq AI Concurrency Queue (R2)", () => {
  let queue: AiConcurrencyQueue;

  beforeEach(() => {
    queue = new AiConcurrencyQueue(2); // Concurrency limit = 2
  });

  it("6.1 immediately executes tasks when active jobs are below concurrency limit", async () => {
    let executed = false;
    const task = async () => {
      executed = true;
      return "done";
    };

    const result = await queue.run(task);
    expect(result).toBe("done");
    expect(executed).toBe(true);
    expect(queue.stats.active).toBe(0);
    expect(queue.stats.totalCompleted).toBe(1);
  });

  it("6.2 enqueues burst tasks when concurrency limit is reached", async () => {
    let releaseFirst: () => void = () => {};
    let releaseSecond: () => void = () => {};

    const job1 = queue.run(
      () =>
        new Promise<string>((resolve) => {
          releaseFirst = () => resolve("job1");
        }),
    );

    const job2 = queue.run(
      () =>
        new Promise<string>((resolve) => {
          releaseSecond = () => resolve("job2");
        }),
    );

    // 3rd job should be queued
    let job3Executed = false;
    const job3 = queue.run(async () => {
      job3Executed = true;
      return "job3";
    });

    expect(queue.stats.active).toBe(2);
    expect(queue.stats.queued).toBe(1);
    expect(job3Executed).toBe(false);

    // Release first job
    releaseFirst();
    await job1;

    // After job 1 completes, job 3 should execute
    const res3 = await job3;
    expect(res3).toBe("job3");
    expect(job3Executed).toBe(true);

    releaseSecond();
    await job2;
  });

  it("6.3 processes queued tasks in strict First-In-First-Out (FIFO) order", async () => {
    let releaseActive: () => void = () => {};
    const order: number[] = [];

    // Fill concurrency slots
    queue.run(
      () =>
        new Promise<void>((resolve) => {
          releaseActive = resolve;
        }),
    );
    queue.run(
      () =>
        new Promise<void>((resolve) => {
          releaseActive = resolve;
        }),
    );

    // Enqueue 3 tasks
    const p1 = queue.run(async () => {
      order.push(1);
    });
    const p2 = queue.run(async () => {
      order.push(2);
    });
    const p3 = queue.run(async () => {
      order.push(3);
    });

    releaseActive();
    await Promise.all([p1, p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("6.4 automatically dispatches next queued job upon active task completion", async () => {
    const queue1 = new AiConcurrencyQueue(1);
    const completedTasks: string[] = [];

    const t1 = queue1.run(async () => {
      completedTasks.push("t1");
    });
    const t2 = queue1.run(async () => {
      completedTasks.push("t2");
    });

    await Promise.all([t1, t2]);
    expect(completedTasks).toEqual(["t1", "t2"]);
    expect(queue1.stats.queued).toBe(0);
    expect(queue1.stats.active).toBe(0);
  });

  it("6.5 accurately reports queue statistics (active, queued, totalCompleted)", async () => {
    const q = new AiConcurrencyQueue(2);
    expect(q.stats.active).toBe(0);
    expect(q.stats.queued).toBe(0);
    expect(q.stats.totalEnqueued).toBe(0);

    await q.run(async () => "val1");
    await q.run(async () => "val2");

    expect(q.stats.totalCompleted).toBe(2);
    expect(q.stats.totalEnqueued).toBe(2);
  });

  it("6.6 continues processing remaining queue when a task throws an error", async () => {
    const q = new AiConcurrencyQueue(1);
    let task2Completed = false;

    // Task 1 fails
    const failTask = q.run(async () => {
      throw new Error("AI service temporary failure");
    });

    // Task 2 should still execute
    const successTask = q.run(async () => {
      task2Completed = true;
      return "recovered";
    });

    await expect(failTask).rejects.toThrow("AI service temporary failure");
    const res = await successTask;

    expect(res).toBe("recovered");
    expect(task2Completed).toBe(true);
    expect(q.stats.totalFailed).toBe(1);
    expect(q.stats.totalCompleted).toBe(1);
  });
});
