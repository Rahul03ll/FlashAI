import Link from "next/link";
import { notFound } from "next/navigation";
import DeckStudyClient from "@/components/DeckStudyClient";
import PageShell from "@/components/PageShell";
import ShareDeckButton from "@/components/ShareDeckButton";
import Card from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { flashcardTypeSchema, type Flashcard } from "@/types/flashcard";

export const dynamic = "force-dynamic";

type DeckPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeckPage({ params }: DeckPageProps) {
  const { id } = await params;

  const deck = await prisma.deck.findUnique({
    where: { id },
    include: {
      cards: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!deck) {
    notFound();
  }

  const cards: Flashcard[] = deck.cards.map((card) => ({
    id: card.id,
    question: card.question,
    answer: card.answer,
    type: flashcardTypeSchema.catch("definition").parse(card.type),
    difficultyScore: card.difficultyScore,
    ease: card.ease,
    interval: card.interval,
    repetitions: card.repetitions,
    dueDate: card.dueDate.toISOString(),
  }));

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <Card className="p-6">
        <h1 className="font-display text-3xl font-extrabold leading-snug text-ink sm:text-4xl">
          <span className="bg-comic-yellow border-2 border-ink rounded-full px-3 py-1 inline-block">{deck.title}</span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">Study due cards and let SM-2 schedule reviews.</p>
        {deck.sourceFileName ? (
          <p className="mt-2 text-xs text-ink/50">Source PDF: {deck.sourceFileName}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/quiz/${deck.id}`}
            className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:bg-[#4f43ee]"
          >
            Start Quiz Mode
          </Link>
          <ShareDeckButton deckId={deck.id} initialShareToken={deck.shareToken} />
        </div>
      </Card>

      <div className="mt-8">
        <DeckStudyClient deckId={deck.id} initialCards={cards} />
      </div>
      <div className="hidden sm:flex justify-center gap-4 mt-2 text-xs text-ink/50">
        <span><kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono">Space</kbd> = flip</span>
        <span><kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono">1</kbd> = Hard</span>
        <span><kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono">2</kbd> = Good</span>
        <span><kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono">3</kbd> = Easy</span>
      </div>
    </PageShell>
  );
}
