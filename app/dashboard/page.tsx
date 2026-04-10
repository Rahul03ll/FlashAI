import Link from "next/link";
import DeckList from "@/components/DeckList";
import Card from "@/components/ui/Card";
import PageShell from "@/components/PageShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { decks, totalCards, dueTodayCount, masteredCount, weakCards, dbUnavailable } = data;

  const mappedDecks = decks.map((deck) => ({
    id: deck.id,
    title: deck.title,
    cardCount: deck._count.cards,
    lastStudied: deck.lastStudied,
    sourceFileName: deck.sourceFileName,
  }));

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">Dashboard</h1>
      <p className="mt-2 text-base text-ink/60">Track your decks and resume where you left off.</p>
      {dbUnavailable ? (
        <p className="mt-3 rounded-2xl bg-comic-red/10 border-2 border-comic-red px-3 py-2 text-sm text-comic-red">
          Database is not configured yet. Add `DATABASE_URL` to `.env.local` and run Prisma
          migration to unlock persistent data.
        </p>
      ) : null}
      <div className="mt-4">
        <Link
          href="/leaderboard"
          className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:bg-[#4f43ee]"
        >
          View Leaderboard 🏆
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard emoji="📚" label="Total Decks" value={mappedDecks.length} bgClass="bg-comic-purple/20" />
        <StatCard emoji="🃏" label="Total Cards" value={totalCards} bgClass="bg-comic-blue/20" />
        <StatCard emoji="⏰" label="Due Today" value={dueTodayCount} accent="coral" bgClass="bg-comic-red/20" />
        <StatCard emoji="✅" label="Mastered" value={masteredCount} accent="mint" bgClass="bg-comic-green/20" />
      </section>

      <div className="mt-8">
        <DeckList decks={mappedDecks} />
      </div>

      <Card className="mt-8 border-coral/25 bg-coral/10 p-5">
        <h2 className="text-lg font-bold text-ink">⚠️ Weak Areas</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/65">
          You struggle with these concepts. Review them again.
        </p>

        {weakCards.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/80 px-3 py-2 text-sm text-ink/65">
            No weak areas detected yet. Keep studying to build adaptive insights.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {weakCards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between rounded-2xl border border-coral/15 bg-white px-3 py-2"
              >
                <span className="max-w-[75%] truncate text-sm text-ink/80">
                  {shortenQuestion(card.question)}
                </span>
                <span className="rounded-full bg-coral/15 px-2 py-1 text-xs font-medium text-coral">
                  Difficulty {card.difficultyScore}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

function StatCard({ emoji, label, value, accent, bgClass }: { emoji: string; label: string; value: number; accent?: "coral" | "mint"; bgClass?: string }) {
  const accentClass = accent === "coral" ? "text-coral" : accent === "mint" ? "text-mint" : "text-ink";
  return (
    <Card hover className={`p-5 border-2 border-ink shadow-comic ${bgClass ?? ""}`}>
      <span className="text-3xl leading-none">{emoji}</span>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold leading-none ${accentClass}`}>{value}</p>
    </Card>
  );
}

function shortenQuestion(question: string): string {
  if (question.length <= 84) return question;
  return `${question.slice(0, 81).trimEnd()}...`;
}

async function getDashboardData() {
  try {
    const [decks, totalCards, dueTodayCount, masteredCount, weakCards] = await Promise.all([
      prisma.deck.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { cards: true },
          },
        },
      }),
      prisma.flashcard.count(),
      prisma.flashcard.count({
        where: {
          dueDate: {
            lte: new Date(),
          },
        },
      }),
      prisma.flashcard.count({
        where: {
          interval: {
            gt: 7,
          },
        },
      }),
      prisma.flashcard.findMany({
        where: {
          difficultyScore: {
            gt: 0,
          },
        },
        orderBy: [{ difficultyScore: "desc" }, { updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          question: true,
          difficultyScore: true,
        },
      }),
    ]);

    return {
      decks,
      totalCards,
      dueTodayCount,
      masteredCount,
      weakCards,
      dbUnavailable: false,
    };
  } catch {
    return {
      decks: [],
      totalCards: 0,
      dueTodayCount: 0,
      masteredCount: 0,
      weakCards: [],
      dbUnavailable: true,
    };
  }
}
