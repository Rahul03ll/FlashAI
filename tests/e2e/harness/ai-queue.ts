/**
 * AI Concurrency Queue Simulator for FlashAI E2E Test Suite.
 * Buffers burst AI generation/explanation tasks under concurrency limit.
 */

export interface QueueJob<T> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  enqueuedAt: number;
}

export class AiConcurrencyQueue {
  private concurrency: number;
  private activeCount = 0;
  private queue: QueueJob<unknown>[] = [];
  private totalEnqueued = 0;
  private totalCompleted = 0;
  private totalFailed = 0;

  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  get stats() {
    return {
      concurrency: this.concurrency,
      active: this.activeCount,
      queued: this.queue.length,
      totalEnqueued: this.totalEnqueued,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
    };
  }

  reset() {
    this.queue = [];
    this.activeCount = 0;
    this.totalEnqueued = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    this.totalEnqueued++;

    if (this.activeCount < this.concurrency) {
      return this.executeImmediate(task);
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: `job-${this.totalEnqueued}`,
        task: task as () => Promise<unknown>,
        resolve: resolve as (val: unknown) => void,
        reject,
        enqueuedAt: Date.now(),
      });
    });
  }

  private async executeImmediate<T>(task: () => Promise<T>): Promise<T> {
    this.activeCount++;
    try {
      const result = await task();
      this.totalCompleted++;
      return result;
    } catch (err) {
      this.totalFailed++;
      throw err;
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  private processNext() {
    if (this.queue.length === 0 || this.activeCount >= this.concurrency) {
      return;
    }

    const nextJob = this.queue.shift();
    if (!nextJob) return;

    this.activeCount++;
    Promise.resolve()
      .then(() => nextJob.task())
      .then((val) => {
        this.totalCompleted++;
        nextJob.resolve(val);
      })
      .catch((err) => {
        this.totalFailed++;
        nextJob.reject(err);
      })
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }
}

export const globalAiQueue = new AiConcurrencyQueue(2);
