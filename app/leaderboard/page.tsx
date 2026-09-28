import Link from "next/link";
import LeaderboardClient from "@/components/LeaderboardClient";
import PageShell from "@/components/PageShell";
import Card from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <Card className="w-full p-5 sm:p-6 border-2 border-ink shadow-comic bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-block rounded-full bg-comic-yellow border-2 border-ink px-3 py-0.5 text-xs font-bold text-ink mb-1.5 shadow-xs">
                🏆 Global Arena
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
                FlashAI Leaderboard
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-ink/65">
                Compete with learners worldwide, earn XP through spaced repetition, and protect your streak.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="self-start sm:self-auto rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-bold text-ink shadow-comic transition-all hover:bg-black/5 hover:-translate-y-0.5"
            >
              ← Dashboard
            </Link>
          </div>
        </Card>
      </div>

      <LeaderboardClient />
    </PageShell>
  );
}
