import { describe, it, expect } from "vitest";
import { applySm2, makeInitialSm2Card } from "@/lib/sm2";

describe("Tier 2: Boundary 11 - SM-2 Mathematical & Interval Boundaries", () => {
  it("B11.1 ease floor clamp: 15 consecutive 'hard' reviews never drops ease below 1.3", () => {
    let card = makeInitialSm2Card({ id: "card-hard-floor", question: "Q", answer: "A", type: "definition" });

    for (let i = 0; i < 15; i++) {
      card = applySm2(card, "hard");
      expect(card.ease).toBeGreaterThanOrEqual(1.3);
      expect(card.interval).toBe(1);
      expect(card.repetitions).toBe(0);
    }

    expect(card.ease).toBe(1.3);
  });

  it("B11.2 ease ceiling clamp: 20 consecutive 'easy' reviews never exceeds 3.0", () => {
    let card = makeInitialSm2Card({ id: "card-easy-ceil", question: "Q", answer: "A", type: "definition" });

    for (let i = 0; i < 20; i++) {
      card = applySm2(card, "easy");
      expect(card.ease).toBeLessThanOrEqual(3.0);
    }

    expect(card.ease).toBe(3.0);
  });

  it("B11.3 interval growth cap: repeated 'easy' reviews caps interval at 365 days", () => {
    let card = makeInitialSm2Card({ id: "card-cap", question: "Q", answer: "A", type: "definition" });

    // Review 15 times
    for (let i = 0; i < 15; i++) {
      card = applySm2(card, "easy");
      expect(card.interval).toBeLessThanOrEqual(365);
    }
  });

  it("B11.4 first review (repetitions=0) on good/easy always sets interval=1", () => {
    const card = makeInitialSm2Card({ id: "card-first-rep", question: "Q", answer: "A", type: "definition" });

    const goodRes = applySm2(card, "good");
    expect(goodRes.repetitions).toBe(1);
    expect(goodRes.interval).toBe(1);

    const easyRes = applySm2(card, "easy");
    expect(easyRes.repetitions).toBe(1);
    expect(easyRes.interval).toBe(1);
  });

  it("B11.5 second review (repetitions=1) on good/easy always sets interval=6", () => {
    let card = makeInitialSm2Card({ id: "card-second-rep", question: "Q", answer: "A", type: "definition" });
    card = applySm2(card, "good"); // reps=1, interval=1

    const secondGood = applySm2(card, "good");
    expect(secondGood.repetitions).toBe(2);
    expect(secondGood.interval).toBe(6);

    const secondEasy = applySm2(card, "easy");
    expect(secondEasy.repetitions).toBe(2);
    expect(secondEasy.interval).toBe(6);
  });
});
