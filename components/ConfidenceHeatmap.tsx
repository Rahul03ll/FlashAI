import type { Flashcard } from "@/types/flashcard";

type ConfidenceHeatmapProps = {
  cards: Flashcard[];
};

type CardStatus = "mastered" | "struggling" | "learning";

function statusFor(card: Flashcard): CardStatus {
  if (card.interval > 7) return "mastered";
  if (card.difficultyScore >= 3) return "struggling";
  return "learning";
}

const statusConfig: Record<CardStatus, { bg: string; label: string; emoji: string }> = {
  mastered: { bg: "bg-mint/80", label: "Mastered", emoji: "✅" },
  struggling: { bg: "bg-coral/80", label: "Struggling", emoji: "🔴" },
  learning: { bg: "bg-warn/60", label: "Learning", emoji: "🟡" },
};

export default function ConfidenceHeatmap({ cards }: ConfidenceHeatmapProps) {
  const counts = { mastered: 0, struggling: 0, learning: 0 };
  for (const card of cards) counts[statusFor(card)]++;

  return (
    <section className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-soft">
      <p className="text-sm font-semibold text-ink">🧠 Confidence Map</p>

      {cards.length === 0 ? (
        <p className="mt-3 text-xs text-ink/50">No cards to display yet.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cards.map((card) => {
              const status = statusFor(card);
              return (
                <div
                  key={card.id}
                  className={`h-4 w-4 rounded-sm ${statusConfig[status].bg} cursor-default transition-transform hover:scale-125`}
                  title={`${card.question.slice(0, 60)}… (${statusConfig[status].label})`}
                />
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {(Object.entries(statusConfig) as [CardStatus, typeof statusConfig[CardStatus]][]).map(
              ([key, cfg]) => (
                <span key={key} className="flex items-center gap-1 text-xs text-ink/60">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cfg.bg}`} />
                  {cfg.label} ({counts[key]})
                </span>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}
