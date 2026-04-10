import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import Card from "@/components/ui/Card";
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
      <div className="mb-4 inline-block bg-comic-yellow border-2 border-ink rounded-2xl px-4 py-2 font-display text-xl">
        📤 Shared Deck
      </div>
      <Card className="p-6">
        <h1 className="text-4xl text-ink">{deck.title}</h1>
        <p className="mt-1 text-sm text-ink/65">Shared read-only deck view.</p>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {deck.cards.map((card) => (
          <Card key={card.id} className="p-4">
            <p className="text-xs uppercase tracking-wide text-accent">
              {flashcardTypeSchema.catch("definition").parse(card.type)}
            </p>
            <p className="mt-2 font-semibold text-ink">{card.question}</p>
            <p className="mt-2 text-sm text-ink/75">{card.answer}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/" className="text-sm text-accent underline">
          Open FlashAI
        </Link>
      </div>
    </PageShell>
  );
}
