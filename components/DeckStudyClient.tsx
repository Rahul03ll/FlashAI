"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import Flashcard from "@/components/Flashcard";
import ProgressBar from "@/components/ProgressBar";
import ReviewForecast from "@/components/ReviewForecast";
import { bootstrapUser } from "@/lib/client-user";
import { applySm2, type StudyQuality } from "@/lib/sm2";
import type { Flashcard as FlashcardType } from "@/types/flashcard";

type DeckStudyClientProps = {
  deckId: string;
  initialCards: FlashcardType[];
};

function isDue(card: FlashcardType): boolean {
  return new Date(card.dueDate) <= new Date();
}

function isDueToday(iso: string): boolean {
  const due = new Date(iso);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export default function DeckStudyClient({ deckId, initialCards }: DeckStudyClientProps) {
  const [cards, setCards] = useState<FlashcardType[]>(initialCards);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [explainingCardId, setExplainingCardId] = useState<string | null>(null);
  const [explanationCache, setExplanationCache] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState<"Beginner" | "Learner" | "Master">("Beginner");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [xp, setXp] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpName, setLevelUpName] = useState<string>("");

  const dueCards = useMemo(() => cards.filter(isDue), [cards]);
  const currentCard = dueCards[currentIndex] ?? null;

  useEffect(() => {
    let mounted = true;
    async function initUser() {
      try {
        const user = await bootstrapUser();
        if (!mounted) return;
        setUserId(user.id);
        setPoints(user.points);
        setXp(user.xp);
        setStreak(user.streak);
        setLevel(user.level);
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

  useEffect(() => {
    if (dueCards.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= dueCards.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, dueCards.length]);

  useEffect(() => {
    if (dueCards.length === 0 && cards.length > 0) {
      setShowConfetti(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      const timer = setTimeout(() => setShowConfetti(false), 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [cards.length, dueCards.length]);

  const stats = useMemo(() => {
    const mastered = cards.filter((card) => card.interval > 7).length;
    const learning = cards.filter((card) => card.interval <= 3).length;
    const dueToday = cards.filter((card) => isDueToday(card.dueDate)).length;
    return { mastered, learning, dueToday };
  }, [cards]);

  const awardPoints = useCallback(
    async (action: "easy" | "good" | "hard") => {
      if (!userId) return;
      const response = await fetch("/api/gamify/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await response.json();
      if (!response.ok) return;

      setPoints(data.user.points);
      setXp(data.user.xp);
      setStreak(data.user.streak);
      setLevel(data.user.level);
      if (data.levelUp) {
        setFlashMessage(`Level up! You are now ${data.user.level}.`);
        setShowLevelUp(true);
        setLevelUpName(data.user.level);
        setTimeout(() => setShowLevelUp(false), 2000);
        setShowConfetti(true);
        confetti({ particleCount: 120, spread: 80, origin: { x: 0.5, y: 0.5 } });
      } else if (data.milestone) {
        setFlashMessage(`Milestone reached: ${data.user.points} points!`);
        setShowConfetti(true);
        confetti({ particleCount: 90, spread: 65, origin: { x: 0.5, y: 0.6 } });
      } else {
        setFlashMessage(`+${data.gained} XP`);
      }
      setTimeout(() => setShowConfetti(false), 1600);
      setTimeout(() => setFlashMessage(null), 1800);
    },
    [userId],
  );

  function playFlipClick() {
    try {
      const context = new AudioContext();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "triangle";
      osc.frequency.value = 760;
      gain.gain.value = 0.02;
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.04);
    } catch {
      // ignore unsupported audio output
    }
  }

  const handleStudy = useCallback(
    async (quality: StudyQuality) => {
      if (!currentCard) return;

      setSaving(true);
      setError(null);

      const baseUpdated = applySm2(currentCard, quality);
      const nextDifficultyScore =
        quality === "hard"
          ? currentCard.difficultyScore + 1
          : Math.max(0, currentCard.difficultyScore - 1);
      const updated = {
        ...baseUpdated,
        difficultyScore: nextDifficultyScore,
      };

      try {
        const response = await fetch(`/api/card/${currentCard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ease: updated.ease,
            interval: updated.interval,
            repetitions: updated.repetitions,
            difficultyScore: updated.difficultyScore,
            dueDate: updated.dueDate,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to update card.");
          return;
        }

        setCards((prev) => prev.map((card) => (card.id === updated.id ? updated : card)));
        setIsFlipped(false);
        setExplainingCardId(null);
        setCurrentIndex((prev) => {
          if (dueCards.length <= 1) return 0;
          return (prev + 1) % dueCards.length;
        });
        await awardPoints(quality);
      } catch {
        setError("Unexpected error while saving your study progress.");
      } finally {
        setSaving(false);
      }
    },
    [currentCard, dueCards.length, awardPoints],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!currentCard || saving) return;
      if (event.code === "Space") {
        event.preventDefault();
        playFlipClick();
        setIsFlipped((prev) => !prev);
      } else if (event.key === "1") {
        void handleStudy("hard");
      } else if (event.key === "2") {
        void handleStudy("good");
      } else if (event.key === "3") {
        void handleStudy("easy");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentCard, saving, handleStudy]);

  async function handleExplainBetter() {
    if (!currentCard) return;

    if (explanationCache[currentCard.id]) {
      return;
    }

    setExplainingCardId(currentCard.id);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentCard.question,
          answer: currentCard.answer,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to generate explanation.");
        return;
      }

      if (typeof data.explanation !== "string" || !data.explanation.trim()) {
        setError("Failed to generate explanation.");
        return;
      }

      setExplanationCache((prev) => ({
        ...prev,
        [currentCard.id]: data.explanation,
      }));
    } catch {
      setError("Unexpected error while generating explanation.");
    } finally {
      setExplainingCardId(null);
    }
  }

  // XP needed for each level boundary
  const XP_FOR_LEARNER = 500;
  const XP_FOR_MASTER  = 2000;

  const { xpInTier, xpNeeded, nextLevel } = (() => {
    if (level === "Beginner") {
      return { xpInTier: xp, xpNeeded: XP_FOR_LEARNER, nextLevel: "Learner" };
    }
    if (level === "Learner") {
      return { xpInTier: xp - XP_FOR_LEARNER, xpNeeded: XP_FOR_MASTER - XP_FOR_LEARNER, nextLevel: "Master" };
    }
    return { xpInTier: xp - XP_FOR_MASTER, xpNeeded: null, nextLevel: null };
  })();

  const xpPct = xpNeeded ? Math.min(100, Math.round((xpInTier / xpNeeded) * 100)) : 100;

  return (
    <section className="space-y-6">
      {/* Level-up overlay */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 pointer-events-none"
          >
            <div className="text-center">
              <p className="font-display text-6xl text-comic-yellow">🏆</p>
              <p className="font-display text-4xl text-white mt-2">{levelUpName}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Gamification badge + XP level bar */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {streak > 0 && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
              🔥 {streak} day streak
            </span>
          )}
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            ⚡ {xp} XP · {level}
          </span>
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-ink/60">
            {points} pts
          </span>
        </div>

        {/* Progress bar toward next level */}
        {nextLevel && (
          <div className="w-full max-w-xs">
            <div className="mb-1 flex items-center justify-between text-[11px] text-ink/45">
              <span>{level}</span>
              <span>{xpNeeded ? xpNeeded - xpInTier : 0} XP to {nextLevel}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/8">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        )}
        {!nextLevel && (
          <span className="text-xs font-bold text-mint">🏆 Max level reached!</span>
        )}
      </div>

      {flashMessage ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="text-center text-sm font-bold text-accent"
        >
          {flashMessage}
        </motion.div>
      ) : null}

      <ProgressBar
        mastered={stats.mastered}
        learning={stats.learning}
        dueToday={stats.dueToday}
        currentIndex={currentIndex}
        total={Math.max(dueCards.length, 1)}
      />

      {error ? (
        <div className="rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-medium text-coral">
          {error}
        </div>
      ) : null}

      {showConfetti ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none text-center text-3xl"
        >
          🎉 ✨ 🎊
        </motion.div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ConfidenceHeatmap cards={cards} />
        <ReviewForecast cards={cards} />
      </div>

      {currentCard ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            // dragElastic keeps the card snappy and makes short drags feel like taps.
            dragElastic={0.08}
            onDragEnd={(_, info) => {
              const isSwipe =
                Math.abs(info.offset.x) > 120 || Math.abs(info.velocity.x) > 400;
              if (!isSwipe) return;
              if (info.offset.x > 0) {
                void handleStudy("easy");
              } else {
                void handleStudy("hard");
              }
            }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="transition-all duration-300"
          >
            <Flashcard
              flashcard={currentCard}
              isFlipped={isFlipped}
              onFlip={() => {
                playFlipClick();
                setIsFlipped((prev) => !prev);
              }}
              onHard={() => { void handleStudy("hard"); }}
              onGood={() => { void handleStudy("good"); }}
              onEasy={() => { void handleStudy("easy"); }}
              onExplainBetter={handleExplainBetter}
              explanation={explanationCache[currentCard.id] ?? null}
              isExplaining={explainingCardId === currentCard.id}
              disabled={saving}
            />
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="rounded-xl border border-dashed border-mint/40 bg-mint/10 p-10 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-3 text-xl font-bold text-ink">You're all caught up!</h2>
          <p className="mt-2 text-sm text-ink/65">
            No cards are due right now. Come back later for your next review.
          </p>
        </div>
      )}


    </section>
  );
}
