"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import DeleteDeckButton from "@/components/DeleteDeckButton";

type DeckItem = {
  id: string;
  title: string;
  cardCount: number;
  lastStudied: Date | null;
  sourceFileName?: string | null;
};

type DeckListProps = {
  decks: DeckItem[];
};

function formatLastStudied(date: Date | null): string {
  if (!date) return "Not studied yet";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Studied today";
  if (diffDays === 1) return "Studied yesterday";
  return `Studied ${diffDays}d ago`;
}

export default function DeckList({ decks }: DeckListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.sourceFileName?.toLowerCase().includes(q),
    );
  }, [decks, query]);

  if (decks.length === 0) {
    return (
      <Card className="border-dashed border-2 border-ink bg-white/70 p-8 text-center">
        <div className="text-5xl">📚</div>
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">No decks yet</h2>
        <p className="mt-2 text-sm text-ink/65">Upload your first PDF to generate an interactive study deck.</p>
        <div className="mt-4">
          <Button variant="accent" onClick={() => (window.location.href = "/upload")}>
            Upload a PDF
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white/95 p-5 shadow-comic sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Your Decks</h2>
          <p className="text-xs text-ink/60">
            {decks.length} {decks.length === 1 ? "study deck" : "study decks"} ready for spaced repetition
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
            placeholder="Search decks…"
            className="w-full rounded-full border-2 border-ink bg-white py-2 pl-9 pr-4 text-xs font-medium text-ink placeholder:text-ink/40 shadow-comic focus:outline-none sm:w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white/60 py-10 text-center text-sm text-ink/60">
          No decks match &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deck) => (
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

                  <DeleteDeckButton deckId={deck.id} deckTitle={deck.title} />
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

              {/* Study Action CTA */}
              <div className="mt-5 pt-3 border-t border-black/6 flex items-center justify-between">
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
              </div>
            </div>
          ))}
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
