import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Flashcard as FlashcardType } from "@/types/flashcard";
import StudyControls from "@/components/StudyControls";
import Card from "@/components/ui/Card";
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
  return (
    <section className="mx-auto w-full max-w-2xl">
      {/*
        WHY THIS STRUCTURE:
        CSS 3D flip requires an unbroken chain:
          [perspective] → [transform-style:preserve-3d + rotateY] → [backface-visibility:hidden faces]

        The OLD code put a <motion.button> between the perspective container and
        the rotating div. Buttons have the browser default transform-style:flat,
        which collapses the 3D space and reduces the flip to a 2-D squash.

        FIX: a single motion.div IS both the interactive element AND the 3D element.
        It sits as a direct child of the perspective container — no flat intermediary.
      */}
      <div className="relative h-80 sm:h-96" style={{ perspective: "1200px" }}>
        {/* Decorative card-stack shadows behind the main card */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-ink/30 bg-white/40 shadow-soft [transform:rotate(-6deg)]" />
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-ink/30 bg-white/65 shadow-soft [transform:rotate(-2deg)]" />

        {/*
          The single motion.div that owns:
            • rotateY  – the 3-D flip
            • whileHover y / scale – the lift effect
            • onClick / keyboard – accessibility
          transform-style:preserve-3d here means the perspective from the parent
          is correctly applied to its two face children.
        */}
        <motion.div
          className="absolute inset-0 z-10 rounded-2xl shadow-soft [transform-style:preserve-3d]"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          whileHover={!disabled ? { y: -6, scale: 1.015 } : undefined}
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
          <div className="absolute inset-0 rounded-2xl bg-comic-yellow/20 border-2 border-ink p-6 sm:p-8 [backface-visibility:hidden]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent/70">
                Question
              </p>
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-accent">
                {flashcard.type}
              </span>
            </div>
            <div className="mt-4 flex h-[calc(100%-2rem)] items-center justify-center overflow-y-auto">
              <p className="text-center text-lg font-medium leading-snug text-ink sm:text-xl sm:leading-relaxed">
                {flashcard.question}
              </p>
            </div>
          </div>

          {/* ── BACK face – pre-rotated 180° so it is hidden on the front ── */}
          <div className="absolute inset-0 rounded-2xl border-2 border-ink bg-ink p-6 sm:p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-mint/70">
              Answer
            </p>
            <div className="mt-4 flex h-[calc(100%-2rem)] items-center justify-center overflow-y-auto">
              <p className="text-center text-base font-normal leading-relaxed text-white/90 sm:text-lg">
                {flashcard.answer}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <p className="mt-4 text-center text-xs text-ink/45">
        Tap to flip ·{" "}
        <kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono">Space</kbd>
        {" "}to flip · Swipe ← →
      </p>

      <div className="mt-3 flex justify-center">
        <Button
          type="button"
          onClick={onExplainBetter}
          variant="ghost"
          disabled={disabled || isExplaining}
          className="border border-accent/30 bg-accent/10 text-accent"
        >
          {isExplaining ? "Explaining..." : "🧠 Explain Better"}
        </Button>
      </div>

      <AnimatePresence>
        {(isExplaining || explanation) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <Card className="max-h-52 overflow-y-auto border-accent/20 bg-white/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">AI Tutor Explanation</p>
              {isExplaining ? (
                <div className="mt-2 space-y-2">
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-4 w-11/12 rounded" />
                  <div className="shimmer h-4 w-8/12 rounded" />
                </div>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-ink/75">{explanation}</p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
