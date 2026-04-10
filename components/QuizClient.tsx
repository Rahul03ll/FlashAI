"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bootstrapUser } from "@/lib/client-user";

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

type QuizClientProps = {
  deckId: string;
};

export default function QuizClient({ deckId }: QuizClientProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const current = questions[index] ?? null;
  const isDone = !loading && questions.length > 0 && index >= questions.length;

  async function loadQuiz() {
    try {
      setLoading(true);
      const response = await fetch(`/api/quiz/${deckId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load quiz.");
      }
      setQuestions(data.quiz ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiz.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadQuizMounted() {
      try {
        setLoading(true);
        const response = await fetch(`/api/quiz/${deckId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load quiz.");
        }
        if (!mounted) return;
        setQuestions(data.quiz ?? []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load quiz.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadQuizMounted();
    return () => {
      mounted = false;
    };
  }, [deckId]);

  useEffect(() => {
    let mounted = true;
    async function initUser() {
      try {
        const user = await bootstrapUser();
        if (!mounted) return;
        setUserId(user.id);
      } catch {
        if (!mounted) return;
        setError("Could not initialize gamification profile.");
      }
    }
    initUser();
    return () => {
      mounted = false;
    };
  }, []);

  async function awardQuizCorrectPoints() {
    if (!userId) return;
    const response = await fetch("/api/gamify/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "quiz-correct" }),
    });
    const data = await response.json();
    if (!response.ok) return;

    if (data.levelUp) {
      setFlashMessage(`🏆 Level up! ${data.user.level}`);
    } else if (data.milestone) {
      setFlashMessage(`🎉 Milestone: ${data.user.points} points`);
    } else {
      setFlashMessage(`+${data.gained} points`);
    }
    setTimeout(() => setFlashMessage(null), 1500);
  }

  async function handleSelect(optionIndex: number) {
    if (!current || selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === current.correctIndex) {
      setScore((prev) => prev + 1);
      await awardQuizCorrectPoints();
    }

    setTimeout(() => {
      setSelected(null);
      setIndex((prev) => prev + 1);
    }, 1500);
  }

  const resultMessage = useMemo(() => {
    if (questions.length === 0) return "No quiz questions available yet.";
    const percent = (score / questions.length) * 100;
    return percent >= 70 ? "Great job!" : "Needs review";
  }, [questions.length, score]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 animate-pulse rounded bg-black/10" />
        <div className="rounded-2xl border border-black/5 bg-white/85 p-6 shadow-soft">
          <div className="shimmer h-4 w-3/4 rounded" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => { setError(null); void loadQuiz(); }}
          className="mt-2 text-xs underline text-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/20 bg-white/50 p-10 text-center text-ink/60">
        Quiz is not available because this deck has no cards yet.
      </div>
    );
  }

  if (isDone) {
    const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="rounded-2xl border border-black/5 bg-white/85 p-8 text-center shadow-soft">
        <div className="text-5xl">{percent >= 70 ? "🏆" : "📚"}</div>
        <h2 className="mt-3 text-2xl font-semibold text-ink">Quiz Complete</h2>
        <p className="mt-3 text-lg text-ink/80">
          Score: <span className="font-bold text-accent">{score}</span> / {questions.length}
        </p>
        <p className="mt-1 text-ink/60">{resultMessage}</p>

        <svg className="mx-auto mt-4" width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <motion.circle
            cx="60" cy="60" r="50" fill="none"
            stroke={percent >= 70 ? "#69F0AE" : "#FF5252"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - percent / 100) }}
            transition={{ duration: 1, ease: "easeOut" }}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="65" textAnchor="middle" className="text-xl font-bold" fill="#0a0a0f" fontSize="22" fontWeight="bold">{percent}%</text>
        </svg>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/quiz/${deckId}`}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            Retry Quiz
          </Link>
          <Link
            href={`/deck/${deckId}`}
            className="rounded-full border border-black/15 bg-white/70 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-white transition-colors"
          >
            Review weak cards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {flashMessage ? (
        <p className="text-center text-sm font-medium text-accent">{flashMessage}</p>
      ) : null}
      <div className="flex items-center justify-between text-sm text-ink/60">
        <span>
          Question {index + 1} / {questions.length}
        </span>
        <span className="font-medium text-ink">Score: {score}</span>
      </div>

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-black/5 bg-white/85 p-6 shadow-soft"
          >
            <h2 className="text-xl font-semibold leading-relaxed text-ink">
              {current.question}
            </h2>

            <div className="mt-6 space-y-3">
              {current.options.map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                const isCorrect = optionIndex === current.correctIndex;

                let stateClasses =
                  "border-2 border-ink bg-white/70 text-ink hover:bg-white active:scale-[0.99]";
                if (selected !== null) {
                  if (isCorrect) {
                    stateClasses = "border-comic-green bg-comic-green/20 text-ink";
                  } else if (isSelected && !isCorrect) {
                    stateClasses = "border-comic-red bg-comic-red/20 text-ink";
                  } else {
                    stateClasses = "border-black/5 bg-white/40 text-ink/40";
                  }
                }

                return (
                  <button
                    key={`${option}-${optionIndex}`}
                    type="button"
                    onClick={() => void handleSelect(optionIndex)}
                    disabled={selected !== null}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200 ${stateClasses} disabled:cursor-not-allowed`}
                  >
                    <span className="mr-2 font-mono text-xs text-ink/40">
                      {String.fromCharCode(65 + optionIndex)}.
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
