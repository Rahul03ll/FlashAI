"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateLocalUserId } from "@/lib/client-user";

type CloneSharedDeckButtonProps = {
  deckId: string;
  deckTitle: string;
};

export default function CloneSharedDeckButton({
  deckId,
  deckTitle,
}: CloneSharedDeckButtonProps) {
  const router = useRouter();
  const [isCloning, setIsCloning] = useState(false);

  async function handleClone() {
    try {
      setIsCloning(true);
      const userId = getOrCreateLocalUserId();
      const res = await fetch(`/api/deck/${deckId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to import deck.");
        return;
      }

      router.push(`/deck/${data.deckId}`);
      router.refresh();
    } catch {
      alert("Failed to import deck into your account. Please try again.");
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClone}
      disabled={isCloning}
      className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-comic-yellow px-6 py-2.5 text-sm font-bold text-ink shadow-comic transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#0a0a0f] disabled:opacity-60"
    >
      <span>{isCloning ? "⏳" : "📥"}</span>
      <span>
        {isCloning ? "Importing to your library..." : "Clone to My Decks & Start Studying"}
      </span>
    </button>
  );
}
