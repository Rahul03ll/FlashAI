"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bootstrapUser, switchLocalUserId, logoutClient } from "@/lib/client-user";
import AuthDrawer from "@/components/AuthDrawer";

type UserProfile = {
  id: string;
  name: string;
  displayName: string | null;
  email?: string | null;
  isGuest?: boolean;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
  points: number;
};

export default function UserProfilePill() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
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

  async function handleLogout() {
    if (confirm("Log out and disconnect this browser session? You can log back in anytime with your email.")) {
      await logoutClient();
      window.location.reload();
    }
  }

  if (!profile) return null;

  const displayName = profile.displayName || profile.name;
  const isGuest = profile.isGuest !== false;

  return (
    <div className="relative flex items-center gap-2">
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

      {/* Sync Account / Link Email CTA Button */}
      {isGuest ? (
        <button
          type="button"
          onClick={() => setIsAuthOpen(true)}
          className="hidden sm:flex items-center gap-1 rounded-full border-2 border-ink bg-comic-yellow px-2.5 py-1 text-[11px] font-black text-ink shadow-comic transition-transform hover:-translate-y-0.5 active:translate-y-0"
          title="Link email to persist decks and streaks across devices"
        >
          <span>⚡</span>
          <span>Sync Account</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsAuthOpen(true)}
          className="hidden sm:flex items-center gap-1 rounded-full border border-ink/20 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
          title={`Linked to ${profile.email}`}
        >
          <span>✓</span>
          <span>Synced</span>
        </button>
      )}

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
              className="absolute right-0 top-full mt-2 z-50 w-84 rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0px_#0a0a0f]"
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

              {/* Sync Status Banner */}
              {isGuest ? (
                <div className="mt-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">Guest Profile</span>
                    <span className="rounded-full bg-amber-200/80 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                      Not Synced
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink/70 leading-tight">
                    Link your email to keep your flashcards and memory schedules permanently across devices.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsAuthOpen(true);
                    }}
                    className="mt-2 w-full rounded-xl border-2 border-ink bg-comic-yellow py-1.5 text-xs font-black text-ink shadow-comic transition-all hover:bg-comic-yellow/80"
                  >
                    ⚡ Sync Account With Email
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/80 p-2.5 text-xs text-emerald-950">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-emerald-800">
                      <span>✓</span> Synced Account
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setIsAuthOpen(true);
                      }}
                      className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900"
                    >
                      Switch
                    </button>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-mono text-emerald-800">
                    ✉️ {profile.email}
                  </p>
                </div>
              )}

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

              {/* Account Controls Footer */}
              <div className="mt-4 pt-3 border-t border-black/8 flex items-center justify-between text-[11px]">
                {!isGuest ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="font-semibold text-rose-600 hover:underline"
                  >
                    Log Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateNewUser}
                    className="font-semibold text-accent hover:underline"
                  >
                    + New Live Profile
                  </button>
                )}
                <span className="font-mono text-ink/40 text-[10px]">
                  ID: ...{profile.id.slice(-6)}
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Auth Drawer / Modal */}
      <AuthDrawer
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUserId={profile.id}
        currentUserEmail={profile.email}
        isGuest={isGuest}
        onSuccess={(updatedUser) => {
          setProfile(updatedUser);
          setEditName(updatedUser.displayName || updatedUser.name);
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
}
