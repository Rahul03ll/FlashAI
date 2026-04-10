import type { Flashcard } from "@/types/flashcard";

/**
 * Three-quality SM-2 variant.
 *
 * Ease-factor deltas derived from the canonical SM-2 formula
 * EF' = EF + (0.1 − (5−q)(0.08 + (5−q)·0.02)):
 *   easy (q=5) → +0.10
 *   good (q=4) → ±0.00  (no change — correct with hesitation)
 *   hard (q=2) → −0.20  (incorrect / very difficult — interval resets)
 */
export type StudyQuality = "easy" | "good" | "hard";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function applySm2(card: Flashcard, quality: StudyQuality): Flashcard {
  const now = new Date();

// Hard → interval resets to 1, ease decreases
  // Floor 1.3: prevents ease collapse on repeated hard answers
  // Ceiling 3.0: prevents intervals growing to years on easy cards
  if (quality === "hard") {
    const ease = Math.min(3.0, Math.max(1.3, card.ease - 0.20));
    return {
      ...card,
      repetitions: 0,
      interval: 1,
      ease,
      dueDate: addDays(now, 1).toISOString(),
    };
  }

  // Good or Easy → correct answer, schedule next interval
  const repetitions = card.repetitions + 1;
  let interval: number;
  if (repetitions === 1) {
    interval = 1;
  } else if (repetitions === 2) {
    interval = 6;
  } else {
    interval = Math.round(card.interval * card.ease);
  }

  // Easy: ease grows; Good: ease stays neutral (SM-2 q=4 delta ≈ 0)
  const easeDelta = quality === "easy" ? 0.1 : 0.0;
  const ease = Math.min(3.0, Math.max(1.3, card.ease + easeDelta));

  return {
    ...card,
    repetitions,
    interval,
    ease,
    dueDate: addDays(now, interval).toISOString(),
  };
}

export function makeInitialSm2Card(
  input: Pick<Flashcard, "id" | "question" | "answer" | "type">,
): Flashcard {

  const now = new Date().toISOString();
  return {
    id: input.id,
    question: input.question,
    answer: input.answer,
    type: input.type,
    difficultyScore: 0,
    ease: 2.5,
    interval: 1,
    repetitions: 0,
    dueDate: now,
  };
}
