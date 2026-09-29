import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";
import { PresenceTracker } from "../harness/presence-tracker";

describe("Tier 1: Feature 7 - Live Presence Heartbeat (R3)", () => {
  let tracker: PresenceTracker;
  let api: FlashAiApiSimulator;

  beforeEach(() => {
    tracker = new PresenceTracker(60_000); // 60s sliding window
    api = new FlashAiApiSimulator(undefined, undefined, tracker);
  });

  it("7.1 records user heartbeat and counts user as active in live presence", () => {
    const res = api.heartbeat("user-alpha");
    expect(res.status).toBe(200);
    expect(res.data.activeUsers).toBe(1);

    const activeList = tracker.getActiveUsers();
    expect(activeList).toContain("user-alpha");
  });

  it("7.2 aggregates distinct active users within 60-second sliding window", () => {
    const now = Date.now();
    api.heartbeat("user-1", now);
    api.heartbeat("user-2", now + 100);
    const res = api.heartbeat("user-3", now + 200);

    expect(res.status).toBe(200);
    expect(res.data.activeUsers).toBe(3);
  });

  it("7.3 multiple heartbeats from same user update timestamp without inflating count", () => {
    const now = Date.now();
    api.heartbeat("user-steady", now);
    api.heartbeat("user-steady", now + 5_000);
    api.heartbeat("user-steady", now + 10_000);
    const finalRes = api.heartbeat("user-steady", now + 15_000);

    expect(finalRes.status).toBe(200);
    expect(finalRes.data.activeUsers).toBe(1);
  });

  it("7.4 automatically drops inactive users whose heartbeat is older than 60 seconds", () => {
    const t0 = 1_000_000;
    api.heartbeat("user-expiring", t0);
    api.heartbeat("user-staying", t0 + 30_000);

    expect(tracker.getActiveCount(t0 + 35_000)).toBe(2);

    // At t0 + 65_000, user-expiring has dropped off (>60s)
    const tLater = t0 + 65_000;
    expect(tracker.getActiveCount(tLater)).toBe(1);
    expect(tracker.getActiveUsers(tLater)).toEqual(["user-staying"]);
  });

  it("7.5 community activity feed (/api/community/activity) reflects current live count", () => {
    const now = Date.now();
    api.heartbeat("u1", now);
    api.heartbeat("u2", now);

    const activityRes = api.getActivity(now);
    expect(activityRes.status).toBe(200);
    expect(activityRes.data.liveCount).toBe(2);
    expect(activityRes.data.events.length).toBeGreaterThan(0);
  });

  it("7.6 maintains default community baseline count of at least 1 when no active users", () => {
    expect(tracker.getActiveCount()).toBe(1);
  });
});
