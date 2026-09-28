import { memo } from "react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";

type StudyControlsProps = {
  onHard: () => void;
  onGood: () => void;
  onEasy: () => void;
  disabled?: boolean;
};

function StudyControls({
  onHard,
  onGood,
  onEasy,
  disabled = false,
}: StudyControlsProps) {
  const buttons = [
    { label: "Hard", emoji: "❗", variant: "comic-red" as const, kbd: "1", handler: onHard, delay: 0 },
    { label: "Good", emoji: "👍", variant: "comic-blue" as const, kbd: "2", handler: onGood, delay: 0.06 },
    { label: "Easy", emoji: "✅", variant: "comic-green" as const, kbd: "3", handler: onEasy, delay: 0.12 },
  ];

  return (
    <div className="sticky bottom-3 z-10 mt-5 grid w-full grid-cols-3 gap-2 sm:gap-3.5 rounded-2xl bg-white/95 p-2 sm:p-0 shadow-comic sm:shadow-none border-2 border-ink/20 sm:border-0 backdrop-blur-md sm:static sm:bg-transparent sm:backdrop-blur-none">
      {buttons.map(({ label, emoji, variant, kbd, handler, delay }) => (
        <motion.div key={label} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
          <Button
            type="button"
            disabled={disabled}
            onClick={handler}
            variant={variant}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-3 text-xs sm:px-4 sm:py-3.5 sm:text-sm font-bold shadow-comic"
          >
            <span>{label}</span>
            <span className="text-base sm:text-lg">{emoji}</span>
            <kbd className="hidden sm:inline-block rounded bg-black/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">
              {kbd}
            </kbd>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export default memo(StudyControls);
