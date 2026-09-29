# ⚡ FlashAI — AI-Powered Spaced-Repetition Study Engine

[![Live Demo](https://img.shields.io/badge/Vercel-Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://flash-ai-topaz.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Groq](https://img.shields.io/badge/Groq-LPU_Fast_Inference-f55036?style=for-the-badge)](https://groq.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tests](https://img.shields.io/badge/Tests-244%20Passing-brightgreen?style=for-the-badge&logo=vitest&logoColor=white)](tests/)
[![Multi-User](https://img.shields.io/badge/Multi--User-Production_Ready-blueviolet?style=for-the-badge)](#hybrid-authentication--cross-device-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **Upload a PDF → get 15–20 exam-quality flashcards in seconds → let SM-2 keep them in your head for good.**
>
> 🔗 **Live Deployment**: [https://flash-ai-topaz.vercel.app/](https://flash-ai-topaz.vercel.app/)

---

## Table of Contents
1. [What It Does](#what-it-does)
2. [Multi-User & Live Community Features](#multi-user--live-community-features)
3. [Architecture](#architecture)
4. [Process Thinking & Technical Tradeoffs](#process-thinking--technical-tradeoffs)
5. [Feature Deep-Dives](#feature-deep-dives)
6. [Delight Features](#delight-features)
7. [Security & Anti-Abuse Model](#security--anti-abuse-model)
8. [Testing & Quality Assurance (244 Tests)](#testing--quality-assurance-244-tests)
9. [Quick Start & Local Development](#quick-start--local-development)
10. [Deployment Guide](#deployment-guide)
11. [What Was Tried, What Broke](#what-was-tried-what-broke)
12. [Author & Contact](#author--contact)

---

## What It Does

FlashAI solves the "PDF graveyard" problem — students download lecture slides and notes, never review them, and cram unsuccessfully before exams. FlashAI's real-time pipeline transforms passive reading into active recall:

```
PDF upload → text extraction (pdf-parse) → Groq LLM streaming (NDJSON)
  → 5 card cognitive types (definition / reasoning / misconception / example / edge case)
  → SuperMemo SM-2 spaced repetition scheduling (per-user isolated memory state)
  → Gamification (XP, streaks, dynamic leaderboard with podium)
  → Interactive Quiz mode with AI-generated distractors & explanation tutor
  → Community Library with 1-click deck cloning, deck upvotes & real-time presence
```

---

## Multi-User & Live Community Features

FlashAI is architected for real-world multi-learner collaboration and concurrent live usage:

- **⚡ Hybrid User Authentication:** Instant guest learning with zero friction. Users can link an email via a 6-digit OTP code (`AuthDrawer.tsx`) to persist their study decks, streaks, and XP across any browser or device.
- **🌐 Community Deck Library:** Toggle decks between `🔒 Private` and `🌐 Public Community`. Discover decks created by other learners, search public study materials, and upvote quality decks.
- **📥 1-Click Deck Cloning:** Deep-clone any public or shared deck into a personal collection with fresh initial SM-2 intervals (`ease: 2.5, interval: 1, repetitions: 0, dueDate: now`), ensuring independent spaced repetition tracking.
- **🟢 Live Presence Heartbeat:** Real-time learner count indicator in the navbar (`🟢 X learners online`) powered by a 45-second sliding-window heartbeat engine.
- **🛡️ Intelligent Rate Limiting & Concurrency Queueing:** Sliding-window rate limiters with HTTP 429 `Retry-After` headers and an in-memory concurrency queue that protects Groq API quotas during peak usage.
- **🔥 Live Community Activity Ticker:** Animated real-time dashboard banner streaming recent public deck contributions, streak milestones, and XP achievements.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│         Browser (Next.js 15 App Router — React 19 + Framer Motion)      │
│                                                                        │
│   app/page.tsx           → Hero + CardStackPreview                     │
│   app/upload/page.tsx    → UploadZone (streaming NDJSON + privacy flag)│
│   app/dashboard/page.tsx → Stats, CommunityTicker, DeckList (My/Public)│
│   app/deck/[id]/page.tsx → DeckStudyClient (SM-2 review engine)        │
│   app/quiz/[id]/page.tsx → QuizClient (MC questions + explain tutor)   │
│   app/leaderboard/page   → Top-3 podium + live active learner rankings │
│   app/share/[token]      → Shared deck view + 1-Click Clone & Study    │
│   components/Navbar      → Links, UserProfilePill, LivePresenceBadge   │
│   components/AuthDrawer  → 6-digit email OTP linking & session sync    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ fetch / NDJSON streaming
┌───────────────────────────────────▼────────────────────────────────────┐
│               Next.js API Layer (Node.js 20+ Runtime)                  │
│                                                                        │
│   [Authentication & Identity]                                          │
│   POST /api/auth/send-code      → CSPRNG OTP generation & email limit  │
│   POST /api/auth/verify-code    → OTP verify, brute lockout & merge    │
│   GET  /api/auth/me             → Session validation & user profile    │
│   POST /api/auth/logout         → Session cookie clearance             │
│   GET  /api/user/bootstrap      → Instant guest session assignment     │
│                                                                        │
│   [AI Generation & Tutor]                                              │
│   POST /api/generate            → Sliding-window rate limit + PDF stream│
│   POST /api/explain             → In-memory AI Concurrency Queue buffer│
│   POST /api/quiz/[id]           → Groq distractor generation           │
│   POST /api/demo-deck           → Seed sample spaced repetition deck   │
│                                                                        │
│   [Decks & Community]                                                  │
│   POST /api/deck/[id]/clone     → 1-click clone with reset SM-2 state  │
│   PATCH/api/deck/[id]/privacy   → Toggle Private / Public Community   │
│   POST /api/deck/[id]/upvote    → Toggle community deck upvote         │
│   POST /api/deck/[id]/share     → Generate public shareable link       │
│   GET  /api/presence            → Active learner heartbeat counter     │
│   GET  /api/community/activity  → Real-time social activity feed       │
│                                                                        │
│   [Spaced Repetition & Gamification]                                   │
│   PATCH /api/card/[id]          → Persist SM-2 interval & ease factor  │
│   POST  /api/gamify/action      → Atomic XP increment & streak rollover│
│   GET   /api/leaderboard        → Global rankings with active filtering│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Prisma 6.6 ORM
┌───────────────────────────────────▼────────────────────────────────────┐
│              Database: PostgreSQL (Neon / Supabase / Render)           │
│   Tables: User · VerificationCode · Deck · Flashcard                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Process Thinking & Technical Tradeoffs

### 1. Hybrid Authentication vs Forced Login
- **Decision:** Start every learner as an instant guest via a persistent cookie (`flashai_user_id`), with an optional one-click email OTP linking modal (`AuthDrawer.tsx`).
- **Why:** Eliminates the drop-off associated with sign-up forms while allowing users to save their flashcards and review intervals across phones, laptops, and multiple browsers.
- **Safety:** OTP codes are cryptographically generated (6 digits), expire in 10 minutes, enforce rate limits (max 3 requests per 10m), and trigger a 5-attempt brute-force lockout.

### 2. Spaced Repetition (SM-2) Concurrency Isolation
- **Decision:** When a deck is cloned from the Community Library or a shared link, all cards are deep-copied into the user's private library with default SM-2 values (`ease: 2.5, interval: 1, repetitions: 0, dueDate: now`).
- **Why:** Spaced repetition is personal. If two students study the same deck, their memory retention curves differ. Sharing card review records directly would cause one user's correct answers to alter another user's review schedule. Cloned isolation guarantees complete memory schedule integrity.

### 3. Sliding-Window Rate Limiting & In-Memory Concurrency Queue
- **Decision:** Built a custom sliding-window rate limiter (`lib/rate-limit.ts`) and AI concurrency buffer (`lib/ai-queue.ts`).
- **Why:** Groq Cloud APIs have RPM and TPM burst thresholds. When a class of students uploads PDFs simultaneously, unmetered requests cause 429 cascades. The queue buffers heavy LLM inference tasks while emitting standard `X-RateLimit-*` and `Retry-After` headers.

### 4. NDJSON Streaming vs SSE
- **Decision:** Raw NDJSON lines (one JSON object per line) parsed via a standard `ReadableStream` reader.
- **Why:** Standard Server-Sent Events (`data:` prefixes) add parsing overhead and are difficult to distinguish from abnormal connection resets. NDJSON allows instant progressive rendering of cards as the LLM generates them.

---

## Feature Deep-Dives

### Ingestion Quality (5 Cognitive Card Types)
The generation prompt enforces a structured distribution across 5 cognitive levels:
- **≥3 Definition cards**: Core terminology and foundational concepts.
- **≥3 Reasoning ("why/how") cards**: Causal chains and systemic mechanisms.
- **≥3 Misconception cards**: Common exam pitfalls, explicitly disproving wrong assumptions.
- **≥3 Example cards**: Step-by-step worked solutions.
- **≥2 Edge-case cards**: Boundary conditions and failure modes.

### SM-2 Adaptive Scheduling
Cards are queried ordered by `dueDate ASC`. Following user review, intervals update dynamically:
- `easy` (q=5) → ease +0.10 (reward confident recall)
- `good` (q=4) → ease ±0.00 (correct with hesitation)
- `hard` (q=2) → ease −0.20, interval resets to 1 day

### Leaderboard with Podium
- Top 3 students receive prominent gold, silver, and bronze podium cards with celebratory animations.
- Filtered to actively engaged learners (`xp > 0` or customized study handle).
- Syncs seamlessly between local guest profiles and verified accounts.

---

## Delight Features

| Feature | Implementation |
|---|---|
| **Live Presence Pulse** | Animated emerald pulse badge (`🟢 X learners online`) in navbar |
| **Card Flip Animation** | CSS `transform-style: preserve-3d` + Framer Motion `rotateY` |
| **Swipe to Answer** | Framer Motion `drag="x"` with velocity + offset thresholds |
| **Live Card Streaming** | NDJSON streaming — first card visible in ~1s |
| **Community Upvoting** | Interactive animated heart toggle with live upvote counts |
| **Deck Cloning** | 1-Click "📥 Clone to My Decks" importing cards with clean SM-2 schedules |
| **XP Level Progress** | Animated `motion.div` bar tracking progress toward Learner/Master tiers |
| **Streak Tracker** | Daily rollover calculated via `lastActiveDay` comparison |
| **Celebratory Confetti**| `canvas-confetti` explosion upon completing daily deck reviews |
| **Search Highlighting** | Inline `<mark>` wrapping around search query substring |

---

## Security & Anti-Abuse Model

| Threat / Concern | Mitigation Strategy |
|---|---|
| **Groq API Key Exposure** | Server-side only (`lib/groq.ts`); strictly excluded from client bundles. |
| **AI Request Flooding** | Sliding-window limiter on `/api/generate` and `/api/explain` with HTTP 429 `Retry-After`. |
| **AI Concurrency Spikes** | In-memory Promise FIFO queue (`lib/ai-queue.ts`) buffering simultaneous LLM calls. |
| **OTP Spam / Abuse** | Strict limit of 3 verification codes per 10 minutes per email address. |
| **OTP Brute-Forcing** | Codes automatically invalidated after 5 failed attempts; cryptographic CSPRNG randomness. |
| **Cross-Learner Data Leakage**| Decks scoped by `userId`; cloned decks maintain independent SM-2 review state. |
| **SQL Injection** | Prisma ORM parameterizes all queries and migrations. |
| **Malicious File Uploads** | Strict MIME-type checking (`application/pdf`) and 10MB file size ceiling. |

---

## Testing & Quality Assurance (244 Tests)

FlashAI features an exhaustive 4-tier testing matrix with **244 automated Vitest tests** across 36 test files, covering:

```bash
npm test
```

```
 ✓ tests/empirical/multi-device-sync.test.ts (16 tests)
 ✓ tests/adversarial/auth-stress.test.ts (28 tests)
 ✓ tests/e2e/tier1-features/feature01-guest-onboarding.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature02-email-otp.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature03-cross-device-sync.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature04-rate-limiting.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature05-retry-headers.test.ts (5 tests)
 ✓ tests/e2e/tier1-features/feature06-ai-queue.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature07-presence-heartbeat.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature08-community-upvoting.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature09-community-bookmarking.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature10-deck-cloning.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature11-sm2-isolation.test.ts (5 tests)
 ✓ tests/e2e/tier1-features/feature12-atomic-review.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature13-offline-queue.test.ts (6 tests)
 ✓ tests/e2e/tier1-features/feature14-error-boundaries.test.ts (5 tests)
 ✓ tests/e2e/tier2-boundaries/* (70 tests across 14 boundary suites)
 ✓ tests/e2e/tier3-combinations/* (15 cross-feature tests)
 ✓ tests/e2e/tier4-scenarios/* (Multi-user concurrency & load simulations)
 ✓ lib/__tests__/auth.test.ts (13 tests)
 ✓ lib/__tests__/sm2.property.test.ts (7 tests)
 ✓ app/api/__tests__/leaderboard.property.test.ts (5 tests)
 ✓ app/api/__tests__/generate.property.test.ts (4 tests)

 Test Files  36 passed (36)
      Tests  244 passed (244)
   Pass Rate 100%
```

Type safety check:
```bash
npx tsc --noEmit   # Exits with 0 errors
```

---

## Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+
- **Groq API Key**: Free at [console.groq.com](https://console.groq.com)
- **PostgreSQL Database**: Free on [Neon](https://neon.tech), [Supabase](https://supabase.com), or local Postgres

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Rahul03ll/FlashAI.git
cd FlashAI

# Install dependencies (auto-runs prisma generate)
npm install

# Setup environment variables
cp .env.example .env.local
```

### 3. Configure `.env.local`
```env
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/flashai?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:password@ep-xyz.neon.tech/flashai?sslmode=require"
GROQ_API_KEY="gsk_..."
GROQ_MODEL="openai/gpt-oss-120b"
```

### 4. Migrate & Run
```bash
# Apply Prisma migrations
npx prisma migrate deploy

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Deployment Guide

### Vercel + Neon (Production)

1. **Database:** Create a Postgres database on [Neon](https://neon.tech) and copy the pooled (`DATABASE_URL`) and direct (`DATABASE_URL_UNPOOLED`) strings.
2. **Repository:** Push your changes to GitHub.
3. **Vercel Setup:**
   - Import the repository in [Vercel](https://vercel.com).
   - Configure Environment Variables:
     - `DATABASE_URL`
     - `DATABASE_URL_UNPOOLED`
     - `GROQ_API_KEY`
     - `GROQ_MODEL` (optional, defaults to `openai/gpt-oss-120b`)
4. **Build Script:**
   The `package.json` build command automatically handles everything:
   ```json
   "build": "prisma generate && prisma migrate deploy && next build"
   ```

---

## What Was Tried, What Broke

| Challenge | What Happened | Engineering Resolution |
|---|---|---|
| **Deprecated Groq Models** | `llama3-70b-8192` returned 503; `llama-3.3-70b` returned 404 | Implemented resilient cascade prioritizing `openai/gpt-oss-120b` with automated model fallbacks. |
| **Stream JSON Parse Errors** | LLM markdown fences and trailing escapes broke line parsing | Developed `sanitizeJsonLine` stream preprocessor with error handling. |
| **Multi-User SM-2 Overwrites**| Shared cards overwrote SM-2 intervals when multiple users reviewed | Created independent deck cloning (`/api/deck/[id]/clone`) and isolated per-user flashcard records. |
| **Single-User Deck Privacy** | All decks appeared globally on the dashboard | Added `userId` and `isPublic` schema fields; built tabbed "My Decks" vs "Community Library" UI. |
| **Traffic Burst Overloads** | Concurrent PDF uploads caused Groq rate limit spikes | Engineered sliding-window rate limiting (`lib/rate-limit.ts`) and concurrency queue (`lib/ai-queue.ts`). |
| **Guest Data Loss** | Clearing cookies erased study history | Built `AuthDrawer.tsx` with email OTP linking to merge guest decks into permanent synced profiles. |

---

## Author & Contact

**Rahul Roy**  
*Final-Year B.Tech CSE @ KIIT University | SDE & Data/AI Engineer*  
- 🌐 **Portfolio / GitHub**: [@Rahul03ll](https://github.com/Rahul03ll)
- 🔗 **LinkedIn**: [linkedin.com/in/rahul-roy-362a12256](https://linkedin.com/in/rahul-roy-362a12256)
- 📧 **Email**: [rahulroy2259@gmail.com](mailto:rahulroy2259@gmail.com)

---

⭐ If you find FlashAI helpful, consider starring the repository on [GitHub](https://github.com/Rahul03ll/FlashAI)!
