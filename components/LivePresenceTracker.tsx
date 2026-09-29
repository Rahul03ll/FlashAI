"use client";

import { useEffect } from "react";
import { getOrCreateLocalUserId } from "@/lib/client-user";

/**
 * Headless client component that sends background presence heartbeats
 * to keep live user counts accurate across concurrent learners.
 */
export default function LivePresenceTracker() {
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const userId = getOrCreateLocalUserId();
        if (!userId) return;

        await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch {
        // Silent failure for background presence telemetry
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Heartbeat every 45 seconds
    const interval = setInterval(sendHeartbeat, 45_000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
