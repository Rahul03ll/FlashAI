"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ActivityEvent = {
  id: string;
  type: string;
  text: string;
  timestamp: string;
};

export default function CommunityActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liveCount, setLiveCount] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function fetchActivity() {
      try {
        const res = await fetch("/api/community/activity");
        const data = await res.json();
        if (!mounted) return;
        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
          setEvents(data.events);
        }
        if (data.liveCount) {
          setLiveCount(data.liveCount);
        }
      } catch {
        // silent fallback
      }
    }

    fetchActivity();
    const fetchInterval = setInterval(fetchActivity, 25000);

    return () => {
      mounted = false;
      clearInterval(fetchInterval);
    };
  }, []);

  // Cycle through events every 4.5 seconds
  useEffect(() => {
    if (events.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [events.length]);

  const activeEvent = events[currentIndex];

  if (!activeEvent) return null;

  return (
    <div className="flex items-center justify-between overflow-hidden rounded-2xl border-2 border-ink bg-white/90 px-3.5 py-2 shadow-comic text-xs">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/20 px-2 py-0.5 font-mono text-[10px] font-bold text-ink shrink-0">
          <span className="inline-block h-2 w-2 rounded-full bg-mint animate-pulse" />
          COMMUNITY LIVE ({liveCount})
        </span>

        <AnimatePresence mode="wait">
          <motion.p
            key={activeEvent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="truncate text-ink/80 font-medium"
          >
            {activeEvent.text}
          </motion.p>
        </AnimatePresence>
      </div>

      <span className="hidden sm:inline text-[10px] font-mono text-ink/40 shrink-0 ml-2">
        Real-time
      </span>
    </div>
  );
}
