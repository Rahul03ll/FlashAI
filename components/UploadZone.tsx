"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { generatedFlashcardSchema } from "@/types/flashcard";

type StreamEvent =
  | { type: "card"; card: { question: string; answer: string; type: string } }
  | { type: "done"; deckId: string; cardsCount: number; truncated?: boolean }
  | { type: "error"; error: string };


export default function UploadZone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewCards, setPreviewCards] = useState<
    Array<{ question: string; answer: string; type: string }>
  >([]);
  const [statusText, setStatusText] = useState<string>("Waiting for upload");
  const [showTruncatedWarning, setShowTruncatedWarning] = useState(false);

  const skeletonCount = useMemo(() => Math.max(15 - previewCards.length, 0), [previewCards.length]);

  async function consumeStream(response: Response) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Streaming not supported in this browser.");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const parsed: unknown = JSON.parse(line);
        const event = parsed as StreamEvent;

        if (event.type === "card") {
          const validated = generatedFlashcardSchema.safeParse(event.card);
          if (!validated.success) continue;
          setPreviewCards((prev) => [...prev, validated.data]);
          setStatusText("Generating flashcards...");
        } else if (event.type === "error") {
          throw new Error(event.error);
        } else if (event.type === "done") {
          setStatusText(`Created deck with ${event.cardsCount} cards`);
          if ("truncated" in event && event.truncated) {
            setShowTruncatedWarning(true);
          }
          setTimeout(() => {
            router.push(`/deck/${event.deckId}`);
            router.refresh();
          }, 3000);
        }
      }
    }
  }

  async function handleGenerate() {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setPreviewCards([]);
    setStatusText("Uploading PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const message =
          typeof errorData === "object" &&
          errorData !== null &&
          "error" in errorData &&
          typeof (errorData as { error: unknown }).error === "string"
            ? (errorData as { error: string }).error
            : "Failed to generate flashcards.";
        setError(message);
        return;
      }

      await consumeStream(response);
    } catch {
      setError("Unexpected error while generating flashcards.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDemoMode() {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/demo-deck", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not start demo mode.");
        return;
      }
      router.push(`/deck/${data.deckId}`);
      router.refresh();
    } catch {
      setError("Could not start demo mode.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-1">
      <Card hover className="p-4 sm:p-6">
        <h2 className="text-xl font-bold text-ink">Upload PDF</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/65">
          Create a persistent deck from your PDF with Groq-generated flashcards.
        </p>

        <div className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Deck title (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="block w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-ink focus:border-accent focus:outline-none"
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-4 border-dashed border-ink p-6 text-center transition-all duration-300 ease-premium ${
              isDragging
                ? "border-accent bg-accent/10"
                : "bg-white/70 hover:border-accent/70"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="text-6xl">📄</div>
            <AnimatePresence>
              {isDragging && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="font-display text-2xl text-ink mt-2"
                >
                  Drop it! 📄
                </motion.p>
              )}
            </AnimatePresence>
            <p className="text-sm font-semibold text-ink mt-2">
              {file ? `Selected: ${file.name}` : "Drag & drop your PDF here"}
            </p>
            <p className="mt-1 text-xs text-ink/55">or</p>
            <Button
              variant="ghost"
              className="mt-3"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose PDF File
            </Button>
          </div>

          <Button type="button" onClick={handleGenerate} disabled={isLoading} className="w-full">
            {isLoading ? "Generating your flashcards..." : "Generate Deck"}
          </Button>
          <Button type="button" onClick={handleDemoMode} disabled={isLoading} variant="ghost" className="w-full">
            Try without uploading
          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border-2 border-comic-red bg-comic-red/10 px-3 py-2 flex items-center gap-2">
            <span>❌</span>
            <span className="text-sm text-comic-red flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => { setError(null); setFile(null); setPreviewCards([]); setStatusText("Waiting for upload"); }}>Try Again</Button>
          </div>
        ) : null}
        {showTruncatedWarning && (
          <p className="mt-3 rounded-xl border border-amber/35 bg-amber/10 px-3 py-2 text-sm text-amber-700">
            Large PDF detected — only the first ~15 pages were analyzed to stay within AI limits.
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm text-ink/60">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isLoading ? "animate-pulse bg-mint" : "bg-black/20"
            }`}
          />
          <span>{statusText}</span>
        </div>
      </Card>

      {(isLoading || previewCards.length > 0) && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {previewCards.map((card, index) => (
            <motion.div
              key={`${card.question}-${index}`}
              variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card hover className="h-full">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">Question</p>
                <p className="mt-2 text-sm font-medium text-ink">{card.question}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mint">Answer</p>
                <p className="mt-2 text-sm text-ink/75">{card.answer}</p>
              </Card>
            </motion.div>
          ))}

          {skeletonCount > 0 ? <LoadingSkeleton count={Math.min(skeletonCount, 6)} /> : null}
        </motion.div>
      )}
    </section>
  );
}
