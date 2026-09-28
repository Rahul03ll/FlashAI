# ⚡ FlashAI — AI-Powered Spaced-Repetition Study Engine

[![Live Demo](https://img.shields.io/badge/Vercel-Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://flash-ai-topaz.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Groq](https://img.shields.io/badge/Groq-LPU_Fast_Inference-f55036?style=for-the-badge)](https://groq.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **Upload a PDF → get 15–20 exam-quality flashcards in seconds → let SM-2 keep them in your head for good.**
>
> 🔗 **Live Deployment**: [https://flash-ai-topaz.vercel.app/](https://flash-ai-topaz.vercel.app/)

---

## Table of Contents
1. [What It Does](#what-it-does)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Process Thinking & Technical Tradeoffs](#process-thinking--technical-tradeoffs)
5. [Feature Deep-Dives](#feature-deep-dives)
6. [Delight Features](#delight-features)
7. [Security Model](#security-model)
8. [Deployment Guide](#deployment-guide)
9. [What Was Tried, What Broke](#what-was-tried-what-broke)
10. [Author & Contact](#author--contact)

---

## What It Does

FlashAI solves the "PDF graveyard" problem — students download lecture slides and notes, never review them, and cram unsuccessfully before exams. FlashAI's real-time pipeline transforms passive reading into active recall:

```
PDF upload → text extraction (pdf-parse) → Groq LLM streaming (NDJSON)
  → 5 card cognitive types (definition / reasoning / misconception / example / edge case)
  → SuperMemo SM-2 spaced repetition scheduling
  → Gamification (XP, streaks, leaderboard)
  → Interactive Quiz mode with AI-generated distractors
```

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+
- **Groq API Key**: Free tier available at [console.groq.com](https://console.groq.com)
- **PostgreSQL Database**: Free tier available on [Neon](https://neon.tech), [Supabase](https://supabase.com), or local Postgres

### 2. Installation & Setup

```bash
# 1. Clone the repository and enter the directory
git clone https://github.com/Rahul03ll/FlashAI.git
cd FlashAI

# 2. Install dependencies (runs prisma generate via postinstall)
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

Edit `.env.local` with your database credentials and API key:
```env
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/flashai?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:password@ep-xyz.neon.tech/flashai?sslmode=require"
GROQ_API_KEY="gsk_..."
```

### 3. Initialize Database & Run

```bash
# Push database schema
npx prisma db push

# Start the local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│   Browser (Next.js App Router — React Server Components)│
│                                                         │
│   app/page.tsx          → Hero + CardStackPreview       │
│   app/upload/page.tsx   → UploadZone (streaming SSE)    │
│   app/dashboard/page.tsx→ Stats, DeckList (+ search)    │
│   app/deck/[id]/page.tsx→ DeckStudyClient (SM-2 UI)     │
│   app/quiz/[id]/page.tsx→ QuizClient (MC questions)     │
│   app/leaderboard/page  → LeaderboardClient             │
│   app/share/[token]     → Read-only shared deck view    │
└───────────────────────────┬─────────────────────────────┘
                            │ fetch / NDJSON streaming
┌───────────────────────────▼─────────────────────────────┐
│   Next.js API Routes (Node.js — server only)            │
│                                                         │
│   POST /api/generate     → PDF → Groq → NDJSON stream   │
│   POST /api/demo-deck    → seed 10 sample cards         │
│   GET/DELETE /api/deck/[id]                             │
│   POST /api/deck/[id]/share                             │
│   PATCH /api/card/[id]   → persist SM-2 state           │
│   POST /api/gamify/action→ atomic XP/streak update      │
│   GET  /api/leaderboard                                 │
│   POST /api/explain      → Groq single-turn explain     │
│   POST /api/quiz/[id]    → Groq distractor generation   │
└───────────────────────────┬─────────────────────────────┘
                            │ Prisma ORM
┌───────────────────────────▼─────────────────────────────┐
│   Database: PostgreSQL (Neon / Supabase / Render)       │
│   Models: User · Deck · Flashcard                       │
└─────────────────────────────────────────────────────────┘
```

---

## Process Thinking & Technical Tradeoffs

### Why SM-2 (not a neural scheduler)?

SM-2 was chosen over modern alternatives (FSRS, Anki's v3) for three reasons:
1. **Interpretability** — students can understand *why* a card is due; "your ease factor dropped" provides meaningful feedback.
2. **No training data required** — FSRS requires per-user history to converge; new users get poor schedules for weeks.
3. **Simplicity** — the entire algorithm is self-contained in 30 lines of TypeScript with zero third-party dependencies.

**Tradeoff accepted:** SM-2 over-schedules easy cards and under-schedules hard ones compared to FSRS. For a study tool used over days and weeks leading to exams, this bias favors retention.

**SM-2 quality differentiation:** Standard SM-2 uses quality ratings 0–5. We map our intuitive 3-button study UI:
- `easy` (q=5) → ease +0.10 (reward confident recall)
- `good` (q=4) → ease ±0.00 (correct with hesitation — SM-2 canonical formula delta ≈ 0)
- `hard` (q=2) → ease −0.20, interval resets to 1 day

### Why Groq LPU Inference (not GPT-4)?

- **Speed:** Groq's custom LPU inference delivers extreme token throughput vs ~50 tok/s on conventional cloud endpoints — streaming starts in <1s.
- **Cost:** Free tier is sufficient for demo, classroom, and portfolio evaluation.
- **Resilience:** Built-in multi-model fallback cascade across active high-capacity models (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`).
- **Tradeoff accepted:** Context window is bounded. We cap extracted PDF text at 12,000 characters to prevent latency spikes while capturing core lecture sections.

### Why NDJSON streaming (not JSON array)?

The alternative was to wait for all 20 cards to be generated before responding (~8–12s). NDJSON lets us flush each card as it's generated — the first card appears in ~1s, creating a "live generation" feel that significantly increases perceived responsiveness.

**What broke:** The initial prototype used SSE (`data:` prefix). Parsing SSE in the browser while also handling intermittent connection resets was brittle. Switching to raw NDJSON lines (one JSON object per line) simplified both server emission and client consumption via a standard `for await` reader stream.

### Why anonymous userId via localStorage?

Authentication (Clerk, NextAuth, Supabase Auth) adds onboarding friction for a portfolio evaluation. The localStorage `flashai_user_id` gives each browser session a stable identity without login barriers. The security implication is acknowledged: client IDs can be manipulated. For a multi-tenant production environment, NextAuth with Google/GitHub OAuth can be layered on top.

---

## Feature Deep-Dives

### Ingestion Quality (5 Cognitive Card Types)

The Groq generation prompt enforces a structured distribution across 5 cognitive levels:
- **≥3 Definition cards**: Core terminology and foundational concepts.
- **≥3 Reasoning ("why/how") cards**: Causal chains and systemic mechanisms.
- **≥3 Misconception cards**: Common exam pitfalls, explicitly disproving wrong assumptions.
- **≥3 Example cards**: Step-by-step worked solutions.
- **≥2 Edge-case cards**: Boundary conditions and failure modes.

The prompt includes **few-shot examples per type** to anchor output depth and prevent shallow single-line answers.

### SM-2 Adaptive Scheduling

Cards are queried ordered by `dueDate ASC`. The client filters cards where `dueDate ≤ now`. Following user interaction, the updated intervals are persisted via `PATCH /api/card/:id`. A `difficultyScore` counter dynamically highlights struggling concepts on the **Confidence Heatmap** in red.

### Deck Search & Filtering

The `DeckList` component provides instant, in-memory search filtering across deck titles and source PDF filenames. Matching terms are highlighted with custom styled `<mark>` elements.

### Quiz Mode

For each flashcard, Groq dynamically generates 3 plausible wrong answers (distractors). If any individual card's distractor generation fails, a fallback distractor set guarantees the quiz session remains uninterrupted.

---

## Delight Features

| Feature | Implementation |
|---|---|
| **Live Card Streaming** | NDJSON streaming — first card visible in ~1s |
| **Card Flip Animation** | CSS `transform-style: preserve-3d` + Framer Motion `rotateY` |
| **Swipe to Answer** | Framer Motion `drag="x"` with velocity + offset thresholds |
| **XP Level Progress** | Animated `motion.div` width tracks progress toward Learner/Master tiers |
| **Streak Tracker** | Daily rollover calculated via `lastActiveDay` comparison |
| **Floating Card Stack** | Infinite CSS keyframe `translateY` with staggered delay |
| **Search Highlighting** | Inline `<mark>` wrapping around search query substring |
| **Celebratory Confetti**| `canvas-confetti` triggered upon deck review completion |
| **Leaderboard Medals** | Dynamic 🥇🥈🥉 badges for top rankings |

---

## Security Model

| Concern | Status | Mechanism |
|---|---|---|
| `GROQ_API_KEY` exposure | ✅ Secure | Strictly server-side in `lib/groq.ts`; never prefixed with `NEXT_PUBLIC_` |
| `DATABASE_URL` exposure | ✅ Secure | Restricted to server-side Prisma client queries |
| Direct client AI calls | ✅ Secure | All AI queries routed through protected Next.js API endpoints |
| SQL Injection | ✅ Secure | Prisma ORM parameterizes all SQL queries |
| File Upload Abuse | ✅ Secure | MIME-type validation (`application/pdf`) + 10MB payload cap returns HTTP 413 |
| User impersonation | ⚠️ By Design | Anonymous session keys in localStorage; easily upgradable to NextAuth |

---

## Deployment Guide

### Vercel + Neon (Recommended)

1. **Database Setup**:
   - Provision a PostgreSQL database on [Neon](https://neon.tech).
   - Copy the pooled and unpooled connection strings.

2. **Deploy to Vercel**:
   - Push repository to GitHub.
   - Import the project into the [Vercel Dashboard](https://vercel.com).
   - Add environment variables:
     - `DATABASE_URL`: Your pooled PostgreSQL connection string.
     - `DATABASE_URL_UNPOOLED`: Your direct PostgreSQL connection string.
     - `GROQ_API_KEY`: Your Groq API key (`gsk_...`).

3. **Deploy & Migrate**:
   - Vercel automatically runs `prisma generate && next build`.
   - Run `npx prisma migrate deploy` (or `npx prisma db push`) against the Neon instance.

---

## What Was Tried, What Broke

| What Was Tried | What Happened | How It Was Fixed |
|---|---|---|
| `llama3-70b-8192` model | Groq returned 503 (model deprecated) | Upgraded to `llama-3.3-70b-versatile` |
| `llama-3.3-70b-versatile` model | Groq returned 404 (model deprecated/decommissioned) | Upgraded to `openai/gpt-oss-120b` with multi-model fallback cascade |
| LLM markdown stream formatting | Trailing backslashes (`\`) and fences broke line-by-line JSON.parse | Added `sanitizeJsonLine` stream preprocessor and error propagation |
| SSE streaming for cards | Fragile event parsing; couldn't distinguish stream close from error | Switched to raw NDJSON lines; connection close signals completion |
| `motion.button` 3D card | `transform` flattened 3D perspective, making both faces visible | Shifted perspective and rotation to parent `motion.div` |
| SQLite for cloud deploy | Serverless environments (Vercel) have ephemeral filesystems | Configured PostgreSQL (Neon) with connection pooling |
| Snapshot-based XP update | Rapid successive clicks caused lost-update race conditions | Switched to Prisma atomic updates: `{ increment: n }` |
| `window.setTimeout` in Quiz | Broke during Next.js server-side rendering (SSR) | Used global `setTimeout` compatible with Node and browser |
| Unbounded SM-2 ease growth | Cards scheduled years away after repeated easy answers | Capped ease at 3.0 (practical upper boundary) |

---

## Author & Contact

**Rahul Roy**  
*Final-Year B.Tech CSE @ KIIT University | SDE & Data/AI Engineer*  
- 🌐 **Portfolio / GitHub**: [@Rahul03ll](https://github.com/Rahul03ll)
- 🔗 **LinkedIn**: [linkedin.com/in/rahul-roy-362a12256](https://linkedin.com/in/rahul-roy-362a12256)
- 📧 **Email**: [rahulroy2259@gmail.com](mailto:rahulroy2259@gmail.com)

---

⭐ If you find FlashAI helpful, consider starring the repository on [GitHub](https://github.com/Rahul03ll/FlashAI)!
