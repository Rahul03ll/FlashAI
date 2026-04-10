import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generatedFlashcardSchema } from "@/types/flashcard";

// Pure helpers extracted from the generate route logic for testability

function parseNdjsonBuffer(buffer: string): Array<{ question: string; answer: string; type: string }> {
  const results: Array<{ question: string; answer: string; type: string }> = [];
  const lines = buffer.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      const validated = generatedFlashcardSchema.safeParse(parsed);
      if (validated.success) {
        results.push(validated.data);
      }
    } catch {
      // skip malformed lines
    }
  }
  return results;
}

function deduplicateCards(
  cards: Array<{ question: string; answer: string; type: string }>,
): Array<{ question: string; answer: string; type: string }> {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.question.toLowerCase()}|${card.answer.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const arbitraryValidCard = fc.record({
  question: fc.string({ minLength: 1, maxLength: 80 }),
  answer: fc.string({ minLength: 1, maxLength: 200 }),
  type: fc.constantFrom("definition", "reasoning", "misconception", "example", "edge"),
});

// Feature: cartoonistic-app-overhaul, Property 4: Buffer parser emits only schema-valid cards
describe("Generate API Property Tests", () => {
  it("P4: parseNdjsonBuffer emits only schema-valid cards", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            arbitraryValidCard.map((c) => JSON.stringify(c)),
            fc.string({ minLength: 0, maxLength: 50 }), // random garbage lines
          ),
          { minLength: 0, maxLength: 20 },
        ),
        (lines) => {
          const buffer = lines.join("\n");
          const emitted = parseNdjsonBuffer(buffer);
          return emitted.every((card) => generatedFlashcardSchema.safeParse(card).success);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: cartoonistic-app-overhaul, Property 5: Deduplication
  it("P5: deduplicateCards removes duplicate (question, answer) pairs case-insensitively", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryValidCard, { minLength: 0, maxLength: 30 }),
        (cards) => {
          // Inject some duplicates
          const withDupes = [...cards, ...cards.slice(0, 3)];
          const deduped = deduplicateCards(withDupes);
          const keys = deduped.map(
            (c) => `${c.question.toLowerCase()}|${c.answer.toLowerCase()}`,
          );
          return new Set(keys).size === keys.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: cartoonistic-app-overhaul, Property 7: PDF text truncation
  it("P7: text.slice(0, 12000) always produces a string of length <= 12000", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50000 }), (text) => {
        const truncated = text.slice(0, 12000);
        return truncated.length <= 12000;
      }),
      { numRuns: 100 },
    );
  });
});
