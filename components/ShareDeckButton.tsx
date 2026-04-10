"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type ShareDeckButtonProps = {
  deckId: string;
  /** Persisted shareToken already stored in the database, if any. */
  initialShareToken?: string | null;
};

function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

export default function ShareDeckButton({ deckId, initialShareToken }: ShareDeckButtonProps) {
  const [status, setStatus] = useState<string>(() =>
    initialShareToken ? "Already shared — click to copy link" : "",
  );

  async function handleShare() {
    setStatus("");

    // If the deck already has a persisted share token, just copy the
    // existing URL instead of hitting the API and generating a new one.
    if (initialShareToken) {
      try {
        await navigator.clipboard.writeText(buildShareUrl(initialShareToken));
        setStatus("Share link copied!");
        setTimeout(() => setStatus("Already shared — click to copy link"), 2000);
      } catch {
        setStatus("Could not copy to clipboard.");
        setTimeout(() => setStatus("Already shared — click to copy link"), 2000);
      }
      return;
    }

    const response = await fetch(`/api/deck/${deckId}/share`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setStatus("Could not generate link.");
      setTimeout(() => setStatus(""), 2000);
      return;
    }

    try {
      const absoluteUrl = `${window.location.origin}${data.shareUrl}`;
      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("Share link copied!");
    } catch {
      setStatus("Link ready — copy from URL bar.");
    }
    setTimeout(() => setStatus(""), 2500);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={handleShare}>
        {initialShareToken ? "Copy Share Link" : "Share Deck"}
      </Button>
      {status ? (
        <span className="rounded-full bg-comic-green border-2 border-ink px-3 py-1 text-xs font-semibold text-ink">
          {status.includes("copied") || status.includes("Copied") ? "Copied! ✓" : status}
        </span>
      ) : null}
    </div>
  );
}
