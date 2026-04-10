import Link from "next/link";
import LeaderboardClient from "@/components/LeaderboardClient";
import PageShell from "@/components/PageShell";
import Card from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <Card className="w-full p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Leaderboard</h1>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">Compete, improve, and keep your streak alive.</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-ink transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:bg-white"
            >
              Back
            </Link>
          </div>
        </Card>
      </div>

      <LeaderboardClient />
    </PageShell>
  );
}
