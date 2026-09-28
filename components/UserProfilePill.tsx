"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bootstrapUser, switchLocalUserId } from "@/lib/client-user";

type UserProfile = {
  id: string;
  name: string;
  displayName: string | null;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
  points: number;
};

export default function UserProfilePill() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const u = await bootstrapUser();
        if (!mounted) return;
        setProfile(u);
        setEditName(u.displayName || u.name);
      } catch {
        // silent fallback
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleUpdateHandle(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 20 || !/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
      setSaveMessage("Handle must be 2–20 alphanumeric chars.");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/leaderboard/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error ?? "Failed to save.");
        return;
      }
      setProfile((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
      setSaveMessage("✓ Handle updated!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage("Network error.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCreateNewUser() {
    if (confirm("Create a fresh user account on this browser? Your current progress remains tied to its account ID.")) {
      const newId = `user-${crypto.randomUUID()}`;
      switchLocalUserId(newId);
      window.location.reload();
    }
  }

  if (!profile) return null;

  const displayName = profile.displayName || profile.name;

  return (
    <div className="relative">
      {/* Pill trigger in navbar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-white/90 px-3 py-1 text-xs font-bold text-ink shadow-comic transition-transform hover:-translate-y-0.5 active:translate-y-0"
        title="View profile and account settings"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-comic-yellow text-xs">
          👤
        </span>
        <span className="max-w-[100px] truncate sm:max-w-[140px]">{displayName}</span>
        <span className="hidden sm:inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.2 text-[10px] text-accent">
          ⚡{profile.xp}
        </span>
        {profile.streak > 0 && (
          <span className="hidden sm:inline-flex items-center text-[10px] text-rose-600">
            🔥{profile.streak}
          </span>
        )}
      </button>

      {/* Modal / Drawer Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0px_#0a0a0f]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black/8 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink bg-comic-yellow font-display text-lg shadow-xs">
                    👤
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-ink truncate max-w-[180px]">
                      {displayName}
                    </h4>
                    <span className="rounded-full bg-black/5 px-2 py-0.2 text-[10px] font-semibold text-ink/60">
                      {profile.level} Learner
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-black/10 p-1 text-xs text-ink/50 hover:bg-black/5 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              {/* Stats Grid */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-xl border border-black/8 bg-comic-blue/10 p-2">
                  <span className="block text-[10px] font-bold text-ink/50 uppercase">XP Earned</span>
                  <span className="font-bold text-ink text-sm">⚡ {profile.xp}</span>
                </div>
                <div className="rounded-xl border border-black/8 bg-comic-red/10 p-2">
                  <span className="block text-[10px] font-bold text-ink/50 uppercase">Daily Streak</span>
                  <span className="font-bold text-ink text-sm">🔥 {profile.streak} Days</span>
                </div>
              </div>

              {/* Edit Handle Form */}
              <form onSubmit={handleUpdateHandle} className="mt-3.5 space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-ink/60">
                  Learner Handle
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={20}
                    placeholder="Enter public name"
                    className="flex-1 rounded-xl border-2 border-ink bg-white px-2.5 py-1 text-xs font-semibold text-ink outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl border-2 border-ink bg-comic-yellow px-3 py-1 text-xs font-bold text-ink shadow-comic transition-all hover:bg-comic-yellow/80 disabled:opacity-50"
                  >
                    {isSaving ? "..." : "Save"}
                  </button>
                </div>
                {saveMessage && (
                  <p
                    className={`text-[11px] font-bold ${
                      saveMessage.startsWith("✓") ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {saveMessage}
                  </p>
                )}
              </form>

              {/* Account Switcher for multi-user shared devices */}
              <div className="mt-4 pt-3 border-t border-black/8 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={handleCreateNewUser}
                  className="font-semibold text-accent hover:underline"
                >
                  + New Live Profile
                </button>
                <span className="font-mono text-ink/40 text-[10px]">
                  ID: ...{profile.id.slice(-6)}
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
