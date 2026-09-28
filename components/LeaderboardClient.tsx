"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { bootstrapUser, getOrCreateLocalUserId } from "@/lib/client-user";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
  name?: string;
  displayName: string | null;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
  points: number;
};

export default function LeaderboardClient() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [isBenchmark, setIsBenchmark] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Join / Edit display name form state
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  async function fetchLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load leaderboard.");
      setUsers(data.users ?? []);
      setIsBenchmark(Boolean(data.isBenchmark));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const me = await bootstrapUser();
        if (!mounted) return;
        setCurrentUser({ ...me, points: me.points });
        if (me.displayName) {
          setJoinName(me.displayName);
        }

        const response = await fetch("/api/leaderboard");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load leaderboard.");
        if (!mounted) return;
        setUsers(data.users ?? []);
        setIsBenchmark(Boolean(data.isBenchmark));
      } catch (err) {
        if (!mounted) return;
        setCurrentUser({
          id: getOrCreateLocalUserId(),
          displayName: null,
          xp: 0,
          streak: 0,
          level: "Beginner",
          points: 0,
        });
        setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const myRank = useMemo(() => {
    if (!currentUser || users.length === 0) return null;
    const match = users.find((u) => u.id === currentUser.id);
    return match ? match.rank : null;
  }, [currentUser, users]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;

    const trimmed = joinName.trim();
    if (
      !trimmed ||
      trimmed.length < 2 ||
      trimmed.length > 20 ||
      !/^[a-zA-Z0-9\s]+$/.test(trimmed)
    ) {
      setJoinError("Handle must be 2–20 alphanumeric characters (spaces allowed).");
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
        setJoinError(data.error ?? "Failed to save handle.");
        return;
      }
      setCurrentUser((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
      setIsEditingName(false);
      await fetchLeaderboard();
    } catch {
      setJoinError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-comic-red bg-comic-red/10 p-5 shadow-comic text-comic-red">
        <p className="font-bold">⚠️ Leaderboard Error</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 border-2 border-ink shadow-comic"
          onClick={() => {
            setError(null);
            fetchLeaderboard();
          }}
        >
          Retry Loading
        </Button>
      </div>
    );
  }

  const top3 = users.slice(0, 3);
  const restUsers = users.slice(3);

  return (
    <div className="space-y-6">
      {/* ── CURRENT USER STANDING CARD ── */}
      {currentUser && (
        <Card className="border-2 border-ink bg-white/95 p-5 sm:p-6 shadow-comic">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-comic-yellow font-display text-2xl shadow-comic">
                {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "👤"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-ink sm:text-xl">
                    {currentUser.displayName || "Anonymous Learner"}
                  </h3>
                  <span className="rounded-full border border-black/10 bg-black/5 px-2.5 py-0.5 text-xs font-semibold text-ink/70">
                    {currentUser.level}
                  </span>
                </div>
                <p className="text-xs text-ink/60">
                  {myRank ? (
                    <span className="font-bold text-accent">Rank #{myRank} on Leaderboard</span>
                  ) : (
                    <span>Unranked · Study cards to climb the rankings!</span>
                  )}
                </p>
              </div>
            </div>

            {/* Stats Pills */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="rounded-xl border-2 border-ink/20 bg-comic-blue/15 px-3 py-1.5 text-center">
                <span className="block text-[10px] font-bold uppercase text-ink/50">XP</span>
                <span className="font-bold text-ink text-sm sm:text-base">⚡ {currentUser.xp}</span>
              </div>
              <div className="rounded-xl border-2 border-ink/20 bg-comic-red/15 px-3 py-1.5 text-center">
                <span className="block text-[10px] font-bold uppercase text-ink/50">Streak</span>
                <span className="font-bold text-ink text-sm sm:text-base">🔥 {currentUser.streak}d</span>
              </div>

              {!currentUser.displayName || isEditingName ? (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="rounded-full border-2 border-ink bg-comic-yellow px-3.5 py-1.5 text-xs font-bold text-ink shadow-comic transition-transform hover:-translate-y-0.5"
                >
                  {currentUser.displayName ? "Edit Handle" : "Claim Handle ✍️"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-black/5"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>

          {/* Join or Edit Form */}
          <AnimatePresence>
            {(!currentUser.displayName || isEditingName) && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSaveName}
                className="mt-4 border-t border-black/8 pt-4 overflow-hidden"
              >
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">
                  {currentUser.displayName
                    ? "Update your public display name:"
                    : "👋 Choose your leaderboard handle to start ranking:"}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="e.g. RahulStudyAce"
                    maxLength={20}
                    className="flex-1 rounded-xl border-2 border-ink bg-white px-3.5 py-2 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink/40 shadow-comic focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={joining}
                      variant="accent"
                      size="sm"
                      className="border-2 border-ink shadow-comic"
                    >
                      {joining ? "Saving…" : "Save Handle 🚀"}
                    </Button>
                    {isEditingName && currentUser.displayName && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditingName(false);
                          setJoinError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {joinError && <p className="mt-2 text-xs font-bold text-rose-600">{joinError}</p>}
              </motion.form>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* ── BENCHMARK BANNER (if showing initial community benchmarks) ── */}
      {isBenchmark && (
        <div className="flex items-center gap-2.5 rounded-2xl border-2 border-ink/20 bg-comic-yellow/15 p-3.5 text-xs text-ink/80 shadow-comic">
          <span className="text-lg">💡</span>
          <span>
            <strong>Community Benchmarks Active:</strong> Study flashcard decks to earn XP, maintain your daily streak, and climb above rank #1!
          </span>
        </div>
      )}

      {/* ── TOP 3 PODIUM ── */}
      {top3.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {top3.map((user, idx) => {
            const isCurrent = currentUser?.id === user.id;
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
            const podiumTheme =
              idx === 0
                ? "bg-gradient-to-b from-[#FFFDF0] via-[#FFF9D6] to-[#FFF3B0] border-2 border-ink shadow-comic"
                : idx === 1
                ? "bg-gradient-to-b from-[#F8F9FA] via-[#F1F3F5] to-[#E9ECEF] border-2 border-ink shadow-comic"
                : "bg-gradient-to-b from-[#FFF5ED] via-[#FFE8D6] to-[#FED7AA] border-2 border-ink shadow-comic";

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`relative flex flex-col justify-between rounded-2xl p-5 ${podiumTheme} ${
                  isCurrent ? "ring-4 ring-accent/30" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{medal}</span>
                    <span className="rounded-full border border-ink/20 bg-white/80 px-2 py-0.5 text-xs font-mono font-bold text-ink">
                      Rank #{user.rank}
                    </span>
                  </div>

                  <h4 className="mt-3 font-display text-base font-bold text-ink truncate sm:text-lg">
                    {user.displayName} {isCurrent ? <span className="text-accent text-xs">(You)</span> : ""}
                  </h4>
                  <span className="inline-block mt-0.5 text-xs text-ink/60">
                    {user.level}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-black/8 flex items-center justify-between text-xs">
                  <span className="font-extrabold text-ink text-sm sm:text-base">
                    ⚡ {user.xp} XP
                  </span>
                  {user.streak > 0 && (
                    <span className="font-semibold text-rose-600">
                      🔥 {user.streak}d
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── FULL RANKING TABLE ── */}
      <Card className="border-2 border-ink bg-white/95 p-5 shadow-comic">
        <div className="flex items-center justify-between border-b border-black/8 pb-3">
          <h3 className="font-display text-lg font-bold text-ink">Global Standings</h3>
          <span className="text-xs font-bold text-ink/50">{users.length} Ranked Learners</span>
        </div>

        {users.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-ink/20 py-10 text-center text-sm text-ink/50">
            No rankings yet. Start studying cards to claim rank #1!
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {users.map((user, index) => {
              const isCurrent = currentUser?.id === user.id;
              const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

              return (
                <motion.li
                  key={user.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center justify-between rounded-xl border-2 p-3 sm:px-4 sm:py-3.5 transition-all ${
                    isCurrent
                      ? "border-accent bg-accent/10 shadow-comic"
                      : "border-ink/20 bg-white/80 hover:border-ink hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center font-display font-bold text-ink text-sm">
                      {medal ?? `#${user.rank}`}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-display text-sm sm:text-base font-bold text-ink">
                        {user.displayName}
                        {isCurrent && (
                          <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                            YOU
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink/50">
                        {user.level === "Master" ? "👑 Master" : user.level === "Learner" ? "⚡ Learner" : "🌱 Beginner"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-sm sm:text-base font-bold text-ink">
                      {user.xp} XP
                    </p>
                    {user.streak > 0 ? (
                      <p className="text-xs font-semibold text-rose-600">
                        🔥 {user.streak}d streak
                      </p>
                    ) : (
                      <p className="text-xs text-ink/40">Active today</p>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-black/8 pt-4">
          <p className="text-xs text-ink/60">
            Ratings: <strong>Easy (+10 XP)</strong> · <strong>Good (+5 XP)</strong> · <strong>Hard (+2 XP)</strong> · <strong>Quiz (+15 XP)</strong>
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-comic-yellow px-4 py-1.5 text-xs font-bold text-ink shadow-comic transition-all hover:translate-x-0.5"
          >
            <span>Study Decks to Climb</span>
            <span>⚡</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
