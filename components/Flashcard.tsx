import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Flashcard as FlashcardType } from "@/types/flashcard";
import StudyControls from "@/components/StudyControls";
import MarkdownExplanation from "@/components/MarkdownExplanation";
import Button from "@/components/ui/Button";

type FlashcardProps = {
  flashcard: FlashcardType;
  isFlipped: boolean;
  onFlip: () => void;
  onHard: () => void;
  onGood: () => void;
  onEasy: () => void;
  onExplainBetter: () => void;
  explanation: string | null;
  isExplaining: boolean;
  disabled?: boolean;
};

const typeConfig: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  definition: {
    label: "Definition",
    icon: "📖",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  reasoning: {
    label: "Reasoning",
    icon: "💡",
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-200",
  },
  misconception: {
    label: "Misconception",
    icon: "⚠️",
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
  },
  example: {
    label: "Worked Example",
    icon: "🧪",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  edge: {
    label: "Edge Case",
    icon: "⚡",
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
  },
};

function Flashcard({
  flashcard,
  isFlipped,
  onFlip,
  onHard,
  onGood,
  onEasy,
  onExplainBetter,
  explanation,
  isExplaining,
  disabled = false,
}: FlashcardProps) {
  const badge = useMemo(() => {
    return (
      typeConfig[flashcard.type] ?? {
        label: flashcard.type || "Concept",
        icon: "🏷️",
        bg: "bg-accent/10",
        text: "text-accent",
        border: "border-accent/20",
      }
    );
  }, [flashcard.type]);

  return (
    <section className="mx-auto w-full max-w-2xl">
      {/*
        CSS 3D flip requires an unbroken chain:
          [perspective] → [transform-style:preserve-3d + rotateY] → [backface-visibility:hidden faces]
      */}
      <div className="relative h-80 sm:h-96" style={{ perspective: "1200px" }}>
        {/* Layer 3 - Base deck shadow in comic aesthetic */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-ink/20 bg-comic-blue/15 shadow-comic [transform:rotate(-3deg)] transition-transform duration-300" />
        {/* Layer 2 - Mid deck layer */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-ink/40 bg-white/70 shadow-comic [transform:rotate(2deg)] transition-transform duration-300" />

        {/* Layer 1 - Interactive Flipping Card */}
        <motion.div
          className="absolute inset-0 z-10 rounded-2xl shadow-comic [transform-style:preserve-3d]"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          whileHover={!disabled ? { y: -6, scale: 1.012 } : undefined}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          onClick={!disabled ? onFlip : undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={
            isFlipped
              ? "Showing answer – click or press Space to see question"
              : "Showing question – click or press Space to flip"
          }
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              e.preventDefault();
              onFlip();
            }
          }}
          style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        >
          {/* ── FRONT face ── */}
          <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border-3 border-ink bg-gradient-to-br from-[#FFFDF2] via-[#FFFBE8] to-[#FFF5C7] p-6 sm:p-8 shadow-comic [backface-visibility:hidden]">
            {/* Front Header */}
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-xs ${badge.bg} ${badge.text} ${badge.border}`}
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </span>

              <span className="flex items-center gap-1 rounded-full border border-black/10 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-ink/65">
                <span>Space</span> ↵
              </span>
            </div>

            {/* Front Question Body */}
            <div className="my-auto flex items-center justify-center overflow-y-auto px-2 py-4">
              <p className="select-none text-center font-display text-xl sm:text-2xl font-bold leading-snug sm:leading-relaxed text-ink tracking-tight">
                {flashcard.question}
              </p>
            </div>

            {/* Front Footer */}
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-ink/50">
              <span className="inline-block animate-pulse">🔄</span>
              <span>Click card or press Space to reveal answer</span>
            </div>
          </div>

          {/* ── BACK face – pre-rotated 180° so it is hidden on the front ── */}
          <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border-3 border-ink bg-gradient-to-br from-[#12131D] via-[#161826] to-[#0D0E15] p-6 sm:p-8 shadow-comic [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {/* Back Header */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/20 px-3 py-1 font-mono text-xs font-bold tracking-wider text-mint">
                <span>✓</span>
                <span>ANSWER</span>
              </span>

              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/60">
                ↺ Flip back
              </span>
            </div>

            {/* Back Answer Body */}
            <div className="my-auto flex items-center justify-center overflow-y-auto px-2 py-4">
              <p className="select-none text-center text-base sm:text-xl font-medium leading-relaxed text-white/95">
                {flashcard.answer}
              </p>
            </div>

            {/* Back Footer */}
            <div className="flex items-center justify-center text-xs font-medium text-white/50">
              <span>Rate your recall below to schedule spaced repetition</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action / Helper Bar */}
      <div className="mt-4 flex items-center justify-between px-1">
        <p className="text-xs font-medium text-ink/50">
          <kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink/70">Space</kbd>
          {" "}flip ·{" "}
          <kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink/70">1-3</kbd>
          {" "}rate
        </p>

        <Button
          type="button"
          onClick={onExplainBetter}
          variant="ghost"
          size="sm"
          disabled={disabled || isExplaining}
          className="border-2 border-ink shadow-comic bg-amber-100 hover:bg-amber-200 text-ink text-xs font-bold transition-transform active:scale-95"
        >
          {isExplaining ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block animate-spin">⚡</span> Formulating...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>🧠</span> Explain Better
            </span>
          )}
        </Button>
      </div>

      {/* AI Tutor Explanation Box */}
      <AnimatePresence>
        {(isExplaining || explanation) && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4"
          >
            <div className="rounded-2xl border-2 border-ink bg-white/95 p-5 sm:p-6 shadow-comic max-h-80 overflow-y-auto">
              {isExplaining ? (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-black/8 pb-2.5">
                    <span className="flex h-5 w-5 animate-spin items-center justify-center rounded-full bg-accent/15 text-accent text-xs">
                      ✨
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                      AI Tutor is formulating an explanation...
                    </span>
                  </div>
                  <div className="space-y-2.5 pt-1">
                    <div className="shimmer h-4 w-full rounded-md" />
                    <div className="shimmer h-4 w-11/12 rounded-md" />
                    <div className="shimmer h-4 w-4/5 rounded-md" />
                    <div className="shimmer h-4 w-2/3 rounded-md" />
                  </div>
                </div>
              ) : explanation ? (
                <MarkdownExplanation rawText={explanation} />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spaced Repetition Rating Controls */}
      <StudyControls
        onHard={onHard}
        onGood={onGood}
        onEasy={onEasy}
        disabled={disabled}
      />
    </section>
  );
}

export default memo(Flashcard);
