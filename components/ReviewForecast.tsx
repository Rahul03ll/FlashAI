import type { Flashcard } from "@/types/flashcard";

type ReviewForecastProps = {
  cards: Flashcard[];
};

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ReviewForecast({ cards }: ReviewForecastProps) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const friday = new Date();
  // Always show *next* Friday (at least 1 day away) so we never show today as "Friday".
  const diff = ((5 - friday.getDay() + 7) % 7) || 7;
  friday.setDate(friday.getDate() + diff);

  const tomorrowCount = cards.filter((c) => isSameDate(new Date(c.dueDate), tomorrow)).length;
  const fridayCount = cards.filter((c) => isSameDate(new Date(c.dueDate), friday)).length;

  return (
    <section className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-soft">
      <p className="text-sm font-semibold text-ink">📅 Review Forecast</p>
      <ul className="mt-3 space-y-2">
        {[
          { label: "Tomorrow", count: tomorrowCount },
          { label: "Next Friday", count: fridayCount },
        ].map(({ label, count }) => (
          <li key={label} className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2">
            <span className="text-sm text-ink/70">{label}</span>
            <span className="text-sm font-semibold text-ink">
              {count} {count === 1 ? "card" : "cards"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
