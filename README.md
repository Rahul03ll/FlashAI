# ⚡ FlashAI — AI-Powered Spaced-Repetition Study Engine

> Upload a PDF → get 15–20 exam-quality flashcards in seconds → let SM-2 keep them in your head for good.

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

---

## What It Does

FlashAI solves the "PDF graveyard" problem — students download notes, never review them, and forget everything before exams. The pipeline:

```
PDF upload → text extraction (pdf-parse) → Groq LLM streaming
  → 5 card types (definition / reasoning / misconception / example / edge)
  → SM-2 spaced repetition scheduling
  → Gamification (XP, streaks, leaderboard)
  → Quiz mode with AI-generated distractors
```

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd Brain
npm install          # also runs `prisma generate` via postinstall

# 2. Environment
cp .env.example .env.local
# Edit .env.local: set GROQ_API_KEY (free at console.groq.com)
# DATABASE_URL defaults to SQLite — no extra setup needed locally

# 3. Database
npx prisma migrate dev --name init

# 4. Run
npm run dev          # → http://localhost:3000
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (Next.js App Router — React Server Components) │
│                                                     │
│  app/page.tsx          → Hero + CardStackPreview    │
│  app/upload/page.tsx   → UploadZone (streaming SSE) │
│  app/dashboard/page.tsx→ Stats, DeckList (+ search) │
│  app/deck/[id]/page.tsx→ DeckStudyClient (SM-2 UI)  │
│  app/quiz/[id]/page.tsx→ QuizClient (MC questions)  │
│  app/leaderboard/page  → LeaderboardClient          │
│  app/share/[token]     → Read-only shared deck view │
└───────────────────┬─────────────────────────────────┘
                    │ fetch / streaming
┌───────────────────▼─────────────────────────────────┐
│  Next.js API Routes (Node.js — server only)         │
│                                                     │
│  POST /api/generate     → PDF → Groq → NDJSON stream│
│  POST /api/demo-deck    → seed 10 sample cards      │
│  GET/DELETE /api/deck/[id]                          │
│  POST /api/deck/[id]/share                          │
│  PATCH /api/card/[id]   → persist SM-2 state        │
│  POST /api/gamify/action→ atomic XP/streak update   │
│  GET  /api/leaderboard                              │
│  POST /api/explain      → Groq single-turn explain  │
│  POST /api/quiz/[id]    → Groq distractor generation│
└───────────────────┬─────────────────────────────────┘
                    │ Prisma ORM
┌───────────────────▼─────────────────────────────────┐
│  Database: SQLite (dev) / PostgreSQL (prod)          │
│  Models: User · Deck · Flashcard                    │
└─────────────────────────────────────────────────────┘
```

---

## Process Thinking & Technical Tradeoffs

### Why SM-2 (not a neural scheduler)?

SM-2 was chosen over modern alternatives (FSRS, Anki's v3) for three reasons:
1. **Interpretability** — students can understand *why* a card is due; "your ease factor dropped" is meaningful feedback.
2. **No training data** — FSRS requires per-user history to converge; new users get bad schedules for weeks.
3. **Simplicity** — the entire algorithm is 30 lines of TypeScript with zero dependencies.

**Tradeoff accepted:** SM-2 over-schedules easy cards and under-schedules hard ones compared to FSRS. For a tool used over days/weeks (not months) this is acceptable.

**SM-2 quality differentiation:** Standard SM-2 uses quality ratings 0–5. We map our 3-button UI to three quality levels:
- `easy` (q=5) → ease +0.10 (reward confident recall)
- `good` (q=4) → ease ±0.00 (correct with hesitation — SM-2 canonical formula gives delta ≈ 0)
- `hard` (q=2) → ease −0.20, interval resets to 1 day

### Why Groq + llama-3.3-70b-versatile (not GPT-4)?

- **Speed:** Groq's LPU inference delivers ~500 tok/s vs ~50 tok/s on OpenAI — streaming starts in <1s.
- **Cost:** Free tier is sufficient for demo/evaluation use.
- **Tradeoff accepted:** Context window (128k) is smaller than GPT-4 Turbo (1M). We cap PDF text at 12,000 chars to stay well within limits.

### Why NDJSON streaming (not JSON array)?

The alternative was to wait for all 20 cards to be generated before responding (~8–12s). NDJSON lets us flush each card as it's generated — the first card appears in ~1s, creating a "live generation" feel that tests showed significantly increases perceived responsiveness.

**What broke:** The first implementation used SSE (`data:` prefix). Parsing SSE in the browser while also handling errors proved brittle. Switching to raw NDJSON lines (one JSON object per line) simplified both server and client to a `for await` loop.

### Why SQLite locally / PostgreSQL in production?

SQLite requires zero installation, zero network latency, and zero cost for local development. The Prisma schema has a single-line provider switch (`"sqlite"` → `"postgresql"`) for production. This keeps the contributor experience friction-free while giving production the scalability and connection pooling of Postgres.

### Why anonymous userId via localStorage (no auth)?

Auth (Clerk, NextAuth, Supabase Auth) adds significant surface area for a demo evaluation. The localStorage `flashai_user_id` gives each browser session a stable identity without login friction. The security implication is acknowledged: any user can impersonate any userId by sending it in a POST body. For a production v2, we would add NextAuth with GitHub/Google sign-in.

---

## Feature Deep-Dives

### Ingestion Quality (5 Card Types)

The Groq prompt enforces a **minimum distribution**:
- ≥3 definition cards
- ≥3 reasoning ("why/how") cards
- ≥3 misconception cards (name the wrong belief, then correct it)
- ≥3 example cards (step-by-step worked examples)
- ≥2 edge-case cards (boundary conditions, failure modes)

The prompt also includes **one few-shot example per type** to anchor the model's output format and quality level. Without few-shot examples, the model tends to write shallow one-liner answers.

### SM-2 Scheduling

Cards are sorted by `dueDate ASC` in the database query. The client further filters to only cards where `dueDate ≤ now`. After each answer, the SM-2 result is persisted via `PATCH /api/card/:id`. The `difficultyScore` field increments on hard answers and decrements on correct answers — used by the ConfidenceHeatmap to color struggling cards red.

### Deck Search

The DeckList component is a client component with a controlled `<input type="search">` that filters by title and source PDF filename in-memory using `useMemo`. Matching text is highlighted with a `<mark>` element styled with the design system's `warn/30` amber tone.

### Quiz Mode

For each card, the API calls Groq to generate 3 plausible wrong answers (distractors). If any individual card's distractor generation fails, a fallback array of generic distractors is used so the overall quiz never breaks. The correct answer is randomly inserted among the distractors.

---

## Delight Features

| Feature | Implementation |
|---|---|
| Live card generation | NDJSON streaming — first card visible in ~1s |
| Card flip animation | CSS `transform-style: preserve-3d` + Framer Motion `rotateY` |
| Swipe to answer | Framer Motion `drag="x"` with velocity + offset threshold |
| XP level progress bar | Animated `motion.div` width tracks % toward Learner/Master |
| Streak counter | Resets daily via `lastActiveDay` date comparison |
| Floating card stack | Infinite CSS keyframe `translateY` with staggered delay |
| Search highlight | Inline `<mark>` wrapping around matched substring |
| Confetti | `canvas-confetti` fires on session completion |
| Leaderboard medals | 🥇🥈🥉 emoji for top-3 positions |

---

## Security Model

| Concern | Status |
|---|---|
| `GROQ_API_KEY` exposed to browser | ✅ Never — no `NEXT_PUBLIC_` prefix; only imported in server-side `lib/groq.ts` |
| `DATABASE_URL` exposed | ✅ Never — server-only Prisma import |
| AI calls from client | ✅ Never — all Groq calls go through API routes |
| SQL injection | ✅ Prisma parameterizes all queries |
| File upload abuse | ✅ MIME-type check (`application/pdf`) + 10 MB size guard returns 413 |
| userId spoofing | ⚠️ By design — no auth system. Production would add NextAuth. |
| Rate limiting | ⚠️ Not implemented. Production would add Upstash Redis rate limiting. |

---

## Deployment Guide

### Vercel + Neon (recommended — both free tier)

```bash
# 1. Create a Neon database at https://neon.tech
#    Copy the connection string (it looks like:
#    postgresql://user:pass@ep-xxx.neon.tech/braindb?sslmode=require)

# 2. Update prisma/schema.prisma:
#    provider = "postgresql"

# 3. Run migrations against Neon
DATABASE_URL="<neon-url>" npx prisma migrate deploy

# 4. Push to GitHub, import project in Vercel dashboard
#    Set environment variables:
#      DATABASE_URL  = <neon-url>
#      GROQ_API_KEY  = gsk_...

# 5. Build command (auto-detected from package.json):
#    prisma generate && next build
```

`vercel.json` is included to set `maxDuration=60` and `memory=1024` for the PDF generation route, which would otherwise time out on Vercel's default 10s serverless limit.

---

## What Was Tried, What Broke

| What was tried | What happened | How it was fixed |
|---|---|---|
| `llama3-70b-8192` model | Groq returned 503 (model deprecated) | Migrated to `llama-3.3-70b-versatile` |
| SSE streaming for card generation | Parsing `data:` prefix was fragile; browser couldn't distinguish end-of-stream from network error | Switched to raw NDJSON — one JSON per line, connection close = done |
| `motion.button` wrapping the 3D flip card | `transform` on a button element flattened the 3D context — the card appeared to flip but both faces were visible | Moved perspective and rotation to `motion.div`; kept button for accessibility |
| PostgreSQL for local dev | Required external service setup, breaking first-run experience | SQLite for local dev, PostgreSQL for production (single schema line change) |
| Snapshot-based XP update (`xp: existing + gained`) | Race condition under rapid clicks lost points | Switched to Prisma atomic `{ increment: n }` |
| `window.setTimeout` in QuizClient | `window` not available in SSR environments | Removed `window.` prefix — `setTimeout` is a global in Node.js too |
| SM-2 ease factor unbounded growth | Cards due every 3 years after 50 easy ratings | Capped ease at 3.0 (≈ max useful interval multiplier) |

---

