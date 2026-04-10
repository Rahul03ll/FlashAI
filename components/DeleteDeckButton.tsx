"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DeleteDeckButtonProps = {
  deckId: string;
  deckTitle: string;
};

function AutoCancelConfirm({ onCancel }: { onCancel: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onCancel(), 2000);
    return () => clearTimeout(timer);
  }, [onCancel]);
  return null;
}

export default function DeleteDeckButton({ deckId, deckTitle }: DeleteDeckButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deck/${deckId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 border-2 border-ink rounded-full px-1" onClick={(e) => e.preventDefault()}>
        <AutoCancelConfirm onCancel={() => setConfirming(false)} />
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#dc2626] disabled:opacity-60 transition-colors"
        >
          {deleting ? "…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-full border border-black/15 px-2.5 py-1 text-xs text-ink/60 hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setConfirming(true);
      }}
      title={`Delete "${deckTitle}"`}
      className="rounded-full border border-black/10 px-2 py-1 text-xs text-ink/40 hover:border-danger/40 hover:text-danger transition-colors"
    >
      ✕
    </button>
  );
}
