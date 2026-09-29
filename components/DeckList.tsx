"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import DeleteDeckButton from "@/components/DeleteDeckButton";
import { getOrCreateLocalUserId } from "@/lib/client-user";

export type DeckItem = {
  id: string;
  title: string;
  cardCount: number;
  lastStudied: Date | null;
  sourceFileName?: string | null;
  isPublic?: boolean;
  upvotes?: number;
  authorName?: string | null;
  userId?: string | null;
};

type DeckListProps = {
  decks?: DeckItem[];
  myDecks?: DeckItem[];
  communityDecks?: DeckItem[];
  currentUserId?: string | null;
};

function formatLastStudied(date: Date | null): string {
  if (!date) return "Not studied yet";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Studied today";
  if (diffDays === 1) return "Studied yesterday";
  return `Studied ${diffDays}d ago`;
}

export default function DeckList({
  decks = [],
  myDecks: initialMyDecks,
  communityDecks = [],
}: DeckListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"my" | "community">("my");
  const [query, setQuery] = useState("");
  const [cloningDeckId, setCloningDeckId] = useState<string | null>(null);
  const [myDecksState, setMyDecksState] = useState<DeckItem[]>(initialMyDecks ?? decks);
  const [communityDecksState, setCommunityDecksState] = useState<DeckItem[]>(communityDecks);

  const activeDeckList = activeTab === "my" ? myDecksState : communityDecksState;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeDeckList;
    return activeDeckList.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.sourceFileName?.toLowerCase().includes(q) ||
        d.authorName?.toLowerCase().includes(q),
    );
  }, [activeDeckList, query]);

  async function handleUpvoteDeck(deckId: string) {
    try {
      const userId = getOrCreateLocalUserId();
      const res = await fetch(`/api/deck/${deckId}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCommunityDecksState((prev) =>
        prev.map((d) => (d.id === deckId ? { ...d, upvotes: data.upvoteCount } : d))
      );
    } catch {
      // silent fallback
    }
  }

  async function handleTogglePrivacy(deckId: string, currentPublicState: boolean) {
    try {
      const res = await fetch(`/api/deck/${deckId}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !currentPublicState }),
      });
      if (!res.ok) return;
      setMyDecksState((prev) =>
        prev.map((d) => (d.id === deckId ? { ...d, isPublic: !currentPublicState } : d)),
      );
    } catch {
      // silent fallback
    }
  }

  async function handleCloneDeck(deckId: string) {
    try {
      setCloningDeckId(deckId);
      const userId = getOrCreateLocalUserId();
      const res = await fetch(`/api/deck/${deckId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to clone deck.");
        return;
      }
      router.push(`/deck/${data.deckId}`);
      router.refresh();
    } catch {
      alert("Failed to clone deck. Please try again.");
    } finally {
      setCloningDeckId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white/95 p-5 shadow-comic sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("my")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === "my"
                  ? "border-2 border-ink bg-comic-yellow text-ink shadow-comic-sm"
                  : "border border-black/10 bg-black/5 text-ink/65 hover:bg-black/10"
              }`}
            >
              📚 My Decks ({myDecksState.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("community")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === "community"
                  ? "border-2 border-ink bg-comic-yellow text-ink shadow-comic-sm"
                  : "border border-black/10 bg-black/5 text-ink/65 hover:bg-black/10"
              }`}
            >
              🌐 Community Library ({communityDecks.length})
            </button>
          </div>

          <p className="mt-2 text-xs text-ink/60">
            {activeTab === "my"
              ? "Your private and custom study decks. Only you control your spaced repetition progress."
              : "Discover public flashcard decks created by other students in the FlashAI community!"}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeTab === "my" ? "Search my decks…" : "Search community…"}
            className="w-full rounded-full border-2 border-ink bg-white py-2 pl-9 pr-4 text-xs font-medium text-ink placeholder:text-ink/40 shadow-comic focus:outline-none sm:w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-ink bg-white/70 p-8 text-center">
          <div className="text-5xl">{activeTab === "my" ? "📚" : "🌐"}</div>
          <h3 className="mt-3 font-display text-xl font-bold text-ink">
            {query
              ? `No decks match "${query}"`
              : activeTab === "my"
              ? "No decks created yet"
              : "No community decks shared yet"}
          </h3>
          <p className="mt-1 text-sm text-ink/65">
            {activeTab === "my"
              ? "Upload a PDF or try demo mode to generate your first spaced repetition deck."
              : "Be the first to share a deck with the community by checking 'Share with Community' during upload!"}
          </p>
          {activeTab === "my" && (
            <div className="mt-4">
              <Button variant="accent" onClick={() => (window.location.href = "/upload")}>
                Upload a PDF
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deck) => {
            const isCloning = cloningDeckId === deck.id;

            return (
              <div
                key={deck.id}
                className="group relative flex flex-col justify-between rounded-2xl border-2 border-ink bg-white p-5 shadow-comic transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0a0a0f]"
              >
                {/* Subtle stacked card deck edge */}
                <div className="pointer-events-none absolute -inset-0.5 rounded-2xl border border-ink/10 bg-comic-yellow/10 -z-10 [transform:rotate(1.5deg)] transition-transform group-hover:[transform:rotate(2.5deg)]" />

                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-2 border-b border-black/8 pb-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                      <span>🃏</span>
                      <span>{deck.cardCount} cards</span>
                    </span>

                    {activeTab === "my" ? (
                      <div className="flex items-center gap-1.5">
                        {/* Privacy toggle */}
                        <button
                          type="button"
                          onClick={() => handleTogglePrivacy(deck.id, Boolean(deck.isPublic))}
                          title={deck.isPublic ? "Public in Community (Click to make Private)" : "Private (Click to share with Community)"}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold transition-all ${
                            deck.isPublic
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-black/10 bg-black/5 text-ink/60"
                          }`}
                        >
                          {deck.isPublic ? "🌐 Public" : "🔒 Private"}
                        </button>
                        <DeleteDeckButton deckId={deck.id} deckTitle={deck.title} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpvoteDeck(deck.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 transition-all hover:bg-rose-100 hover:scale-105 active:scale-95 shadow-xs"
                          title="Upvote this community deck"
                        >
                          <span>❤️</span>
                          <span>{deck.upvotes || 0}</span>
                        </button>
                        <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-ink/60">
                          👤 {deck.authorName || "Learner"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <Link href={`/deck/${deck.id}`} className="mt-3 block">
                    <h3 className="font-display text-base font-bold text-ink leading-snug transition-colors group-hover:text-accent sm:text-lg">
                      {query ? highlight(deck.title, query) : deck.title}
                    </h3>
                  </Link>

                  {/* Meta */}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-ink/50 flex items-center gap-1.5">
                      <span>🕒</span>
                      <span>{formatLastStudied(deck.lastStudied)}</span>
                    </p>
                    {deck.sourceFileName ? (
                      <p className="text-xs text-ink/40 truncate flex items-center gap-1.5">
                        <span>📄</span>
                        <span className="truncate">{deck.sourceFileName}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-black/6 flex items-center justify-between">
                  {activeTab === "my" ? (
                    <>
                      <Link
                        href={`/deck/${deck.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-comic-yellow px-4 py-1.5 text-xs font-bold text-ink shadow-comic transition-all hover:bg-comic-yellow/80 hover:translate-x-0.5"
                      >
                        <span>Study Deck</span>
                        <span>⚡</span>
                      </Link>

                      <Link
                        href={`/quiz/${deck.id}`}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        Quiz Mode →
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCloneDeck(deck.id)}
                        disabled={isCloning}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-comic-green px-4 py-1.5 text-xs font-bold text-ink shadow-comic transition-all hover:bg-comic-green/80 disabled:opacity-50"
                      >
                        <span>{isCloning ? "Cloning..." : "📥 Clone to My Decks"}</span>
                      </button>

                      <Link
                        href={`/deck/${deck.id}`}
                        className="text-xs font-semibold text-ink/60 hover:text-ink hover:underline"
                      >
                        Preview →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Wrap matching characters in a yellow highlight span. */
function highlight(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-warn/30 px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
