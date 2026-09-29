"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setClientAuthToken, switchLocalUserId } from "@/lib/client-user";

export interface AuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserEmail?: string | null;
  isGuest?: boolean;
  onSuccess?: (user: {
    id: string;
    name: string;
    displayName: string | null;
    email: string | null;
    isGuest: boolean;
    xp: number;
    streak: number;
    points: number;
    level: "Beginner" | "Learner" | "Master";
  }) => void;
}

type AuthStep = "email" | "code" | "success";

export default function AuthDrawer({
  isOpen,
  onClose,
  currentUserId,
  currentUserEmail,
  isGuest = true,
  onSuccess,
}: AuthDrawerProps) {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expiresInSec, setExpiresInSec] = useState(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState(0);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail(currentUserEmail || "");
      setDigits(["", "", "", "", "", ""]);
      setErrorMessage(null);
      setStatusMessage(null);
      setExpiresInSec(600);
      setResendCooldown(0);
    }
  }, [isOpen, currentUserEmail]);

  // Expiry countdown timer for step "code"
  useEffect(() => {
    if (!isOpen || step !== "code") return;
    const interval = setInterval(() => {
      setExpiresInSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first digit when switching to code step
  useEffect(() => {
    if (step === "code") {
      setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  function formatTime(totalSec: number) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleSendCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to send code. Please try again.");
        return;
      }

      setStep("code");
      setExpiresInSec(600);
      setResendCooldown(30); // 30s before allowed to resend
      setDigits(["", "", "", "", "", ""]);

      // If development environment returned devCode, populate helpful hint
      if (data.devCode) {
        setStatusMessage(`Dev Code: ${data.devCode}`);
      }
    } catch {
      setErrorMessage("Network error connecting to auth server.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDigitChange(index: number, val: string) {
    // Only accept numeric inputs
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const updated = [...digits];
      updated[index] = "";
      setDigits(updated);
      return;
    }

    // Single digit input
    if (clean.length === 1) {
      const updated = [...digits];
      updated[index] = clean;
      setDigits(updated);
      // Auto-advance
      if (index < 5) {
        digitRefs.current[index + 1]?.focus();
      }
      return;
    }

    // Pasting multiple digits
    const chars = clean.slice(0, 6).split("");
    const updated = [...digits];
    chars.forEach((c, i) => {
      if (index + i < 6) updated[index + i] = c;
    });
    setDigits(updated);
    const nextIdx = Math.min(index + chars.length, 5);
    digitRefs.current[nextIdx]?.focus();
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter all 6 digits of the verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          currentUserId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Verification failed. Check your code.");
        return;
      }

      // Store auth session token in client storage
      if (data.token) {
        setClientAuthToken(data.token);
      }
      if (data.user?.id) {
        switchLocalUserId(data.user.id);
      }

      setStep("success");
      if (onSuccess && data.user) {
        onSuccess(data.user);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative z-10 w-full max-w-md rounded-3xl border-3 border-ink bg-white p-6 shadow-[8px_8px_0px_#0a0a0f] sm:p-7"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-xs font-bold text-ink shadow-xs transition-transform hover:scale-105 active:scale-95"
              aria-label="Close dialog"
            >
              ✕
            </button>

            {/* STEP 1: Email Form */}
            {step === "email" && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-comic-yellow text-2xl shadow-comic">
                    ✉️
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink sm:text-xl">
                      {currentUserEmail && !isGuest
                        ? "Switch or Sync Account"
                        : "Sync Account Across Devices"}
                    </h3>
                    <p className="text-xs font-medium text-ink/60">
                      Passwordless instant login via email code
                    </p>
                  </div>
                </div>

                <p className="mb-5 text-xs text-ink/75 leading-relaxed">
                  Link your email to keep your flashcards, SM-2 spaced repetition memory schedules, and XP
                  permanently synchronized across all your phones, tablets, and computers.
                </p>

                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-[11px] font-bold uppercase tracking-wider text-ink/70 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className="w-full rounded-xl border-2 border-ink bg-white px-3.5 py-2.5 text-sm font-semibold text-ink outline-none transition-colors focus:border-accent"
                    />
                  </div>

                  {errorMessage && (
                    <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                      ⚠️ {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full rounded-2xl border-2 border-ink bg-comic-yellow py-3 text-sm font-black text-ink shadow-comic transition-all hover:-translate-y-0.5 hover:bg-comic-yellow/90 active:translate-y-0 disabled:opacity-50"
                  >
                    {isLoading ? "Sending 6-Digit Code..." : "Send Verification Code ⚡"}
                  </button>
                </form>

                <div className="mt-5 border-t border-black/8 pt-3 text-center">
                  <span className="text-[11px] font-semibold text-ink/50">
                    No password required • 100% free & instant
                  </span>
                </div>
              </div>
            )}

            {/* STEP 2: 6-Digit OTP Form */}
            {step === "code" && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-comic-blue/20 text-2xl shadow-comic">
                    🔐
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink sm:text-xl">
                      Enter Verification Code
                    </h3>
                    <p className="text-xs font-medium text-ink/60 truncate max-w-[240px]">
                      Sent to {email}
                    </p>
                  </div>
                </div>

                <p className="mb-4 text-xs text-ink/75">
                  Enter the 6-digit code sent to your inbox. The code expires in{" "}
                  <span
                    className={`font-mono font-bold ${
                      expiresInSec < 60 ? "text-rose-600" : "text-ink"
                    }`}
                  >
                    {formatTime(expiresInSec)}
                  </span>
                  .
                </p>

                {statusMessage && (
                  <div className="mb-4 rounded-xl border-2 border-comic-yellow bg-comic-yellow/20 p-2.5 text-xs font-bold text-ink">
                    💡 {statusMessage}
                  </div>
                )}

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  {/* 6 Digit Inputs */}
                  <div className="flex justify-between gap-1.5 sm:gap-2">
                    {digits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          digitRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        className="h-12 w-11 rounded-xl border-2 border-ink bg-white text-center font-mono text-lg font-black text-ink shadow-xs outline-none transition-colors focus:border-accent sm:h-14 sm:w-13"
                      />
                    ))}
                  </div>

                  {errorMessage && (
                    <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                      ⚠️ {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || digits.join("").length !== 6 || expiresInSec === 0}
                    className="w-full rounded-2xl border-2 border-ink bg-comic-green py-3 text-sm font-black text-ink shadow-comic transition-all hover:-translate-y-0.5 hover:bg-comic-green/90 active:translate-y-0 disabled:opacity-50"
                  >
                    {isLoading ? "Verifying..." : "Verify & Sync Account 🚀"}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setErrorMessage(null);
                    }}
                    className="font-bold text-ink/60 hover:text-ink hover:underline"
                  >
                    ← Change Email
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={() => handleSendCode()}
                    className="font-bold text-accent hover:underline disabled:opacity-50"
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Code"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Success Confirmation */}
            {step === "success" && (
              <div className="text-center py-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15, stiffness: 300 }}
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border-3 border-ink bg-comic-green text-3xl shadow-comic"
                >
                  ✓
                </motion.div>

                <h3 className="font-display text-xl font-bold text-ink mb-1">
                  Account Synced!
                </h3>
                <p className="text-xs text-ink/70 mb-4">
                  Your decks, spaced-repetition schedules, and streaks are now permanently tied to:
                </p>

                <div className="mx-auto inline-block rounded-full border-2 border-ink bg-comic-yellow/30 px-4 py-1 text-xs font-bold text-ink mb-6">
                  ✉️ {email}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-2xl border-2 border-ink bg-comic-yellow py-3 text-sm font-black text-ink shadow-comic transition-all hover:-translate-y-0.5 hover:bg-comic-yellow/90 active:translate-y-0"
                >
                  Continue Studying 📚
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
