"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type DeckPreviewCardProps = {
  card: {
    question: string;
    answer: string;
    type?: string;
  };
  index?: number;
};

const typeConfig: Record<
  string,
  { label: string; icon: string; bg: string; text: string; border: string }
> = {
  definition: {
    label: "Definition",
    icon: "📖",
    bg: "bg-blue-50 text-blue-800",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  reasoning: {
    label: "Reasoning",
    icon: "💡",
    bg: "bg-amber-50 text-amber-900",
    text: "text-amber-900",
    border: "border-amber-200",
  },
  misconception: {
    label: "Misconception",
    icon: "⚠️",
    bg: "bg-rose-50 text-rose-800",
    text: "text-rose-800",
    border: "border-rose-200",
  },
  example: {
    label: "Worked Example",
    icon: "🧪",
    bg: "bg-emerald-50 text-emerald-800",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  edge: {
    label: "Edge Case",
    icon: "⚡",
    bg: "bg-purple-50 text-purple-800",
    text: "text-purple-800",
    border: "border-purple-200",
  },
};

export default function DeckPreviewCard({ card, index }: DeckPreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [isAnswerHidden, setIsAnswerHidden] = useState(false);

  const cardType = (card.type || "definition").toLowerCase();
  const badge = typeConfig[cardType] ?? {
    label: card.type || "Concept",
    icon: "🏷️",
    bg: "bg-accent/10 text-accent",
    text: "text-accent",
    border: "border-accent/20",
  };

  function handleCopy() {
    const textToCopy = `Q: ${card.question}\nA: ${card.answer}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "5px 5px 0px 0px #0a0a0f" }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col justify-between rounded-2xl border-2 border-ink bg-white/95 p-5 sm:p-6 shadow-comic transition-all"
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 border-b border-black/8 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-xs ${badge.bg} ${badge.border}`}
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </span>

            {typeof index === "number" && (
              <span className="rounded-full border border-black/8 bg-black/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink/50">
                #{String(index + 1).padStart(2, "0")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAnswerHidden((prev) => !prev)}
              title={isAnswerHidden ? "Show Answer" : "Hide Answer (Self-Quiz)"}
              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-medium text-ink/60 transition-colors hover:bg-black/5 hover:text-ink"
            >
              {isAnswerHidden ? "👁️ Peek" : "🙈 Hide"}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              title="Copy Q&A"
              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-medium text-ink/60 transition-colors hover:bg-black/5 hover:text-ink"
            >
              {copied ? "✓" : "📋"}
            </button>
          </div>
        </div>

        {/* Question Area */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
            <span>❓</span>
            <span>Question</span>
          </div>
          <h4 className="font-display text-base font-bold leading-snug text-ink sm:text-lg">
            {card.question}
          </h4>
        </div>
      </div>

      {/* Answer Area */}
      <div className="mt-4">
        {isAnswerHidden ? (
          <button
            type="button"
            onClick={() => setIsAnswerHidden(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mint/50 bg-mint/5 py-4 text-xs font-bold text-mint transition-colors hover:bg-mint/10"
          >
            <span>👁️</span> Click to reveal answer
          </button>
        ) : (
          <div className="rounded-xl border border-black/8 bg-slate-50/90 p-4 transition-colors group-hover:bg-slate-50">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mint">
              <span>✓</span>
              <span>Answer</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/80 sm:text-[14.5px]">
              {card.answer}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
