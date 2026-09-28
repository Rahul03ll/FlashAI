"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type MarkdownExplanationProps = {
  rawText: string;
};

type Block =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullet"; title?: string; body: string }
  | { type: "step"; stepNumber: string; title?: string; body: string }
  | { type: "paragraph"; text: string };

function parseFormattedText(raw: string): Block[] {
  // Normalize inline bullet patterns that LLMs often generate on a single line
  const normalized = raw
    .replace(/\s+-\s+\*\*/g, "\n- **")
    .replace(/\s+(\d+\.)\s+\*\*/g, "\n$1 **")
    .replace(/\s+(\*\*[^*]+\?\*\*)/g, "\n\n$1\n");

  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Markdown headers ### or ##
    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
      blocks.push({
        type: "heading",
        text: line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim(),
      });
      continue;
    }

    // Numbered step: "1. **Title** - Description" or "1. Description"
    const stepMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (stepMatch) {
      const stepNumber = stepMatch[1];
      const rest = stepMatch[2];
      const titleMatch = rest.match(/^\*\*([^*]+)\*\*[:\s–—-]*(.*)$/);
      if (titleMatch) {
        blocks.push({
          type: "step",
          stepNumber,
          title: titleMatch[1].trim(),
          body: titleMatch[2].trim(),
        });
      } else {
        blocks.push({
          type: "step",
          stepNumber,
          body: rest.trim(),
        });
      }
      continue;
    }

    // Bullet item: "- **Title** - Description" or "- Description" or "• " or "* "
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[1];
      const titleMatch = content.match(/^\*\*([^*]+)\*\*[:\s–—-]*(.*)$/);
      if (titleMatch) {
        blocks.push({
          type: "bullet",
          title: titleMatch[1].trim(),
          body: titleMatch[2].trim(),
        });
      } else {
        blocks.push({
          type: "bullet",
          body: content.trim(),
        });
      }
      continue;
    }

    // Standalone bold question / title (e.g. "**Why these rules?**" or "**Title**")
    const boldStandaloneMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (boldStandaloneMatch) {
      if (i === 0) {
        blocks.push({ type: "title", text: boldStandaloneMatch[1].trim() });
      } else {
        blocks.push({ type: "heading", text: boldStandaloneMatch[1].trim() });
      }
      continue;
    }

    // Fallback paragraph
    blocks.push({ type: "paragraph", text: line });
  }

  return blocks;
}

/** Renders bold markdown tags `**word**` safely with styling */
function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const content = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-ink">
          {content}
        </strong>
      );
    }
    return part;
  });
}

export default function MarkdownExplanation({ rawText }: MarkdownExplanationProps) {
  const [copied, setCopied] = useState(false);
  const blocks = parseFormattedText(rawText);

  function handleCopy() {
    // Strip markdown formatting for clean clipboard copy
    const cleanText = rawText.replace(/\*\*/g, "").trim();
    navigator.clipboard.writeText(cleanText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="relative space-y-3 text-ink/85">
      {/* Top action row */}
      <div className="flex items-center justify-between border-b border-black/8 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent text-xs">
            ✨
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
            AI Tutor Explanation
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy explanation"
          className="flex items-center gap-1 rounded-full border border-black/10 bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-ink/60 transition-colors hover:bg-black/5 hover:text-ink"
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>

      {/* Structured Content */}
      <div className="space-y-3 leading-relaxed text-[13.5px] sm:text-sm">
        {blocks.map((block, idx) => {
          if (block.type === "title") {
            return (
              <h4 key={idx} className="font-display text-base font-bold text-ink sm:text-lg">
                {block.text}
              </h4>
            );
          }

          if (block.type === "heading") {
            return (
              <h5 key={idx} className="pt-1.5 font-semibold text-accent text-sm sm:text-[15px]">
                {block.text}
              </h5>
            );
          }

          if (block.type === "bullet") {
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-start gap-2.5 rounded-xl bg-black/[0.02] p-2.5 border border-black/5"
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent/70" />
                <div className="flex-1">
                  {block.title && (
                    <span className="font-semibold text-ink mr-1">
                      {block.title}:
                    </span>
                  )}
                  <span>{renderInlineMarkdown(block.body)}</span>
                </div>
              </motion.div>
            );
          }

          if (block.type === "step") {
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-start gap-2.5 rounded-xl bg-comic-yellow/10 p-2.5 border border-comic-yellow/30"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-comic-yellow font-bold text-[11px] text-ink border border-ink/20">
                  {block.stepNumber}
                </span>
                <div className="flex-1">
                  {block.title && (
                    <span className="font-semibold text-ink mr-1">
                      {block.title} –
                    </span>
                  )}
                  <span>{renderInlineMarkdown(block.body)}</span>
                </div>
              </motion.div>
            );
          }

          return (
            <p key={idx} className="text-ink/80 leading-relaxed">
              {renderInlineMarkdown(block.text)}
            </p>
          );
        })}
      </div>
    </div>
  );
}
