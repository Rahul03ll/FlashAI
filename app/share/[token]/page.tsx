import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import Card from "@/components/ui/Card";
import DeckPreviewCard from "@/components/DeckPreviewCard";
import CloneSharedDeckButton from "@/components/CloneSharedDeckButton";
import { prisma } from "@/lib/prisma";
import { flashcardTypeSchema } from "@/types/flashcard";

type SharedDeckPageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharedDeckPage({ params }: SharedDeckPageProps) {
  const { token } = await params;
  const deck = await prisma.deck.findFirst({
    where: { shareToken: token },
    include: { cards: { orderBy: { createdAt: "asc" } } },
  });

  if (!deck) notFound();

  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="inline-block bg-comic-yellow border-2 border-ink rounded-2xl px-4 py-2 font-display text-xl shadow-comic-sm">
          📤 Shared Flashcard Deck
        </div>

        <CloneSharedDeckButton deckId={deck.id} deckTitle={deck.title} />
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">{deck.title}</h1>
            <p className="mt-1 text-sm text-ink/65">
              Shared deck preview · {deck.cards.length} cards · Clone to track your own SM-2 spaced repetition progress!
            </p>
          </div>
          <div className="shrink-0">
            <CloneSharedDeckButton deckId={deck.id} deckTitle={deck.title} />
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {deck.cards.map((card, index) => (
          <DeckPreviewCard
            key={card.id}
            card={{
              question: card.question,
              answer: card.answer,
              type: flashcardTypeSchema.catch("definition").parse(card.type),
            }}
            index={index}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
        <CloneSharedDeckButton deckId={deck.id} deckTitle={deck.title} />
        <Link
          href="/"
          className="inline-flex rounded-full border-2 border-ink bg-white px-6 py-2.5 text-sm font-bold text-ink shadow-comic transition-transform hover:-translate-y-0.5"
        >
          Create Your Own Deck on FlashAI 🚀
        </Link>
      </div>
    </PageShell>
  );
}
