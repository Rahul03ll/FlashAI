import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateDistractors } from "@/lib/groq";

export const runtime = "nodejs";

const distractorsSchema = z.array(z.string().min(1)).length(3);

type RouteContext = {
  params: Promise<{ deckId: string }>;
};

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a valid distractor JSON array.");
  }
  return text.slice(start, end + 1);
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { deckId } = await context.params;

    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    const FALLBACK_DISTRACTORS = [
      "A related but incorrect interpretation",
      "A common misconception",
      "An overgeneralization of the concept",
    ];

    const quiz = await Promise.all(
      deck.cards.map(async (card): Promise<QuizQuestion> => {
        // Per-card try/catch: a single AI failure uses fallback distractors
        // instead of aborting the entire quiz.
        let incorrect: string[] = FALLBACK_DISTRACTORS;
        try {
          const raw = await generateDistractors(card.question, card.answer);
          const jsonArray = extractJsonArray(raw);
          const parsed: unknown = JSON.parse(jsonArray);
          const validated = distractorsSchema.safeParse(parsed);
          if (validated.success) {
            incorrect = validated.data;
          }
        } catch {
          // fall through to fallback distractors
        }

        const options = shuffle([card.answer, ...incorrect]).slice(0, 4);
        const correctIndex = options.findIndex((option) => option === card.answer);

        return {
          question: card.question,
          options,
          correctIndex: correctIndex === -1 ? 0 : correctIndex,
        };
      }),
    );

    return NextResponse.json({ deckId: deck.id, title: deck.title, quiz });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create quiz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
