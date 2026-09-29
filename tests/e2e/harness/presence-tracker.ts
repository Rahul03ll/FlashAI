/**
 * Live Presence Heartbeat Tracker Simulator for FlashAI E2E Test Suite.
 * Mirrors the exact contract from PROJECT.md:
 * POST /api/presence/heartbeat -> { activeUsers: number }
 */

export class PresenceTracker {
  private heartbeats = new Map<string, number>(); // userId -> timestamp
  private windowMs: number;

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs;
  }

  reset() {
    this.heartbeats.clear();
  }

  recordHeartbeat(userId: string, now = Date.now()): { activeUsers: number } {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      throw new Error("User ID is required for presence heartbeat.");
    }
    this.heartbeats.set(userId.trim(), now);
    return { activeUsers: this.getActiveCount(now) };
  }

  getActiveCount(now = Date.now()): number {
    const threshold = now - this.windowMs;
    let count = 0;
    for (const [userId, timestamp] of this.heartbeats.entries()) {
      if (timestamp > threshold) {
        count++;
      } else {
        // Evict expired heartbeat to conserve memory
        this.heartbeats.delete(userId);
      }
    }
    return Math.max(1, count); // Baseline community minimum of 1
  }

  getActiveUsers(now = Date.now()): string[] {
    const threshold = now - this.windowMs;
    const active: string[] = [];
    for (const [userId, timestamp] of this.heartbeats.entries()) {
      if (timestamp > threshold) {
        active.push(userId);
      }
    }
    return active;
  }
}

export const globalPresenceTracker = new PresenceTracker(60_000);
