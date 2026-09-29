"use client";

import { useEffect, useState } from "react";

export default function LivePresenceBadge() {
  const [activeCount, setActiveCount] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;

    async function fetchPresence() {
      try {
        const res = await fetch("/api/presence");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && typeof data.activeUsers === "number") {
          setActiveCount(Math.max(1, data.activeUsers));
        }
      } catch {
        // Fallback silently
      }
    }

    fetchPresence();
    const interval = setInterval(fetchPresence, 20_000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-sm"
      title={`${activeCount} learner(s) active on FlashAI in real time`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>
        {activeCount} {activeCount === 1 ? "learner online" : "learners online"}
      </span>
    </div>
  );
}
