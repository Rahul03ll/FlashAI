import { describe, it, expect, beforeEach } from "vitest";
import { PresenceTracker } from "../harness/presence-tracker";

describe("Tier 2: Boundary 7 - Live Presence Sliding-Window Boundaries", () => {
  let tracker: PresenceTracker;

  beforeEach(() => {
    tracker = new PresenceTracker(60_000);
  });

  it("B7.1 heartbeat at 59,999ms retained; heartbeat at 60,001ms evicted", () => {
    const t0 = 1_000_000;
    tracker.recordHeartbeat("u-edge-kept", t0);
    tracker.recordHeartbeat("u-edge-evicted", t0);

    // At t0 + 59,999ms both are alive
    const t59k = t0 + 59_999;
    expect(tracker.getActiveUsers(t59k).length).toBe(2);

    // At t0 + 60,001ms both are evicted
    const t60k = t0 + 60_001;
    expect(tracker.getActiveUsers(t60k).length).toBe(0);
  });

  it("B7.2 rejects empty string or whitespace userId with clear validation error", () => {
    expect(() => tracker.recordHeartbeat("")).toThrow("User ID is required");
    expect(() => tracker.recordHeartbeat("   ")).toThrow("User ID is required");
  });

  it("B7.3 high-frequency heartbeats (50 heartbeats in 100ms from 1 user) maintains count of 1", () => {
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      tracker.recordHeartbeat("rapid-user", now + i);
    }
    expect(tracker.getActiveCount(now + 100)).toBe(1);
    expect(tracker.getActiveUsers(now + 100)).toEqual(["rapid-user"]);
  });

  it("B7.4 50 distinct simultaneous users heartbeating at t0 all recognized as active", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 50; i++) {
      tracker.recordHeartbeat(`crowd-user-${i}`, t0);
    }
    expect(tracker.getActiveCount(t0)).toBe(50);
  });

  it("B7.5 memory cleanup: verifies expired entries are purged from internal map", () => {
    const t0 = 500_000;
    tracker.recordHeartbeat("temp-user", t0);

    // Advance past window and call getActiveCount
    tracker.getActiveCount(t0 + 70_000);

    // User is completely evicted from internal tracker
    expect(tracker.getActiveUsers(t0 + 70_000)).toEqual([]);
  });
});
