import Link from "next/link";
import CardStackPreview from "@/components/CardStackPreview";
import PageShell from "@/components/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const features = [
  { emoji: "📄", title: "Upload a PDF", desc: "Drop any textbook, paper, or notes — we parse the text instantly.", href: "/upload" },
  { emoji: "⚡", title: "AI Flashcards", desc: "Groq's LLM generates 15–20 exam-quality cards across 5 types.", href: "/upload" },
  { emoji: "🧠", title: "Smart Reviews", desc: "SM-2 spaced repetition schedules your reviews at the perfect moment.", href: "/dashboard" },
  { emoji: "🏆", title: "Leaderboard", desc: "Earn XP, build streaks, and climb the global rankings.", href: "/leaderboard" },
];

export default function HomePage() {
  return (
    <PageShell maxWidthClassName="max-w-6xl">
      {/* Hero */}
      <div className="flex flex-col items-center gap-10 py-10 text-center lg:flex-row lg:items-center lg:text-left">
        <div className="flex-1">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Powered by Groq · llama-3.3-70b
          </span>
          <h1 className="font-display mt-4 text-5xl font-extrabold leading-[1.1] text-ink sm:text-6xl lg:text-7xl">
            Study{" "}
            <span className="relative inline-block">
              <span className="relative z-10">smarter</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-comic-yellow -z-10 rounded" />
            </span>
            ,<br />
            <span className="text-accent">not harder.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink/60 sm:text-lg">
            Upload a PDF and get AI-generated flashcards in seconds. Spaced repetition keeps them in your head for good.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href="/upload">
              <Button variant="accent" className="border-2 border-ink shadow-comic">
                Upload a PDF →
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost">
                My Dashboard
              </Button>
            </Link>
          </div>
        </div>
        <div className="w-full flex-1 max-w-sm lg:max-w-none">
          <CardStackPreview />
        </div>
      </div>

      {/* Features */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ emoji, title, desc, href }) => (
          <Link key={title} href={href} className="group">
            <Card hover className="h-full p-5">
              <span className="text-3xl">{emoji}</span>
              <h2 className="mt-3 text-[1rem] font-bold text-ink group-hover:text-accent transition-colors">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
