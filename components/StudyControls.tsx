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
    <div className="sticky bottom-2 z-10 mt-5 flex w-full flex-col gap-3 rounded-2xl bg-white/90 p-2 backdrop-blur sm:static sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {buttons.map(({ label, emoji, variant, kbd, handler, delay }) => (
        <motion.div key={label} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
          <Button type="button" disabled={disabled} onClick={handler} variant={variant} className="w-full">
            <span className="flex items-center justify-center gap-2">
              {label} {emoji}
              <kbd className="hidden rounded bg-black/15 px-1.5 py-0.5 font-mono text-xs sm:inline">{kbd}</kbd>
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export default memo(StudyControls);
