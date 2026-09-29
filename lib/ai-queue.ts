/**
 * In-Memory Concurrency Queue for AI calls (Groq / LLMs).
 * Prevents API quota exhaustion, TPM/RPM bursts, and serverless compute overload.
 */

export interface QueuedTask<T> {
  id: string;
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  queuedAt: number;
}

export class AiConcurrencyQueue {
  private maxConcurrency: number;
  private maxQueueLength: number;
  private activeCount = 0;
  private queue: QueuedTask<any>[] = [];

  constructor(maxConcurrency = 3, maxQueueLength = 25) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueueLength = maxQueueLength;
  }

  /**
   * Enqueue an async AI task with concurrency and queue length limits.
   */
  async enqueue<T>(taskFn: () => Promise<T>, timeoutMs = 60_000): Promise<T> {
    if (this.queue.length >= this.maxQueueLength) {
      throw new Error("AI service is currently experiencing high load. Please try again shortly.");
    }

    return new Promise<T>((resolve, reject) => {
      const taskId = `ai_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let timer: NodeJS.Timeout | null = null;

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.removeFromQueue(taskId);
          reject(new Error("AI generation request timed out waiting in processing queue."));
        }, timeoutMs);
      }

      const task: QueuedTask<T> = {
        id: taskId,
        run: taskFn,
        resolve: (val) => {
          if (timer) clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
        queuedAt: Date.now(),
      };

      this.queue.push(task);
      this.processNext();
    });
  }

  private removeFromQueue(taskId: string) {
    const idx = this.queue.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
    }
  }

  private async processNext() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;

    try {
      const result = await task.run();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  get stats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }

  reset() {
    this.queue = [];
    this.activeCount = 0;
  }
}

export const globalAiQueue = new AiConcurrencyQueue(3, 30);
