"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";

const STORAGE_KEY = "flashai_onboarding_done";

const steps = [
  { title: "Upload your PDF", description: "Drag and drop your notes to create a deck instantly." },
  { title: "Watch cards appear live", description: "Flashcards stream in one by one while AI generates." },
  { title: "Start practicing", description: "Flip, review, and level up with adaptive study flows." },
];

export default function OnboardingFlow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setOpen(true);
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-6 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-xl rounded-2xl border-2 border-ink shadow-comic-lg bg-white overflow-hidden"
          >
            <div className="bg-comic-yellow border-b-2 border-ink w-full px-6 py-2">
              <p className="text-xs uppercase tracking-[0.18em] text-ink font-semibold">Onboarding</p>
            </div>
            <div className="p-6">
            <p className="mt-2 text-sm text-ink/60">
              Step {step + 1}/{steps.length}
            </p>
            <h2 className="mt-2 text-3xl text-ink">{steps[step].title}</h2>
            <p className="mt-3 text-sm text-ink/65">{steps[step].description}</p>

            <div className="mt-5 h-2 rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={finish}>
                Skip
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
              ) : (
                <Button onClick={finish}>Start Practicing</Button>
              )}
            </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
