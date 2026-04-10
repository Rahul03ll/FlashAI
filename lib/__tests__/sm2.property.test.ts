import { describe, it } from "vitest";
import * as fc from "fast-check";
import { applySm2, makeInitialSm2Card } from "../sm2";
import type { Flashcard } from "@/types/flashcard";

const arbitraryFlashcard = fc.record<Flashcard>({
  id: fc.uuid(),
  question: fc.string({ minLength: 1, maxLength: 100 }),
  answer: fc.string({ minLength: 1, maxLength: 200 }),
  type: fc.constantFrom("definition", "reasoning", "misconception", "example", "edge"),
  difficultyScore: fc.integer({ min: 0, max: 10 }),
  ease: fc.float({ min: 0.5, max: 5.0, noNaN: true }),
  interval: fc.integer({ min: 1, max: 365 }),
  repetitions: fc.integer({ min: 0, max: 50 }),
  dueDate: fc.integer({ min: 0, max: 365 }).map((days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }),
});

const arbitraryQuality = fc.constantFrom("easy" as const, "good" as const, "hard" as const);

// Feature: cartoonistic-app-overhaul, Property 1: SM-2 ease clamping invariant
describe("SM-2 Property Tests", () => {
  it("P1: ease is always clamped to [1.3, 3.0] for all quality values", () => {
    fc.assert(
      fc.property(arbitraryFlashcard, arbitraryQuality, (card, quality) => {
        const result = applySm2(card, quality);
        return result.ease >= 1.3 && result.ease <= 3.0;
      }),
      { numRuns: 100 },
    );
  });

  // Feature: cartoonistic-app-overhaul, Property 2: SM-2 dueDate is always a future ISO-8601 string
  it("P2: dueDate is always a valid ISO-8601 string at or after call time", () => {
    fc.assert(
      fc.property(arbitraryFlashcard, arbitraryQuality, (card, quality) => {
        const before = Date.now();
        const result = applySm2(card, quality);
        const due = new Date(result.dueDate).getTime();
        return !isNaN(due) && due >= before;
      }),
      { numRuns: 100 },
    );
  });

  // Feature: cartoonistic-app-overhaul, Property 3: SM-2 interval and repetitions are always non-negative
  it("P3: interval >= 1 and repetitions >= 0 for all inputs", () => {
    fc.assert(
      fc.property(arbitraryFlashcard, arbitraryQuality, (card, quality) => {
        const result = applySm2(card, quality);
        return result.interval >= 1 && result.repetitions >= 0;
      }),
      { numRuns: 100 },
    );
  });

  it("hard branch: ease decreases by 0.20 (clamped to 1.3)", () => {
    const card = makeInitialSm2Card({ id: "1", question: "Q", answer: "A", type: "definition" });
    const result = applySm2(card, "hard");
    const expected = Math.min(3.0, Math.max(1.3, card.ease - 0.20));
    expect(result.ease).toBeCloseTo(expected, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it("easy branch: ease increases by 0.10", () => {
    const card = makeInitialSm2Card({ id: "1", question: "Q", answer: "A", type: "definition" });
    const result = applySm2(card, "easy");
    const expected = Math.min(3.0, Math.max(1.3, card.ease + 0.10));
    expect(result.ease).toBeCloseTo(expected, 5);
    expect(result.repetitions).toBe(1);
  });

  it("good branch: ease stays neutral", () => {
    const card = makeInitialSm2Card({ id: "1", question: "Q", answer: "A", type: "definition" });
    const result = applySm2(card, "good");
    expect(result.ease).toBeCloseTo(card.ease, 5);
  });

  it("makeInitialSm2Card returns correct defaults", () => {
    const card = makeInitialSm2Card({ id: "abc", question: "Q", answer: "A", type: "definition" });
    expect(card.ease).toBe(2.5);
    expect(card.interval).toBe(1);
    expect(card.repetitions).toBe(0);
  });
});
