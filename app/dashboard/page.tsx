import Link from "next/link";
import DeckList, { type DeckItem } from "@/components/DeckList";
import CommunityActivityTicker from "@/components/CommunityActivityTicker";
import Card from "@/components/ui/Card";
import PageShell from "@/components/PageShell";
import { prisma } from "@/lib/prisma";
import { getServerUserId } from "@/lib/server-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const currentUserId = await getServerUserId();
  const data = await getDashboardData(currentUserId);
  const { myDecks, communityDecks, totalCards, dueTodayCount, masteredCount, weakCards, dbUnavailable } = data;

  const mappedMyDecks: DeckItem[] = myDecks.map((deck) => ({
    id: deck.id,
    title: deck.title,
    cardCount: deck._count.cards,
    lastStudied: deck.lastStudied,
    sourceFileName: deck.sourceFileName,
    isPublic: deck.isPublic,
    upvotes: deck.upvotes || 0,
    authorName: deck.user?.displayName || deck.user?.name || "You",
    userId: deck.userId,
  }));

  const mappedCommunityDecks: DeckItem[] = communityDecks.map((deck) => ({
    id: deck.id,
    title: deck.title,
    cardCount: deck._count.cards,
    lastStudied: deck.lastStudied,
    sourceFileName: deck.sourceFileName,
    isPublic: deck.isPublic,
    upvotes: deck.upvotes || 0,
    authorName: deck.user?.displayName || deck.user?.name || "Community Learner",
    userId: deck.userId,
  }));

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Study Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink/65">
            Track your personalized decks, review due cards, or explore the community library.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="inline-flex rounded-full border-2 border-ink bg-comic-yellow px-4 py-2 text-xs font-bold text-ink shadow-comic transition-transform hover:-translate-y-0.5"
          >
            + Create Deck 📄
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-bold text-ink shadow-comic transition-transform hover:-translate-y-0.5"
          >
            Leaderboard 🏆
          </Link>
        </div>
      </div>

      {/* Real-time Live Learner Ticker */}
      <div className="mt-5">
        <CommunityActivityTicker />
      </div>

      {dbUnavailable ? (
        <p className="mt-4 rounded-2xl border-2 border-comic-red bg-comic-red/10 px-4 py-3 text-sm text-comic-red">
          Database is not configured yet. Add `DATABASE_URL` to `.env.local` to unlock persistent data.
        </p>
      ) : null}

      {/* Stats Grid */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard emoji="📚" label="My Decks" value={mappedMyDecks.length} bgClass="bg-comic-purple/20" />
        <StatCard emoji="🃏" label="Total Cards" value={totalCards} bgClass="bg-comic-blue/20" />
        <StatCard emoji="⏰" label="Due Today" value={dueTodayCount} accent="coral" bgClass="bg-comic-red/20" />
        <StatCard emoji="✅" label="Mastered" value={masteredCount} accent="mint" bgClass="bg-comic-green/20" />
      </section>

      {/* Decks Grid with My Decks and Community Library Tabs */}
      <div className="mt-8">
        <DeckList
          myDecks={mappedMyDecks}
          communityDecks={mappedCommunityDecks}
          currentUserId={currentUserId}
        />
      </div>

      {/* Adaptive Weak Areas */}
      <Card className="mt-8 border-2 border-ink bg-amber-50/50 p-5 shadow-comic">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <h2 className="font-display text-lg font-bold text-ink">Adaptive Focus Areas</h2>
        </div>
        <p className="mt-1 text-xs text-ink/65">
          Cards with lower recall confidence automatically highlighted for quick repetition.
        </p>

        {weakCards.length === 0 ? (
          <p className="mt-4 rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-xs text-ink/65">
            No weak areas detected yet. As you rate cards &ldquo;Hard&rdquo;, they will appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {weakCards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3.5 py-2.5 shadow-xs"
              >
                <span className="max-w-[75%] truncate text-xs font-medium text-ink">
                  {shortenQuestion(card.question)}
                </span>
                <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
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

function StatCard({
  emoji,
  label,
  value,
  accent,
  bgClass,
}: {
  emoji: string;
  label: string;
  value: number;
  accent?: "coral" | "mint";
  bgClass?: string;
}) {
  const accentClass = accent === "coral" ? "text-coral" : accent === "mint" ? "text-mint" : "text-ink";
  return (
    <Card hover className={`p-4 sm:p-5 border-2 border-ink shadow-comic ${bgClass ?? ""}`}>
      <span className="text-2xl leading-none">{emoji}</span>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ink/50">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold leading-none ${accentClass}`}>{value}</p>
    </Card>
  );
}

function shortenQuestion(question: string): string {
  if (question.length <= 84) return question;
  return `${question.slice(0, 81).trimEnd()}...`;
}

async function getDashboardData(userId: string | null) {
  try {
    const userFilter = userId ? { OR: [{ userId }, { userId: null }] } : {};

    const [myDecks, communityDecks, totalCards, dueTodayCount, masteredCount, weakCards] = await Promise.all([
      // Personal decks for this user (or legacy decks if newly migrated)
      prisma.deck.findMany({
        where: userFilter,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { cards: true },
          },
          user: {
            select: { displayName: true, name: true },
          },
        },
      }),
      // Community library decks shared by other live learners
      prisma.deck.findMany({
        where: {
          isPublic: true,
          ...(userId ? { NOT: { userId } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          _count: {
            select: { cards: true },
          },
          user: {
            select: { displayName: true, name: true },
          },
        },
      }),
      // Flashcard counts scoped to user
      prisma.flashcard.count({
        where: userId ? { deck: userFilter } : {},
      }),
      prisma.flashcard.count({
        where: {
          dueDate: {
            lte: new Date(),
          },
          ...(userId ? { deck: userFilter } : {}),
        },
      }),
      prisma.flashcard.count({
        where: {
          interval: {
            gt: 7,
          },
          ...(userId ? { deck: userFilter } : {}),
        },
      }),
      prisma.flashcard.findMany({
        where: {
          difficultyScore: {
            gt: 0,
          },
          ...(userId ? { deck: userFilter } : {}),
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
      myDecks,
      communityDecks,
      totalCards,
      dueTodayCount,
      masteredCount,
      weakCards,
      dbUnavailable: false,
    };
  } catch {
    return {
      myDecks: [],
      communityDecks: [],
      totalCards: 0,
      dueTodayCount: 0,
      masteredCount: 0,
      weakCards: [],
      dbUnavailable: true,
    };
  }
}
