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
  return `Last studied ${date.toLocaleDateString()}`;
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
        <p className="mt-2 text-sm text-ink/65">Upload your first PDF to generate a study deck.</p>
        <div className="mt-4">
          <Button variant="accent" onClick={() => window.location.href = '/upload'}>Upload a PDF</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">Your Decks</h2>
          <p className="text-sm text-ink/60">
            {decks.length} {decks.length === 1 ? "deck" : "decks"} · pick one to continue studying
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/35">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search decks…"
            className="w-full rounded-full border border-black/10 bg-white/80 py-2 pl-8 pr-4 text-sm text-ink placeholder:text-ink/35 focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-black/15 py-6 text-center text-sm text-ink/50">
          No decks match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((deck) => (
            <div
              key={deck.id}
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/80 px-4 py-3 transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-accent/50 hover:bg-white"
            >
              <Link href={`/deck/${deck.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {query ? highlight(deck.title, query) : deck.title}
                </p>
                <p className="text-xs text-ink/50">{formatLastStudied(deck.lastStudied)}</p>
                {deck.sourceFileName ? (
                  <p className="text-xs text-ink/40">📄 {deck.sourceFileName}</p>
                ) : null}
              </Link>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                  {deck.cardCount} cards
                </span>
                <DeleteDeckButton deckId={deck.id} deckTitle={deck.title} />
              </div>
            </div>
          ))}
        </ul>
      )}
    </Card>
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
