"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bootstrapUser, getOrCreateLocalUserId } from "@/lib/client-user";
import Card from "@/components/ui/Card";

type LeaderboardUser = {
  id: string;
  rank: number;
  displayName: string;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
};

type UserData = {
  id: string;
  displayName: string | null;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
  points: number;
};


export default function LeaderboardClient() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Join form state
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function fetchLeaderboard() {
    const response = await fetch("/api/leaderboard");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to load leaderboard.");
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const me = await bootstrapUser();
        if (!mounted) return;
        setCurrentUser({ ...me, points: me.points });

        const response = await fetch("/api/leaderboard");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load leaderboard.");
        if (!mounted) return;
        setUsers(data.users ?? []);
      } catch (err) {
        if (!mounted) return;
        setCurrentUser({ id: getOrCreateLocalUserId(), displayName: null, xp: 0, streak: 0, level: "Beginner", points: 0 });
        setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;

    const trimmed = joinName.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 20 || !/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
      setJoinError("Display name must be 2–20 alphanumeric characters (spaces allowed).");
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/leaderboard/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join leaderboard.");
        return;
      }
      setCurrentUser((prev) => prev ? { ...prev, displayName: trimmed } : prev);
      await fetchLeaderboard();
    } catch {
      setJoinError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  if (error) {
    return <p className="bg-comic-red/10 border-2 border-comic-red text-comic-red rounded-xl px-4 py-3 text-sm">{error}</p>;
  }

  return (
    <Card className="p-5">
      <h2 className="text-xl text-ink">🏆 Leaderboard</h2>
      <p className="mt-1 text-sm text-ink/65">Top learners ranked by points and streak.</p>

      {currentUser && (currentUser.displayName === null || currentUser.displayName === undefined) && (
        <form onSubmit={handleJoin} className="mt-4 rounded-xl border border-black/10 bg-white/80 px-4 py-4">
          <p className="mb-2 text-sm font-medium text-ink">Join the leaderboard with a display name:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your display name"
              maxLength={20}
              className="flex-1 rounded-lg border border-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={joining}
              className="rounded-lg border-2 border-ink bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {joining ? "Joining…" : "Join"}
            </button>
          </div>
          {joinError && <p className="mt-2 text-xs text-rose-600">{joinError}</p>}
        </form>
      )}

      {users.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-black/20 px-4 py-6 text-center text-sm text-ink/50">
          No rankings yet. Start studying to claim rank #1.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {users.map((user, index) => {

            const isCurrent = currentUser ? user.id === currentUser.id : false;

            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
            return (
              <motion.li
                key={index}

                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isCurrent
                    ? "border-accent/40 bg-accent/10"
                    : index < 3
                    ? `shadow-comic-lg border-2 border-ink ${index === 0 ? "bg-comic-yellow/20" : "bg-white/80"}`
                    : "border-black/10 bg-white/80"
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {medal && <span className="text-3xl">{medal}</span>}
                  <div>

                      <p className="truncate font-medium text-ink">
                        #{user.rank} {user.displayName} {isCurrent ? <span className="text-accent">(You)</span> : ""}
                      </p>
                      <p className="text-xs text-ink/50">{user.level}</p>

                  </div>
                </div>
                <div className="text-right text-sm text-ink/70">

  <p className="font-semibold text-ink">{user.xp} XP</p>
  {user.streak > 0 && <p className="text-xs">🔥 {user.streak} day streak</p>}

                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
