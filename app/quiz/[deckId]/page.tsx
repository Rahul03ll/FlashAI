import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import QuizClient from "@/components/QuizClient";
import Card from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type QuizPageProps = {
  params: Promise<{ deckId: string }>;
};

export default async function QuizPage({ params }: QuizPageProps) {
  const { deckId } = await params;

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: {
      id: true,
      title: true,
    },
  });

  if (!deck) notFound();

  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Card className="w-full p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Quiz Mode</h1>
              <p className="mt-1 text-sm font-medium text-ink/60">{deck.title}</p>
            </div>
        <Link
          href={`/deck/${deck.id}`}
          className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-ink transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:bg-white"
        >
          Back to Study
        </Link>
          </div>
        </Card>
      </div>

      <QuizClient deckId={deck.id} />
    </PageShell>
  );
}
