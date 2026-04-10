import { memo } from "react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";

type ProgressBarProps = {
  mastered: number;
  learning: number;
  dueToday: number;
  currentIndex: number;
  total: number;
};

function ProgressBar({
  mastered,
  learning,
  dueToday,
  currentIndex,
  total,
}: ProgressBarProps) {
  const percent = total > 0 ? Math.min(100, Math.round((currentIndex / total) * 100)) : 0;

  return (
    <Card className="p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat title="Mastered" value={mastered} color="text-mint" />
        <Stat title="Learning" value={learning} color="text-coral" />
        <Stat title="Due Today" value={dueToday} color="text-accent" />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm text-ink/65">
          <span>Study Progress</span>
          <span>
            {Math.min(currentIndex + 1, total)} / {Math.max(total, 1)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 25 }}
          />
        </div>
      </div>
    </Card>
  );
}

type StatProps = {
  title: string;
  value: number;
  color: string;
};

function Stat({ title, value, color }: StatProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
      <p className="text-sm text-ink/60">{title}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default memo(ProgressBar);
