# Implementation Plan: FlashAI Cartoonistic App Overhaul

## Overview

Fix all compilation errors and runtime bugs first (tasks 1–5), then apply the cartoonistic theme system and UI components (tasks 6–8), add micro-animations and polish (tasks 9–11), improve code quality (task 12), write property-based tests (task 13), and finalise deployment configuration (task 14). Each task builds on the previous ones; no task leaves orphaned code.

## Tasks

- [x] 1. Fix critical syntax and compilation errors
  - [x] 1.1 Fix `lib/sm2.ts` — close the broken `if (quality === "hard"` string literal, declare the `ease` variable before the returned object, and ensure the hard-branch `return` statement is syntactically complete
    - The unclosed string `"hard` and missing `ease` variable cause a TypeScript parse error that blocks the entire build
    - _Requirements: 1.1, 3.1_

  - [x] 1.2 Fix `app/api/generate/route.ts` — add the missing `const lines = buffer.split("\n");` declaration before the `for` loop, remove the orphaned `errorCard` enqueue block and the duplicate/conflicting stream-event logic inside the `for await` loop
    - The `lines` variable is used before declaration; the `errorCard` block references undefined variables and enqueues invalid events
    - _Requirements: 1.2, 4.1, 4.2, 13.3_

  - [x] 1.3 Fix `app/api/leaderboard/join/route.ts` — add the missing `const joinSchema = z.object({...})` declaration, wrap the handler body in `export async function POST(request: Request) { ... }`, and complete the truncated `status: 400` response
    - The file is truncated mid-expression; the schema constant and function wrapper are absent
    - _Requirements: 1.3, 5.1, 5.3_

  - [x] 1.4 Fix `app/layout.tsx` — remove the duplicate `import type { Metadata } from "next"` declaration (keep the first one at the top of the file)
    - Duplicate named imports cause a TypeScript error
    - _Requirements: 1.4_

  - [x] 1.5 Verify the build compiles — run `next build` (or `tsc --noEmit`) and confirm zero TypeScript errors
    - All four fixes above must be in place before this check
    - _Requirements: 1.5_

- [x] 2. Fix database schema and run migration
  - [x] 2.1 Add the five missing fields to the `User` model in `prisma/schema.prisma`: `xp Int @default(0)`, `streak Int @default(0)`, `displayName String?`, `lastStudiedDate DateTime?`, `updatedAt DateTime @updatedAt`
    - These fields are already referenced in `Gamify_API`, `Bootstrap_API`, `Leaderboard_API`, and `LeaderboardClient` but absent from the schema
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Generate and apply the Prisma migration: `prisma migrate dev --name add_user_gamification_fields`
    - All new fields have safe defaults so the migration is non-destructive
    - Preserve `@@index([deckId])` and `@@index([dueDate])` on `Flashcard`
    - _Requirements: 2.6, 10.6_

  - [x] 2.3 Update `app/api/user/bootstrap/route.ts` to return `displayName` in the response object (alongside the existing `id`, `name`, `points`, `xp`, `streak`, `level`)
    - `LeaderboardClient` and `DeckStudyClient` both read `displayName` from the bootstrap response
    - _Requirements: 2.3, 5.5_

- [x] 3. Fix SM-2 algorithm correctness
  - [x] 3.1 In `lib/sm2.ts`, inside the `quality === "hard"` branch, add `const ease = Math.min(3.0, Math.max(1.3, card.ease - 0.20));` before the `return` statement so the returned object can reference `ease`
    - This is the root cause of the syntax error identified in task 1.1; the fix must be applied there
    - _Requirements: 3.1, 3.3_

  - [ ]* 3.2 Write property tests for SM-2 in `lib/__tests__/sm2.property.test.ts` using fast-check
    - **Property 1: SM-2 ease clamping invariant** — for any valid `Flashcard` and any `StudyQuality`, `result.ease` must be in `[1.3, 3.0]`
    - **Validates: Requirements 3.1, 3.3**
    - **Property 2: SM-2 dueDate is always a future ISO-8601 string** — `result.dueDate` must parse to a date ≥ call time
    - **Validates: Requirements 3.2**
    - **Property 3: SM-2 interval and repetitions are always non-negative** — `result.interval >= 1` and `result.repetitions >= 0`
    - **Validates: Requirements 3.4**
    - Use `fc.record` to generate arbitrary `Flashcard` inputs; `fc.constantFrom("easy","good","hard")` for quality
    - Tag each test: `// Feature: cartoonistic-app-overhaul, Property {N}: ...`
    - `{ numRuns: 100 }` for all assertions

  - [ ]* 3.3 Write unit tests for SM-2 in `lib/__tests__/sm2.test.ts`
    - Hard resets `interval` to 1 and decreases `ease` by 0.20 (clamped)
    - Easy increments `repetitions` and increases `ease` by 0.10
    - Good keeps `ease` unchanged
    - `makeInitialSm2Card` returns `ease: 2.5`, `interval: 1`, `repetitions: 0`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Fix Generate API streaming logic
  - [x] 4.1 In `app/api/generate/route.ts`, inside the `for await` loop, add `const lines = buffer.split("\n");` immediately after `buffer += delta;`, then set `buffer = lines.pop() ?? "";` — this is the missing declaration from task 1.2
    - _Requirements: 4.1, 13.3_

  - [x] 4.2 Replace the broken `errorCard` / duplicate-enqueue block with a clean `if (!validated.success) continue;` guard so invalid lines are silently skipped
    - _Requirements: 4.2_

  - [x] 4.3 Ensure the deduplication check (`cards.some(...)`) runs only after `validated.success` is confirmed and before `cards.push(validated.data)`
    - _Requirements: 4.3_

  - [x] 4.4 Confirm exactly one `{ type: "done" }` event is enqueued after the loop and exactly one `{ type: "error" }` event is enqueued (and the stream closed) on any unrecoverable error — no `done` after `error`
    - _Requirements: 4.4, 4.5_

  - [x] 4.5 Add `max_tokens: 4096` to the `groq.chat.completions.create` call in `lib/groq.ts` and truncate extracted PDF text to `text.slice(0, 12000)` in `app/api/generate/route.ts` before passing to `streamFlashcardsFromText`
    - _Requirements: 10.1, 10.2_

  - [ ]* 4.6 Write property tests for the Generate API buffer parser in `app/api/__tests__/generate.property.test.ts`
    - **Property 4: Buffer parser emits only schema-valid cards** — extract the NDJSON parsing logic into a pure `parseNdjsonBuffer(buffer: string)` helper; for any arbitrary NDJSON buffer the helper must emit only lines that pass `generatedFlashcardSchema.safeParse`
    - **Validates: Requirements 4.1, 4.2**
    - **Property 5: Deduplication** — extract `deduplicateCards(cards)` helper; for any card array with duplicates the output must contain each `(question, answer)` pair at most once (case-insensitive)
    - **Validates: Requirements 4.3**
    - **Property 7: PDF text truncation** — for any string of arbitrary length, `text.slice(0, 12000).length <= 12000`
    - **Validates: Requirements 10.1**

  - [ ]* 4.7 Write unit tests for the Generate API in `app/api/__tests__/generate.test.ts`
    - Missing `GROQ_API_KEY` returns HTTP 503 with `{ error: "AI service is not configured." }`
    - Exactly one `done` event emitted on success
    - Exactly one `error` event emitted on failure, stream closed immediately after
    - _Requirements: 4.4, 4.5, 12.5_

- [x] 5. Complete the Leaderboard join feature
  - [x] 5.1 In `app/api/leaderboard/join/route.ts`, write the complete file: define `joinSchema` with `userId: z.string().min(1)` and `displayName: z.string().min(2).max(20).regex(/^[a-zA-Z0-9\s]+$/)`, implement `export async function POST(request: Request)` that parses the body, returns 400 on validation failure, 404 if user not found, and on success calls `prisma.user.update({ data: { displayName } })` and returns `{ success: true, user: { id, displayName, xp, streak, level } }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 In `components/LeaderboardClient.tsx`, fix the `isCurrent` check to use `user.id === currentUser.id` instead of XP/streak coincidence
    - _Requirements: 5.5, 13.5_

  - [x] 5.3 In `components/LeaderboardClient.tsx`, render a "Join Leaderboard" form (name input + submit button) when `currentUser.displayName === null`; on submit call `POST /api/leaderboard/join` and refresh the leaderboard list
    - _Requirements: 5.5_

  - [ ]* 5.4 Write property tests for leaderboard join validation in `app/api/__tests__/leaderboard.property.test.ts`
    - **Property 6: displayName validation** — for any string `s`, `joinSchema.safeParse` must accept `s` iff `/^[a-zA-Z0-9\s]{2,20}$/.test(s)`
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 5.5 Write unit tests for the leaderboard join endpoint in `app/api/__tests__/leaderboard.test.ts`
    - Valid join returns 200 with `{ success: true, user: { id, displayName, xp, streak, level } }`
    - Invalid `displayName` returns 400
    - Unknown `userId` returns 404
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Checkpoint — ensure all tests pass and the build is green
  - Run `tsc --noEmit` and confirm zero errors
  - Run `prisma validate` and confirm schema is valid
  - Ensure all tests pass; ask the user if questions arise

- [x] 7. Apply cartoonistic theme system — design tokens and fonts
  - [x] 7.1 In `tailwind.config.ts`, add the six new comic color tokens (`comic-yellow`, `comic-blue`, `comic-green`, `comic-red`, `comic-purple`, `comic-orange`) to `theme.extend.colors`, and add `comic`, `comic-lg`, and `comic-sm` box-shadow tokens to `theme.extend.boxShadow`
    - Retain all existing tokens (`cream`, `ink`, `accent`, `coral`, `mint`, `warn`, `danger`, `soft`, `hard`, `hard-sm`, `hard-accent`)
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 In `app/layout.tsx`, replace the `Syne` font import with `Fredoka_One` from `next/font/google` (weight `"400"`, variable `--font-display`, `display: "swap"`); keep `Inter` as `--font-body`; apply both variables to `<body>`
    - _Requirements: 6.3, 10.5_

  - [x] 7.3 In `app/globals.css`, update `h1` and `h2` to use `var(--font-display)` (replacing `var(--font-heading)`), set `letter-spacing: -0.01em` on both, and add the `.border-comic { border: 2px solid #0a0a0f; }` utility class
    - Remove all references to `--font-heading` since `Syne` is replaced
    - _Requirements: 6.4, 6.5_

- [x] 8. Apply cartoonistic theme to UI components
  - [x] 8.1 Update `components/ui/Button.tsx` — add `"comic-yellow" | "comic-blue" | "comic-green" | "comic-red"` to the `Variant` type; add their `variantClasses` entries; change the base `className` to include `border-2 border-ink shadow-comic`; update `whileTap` to `{ x: 2, y: 2, boxShadow: "0px 0px 0px 0px #0a0a0f" }`
    - _Requirements: 7.1, 9.1_

  - [x] 8.2 Update `components/ui/Card.tsx` — add `"comic"` to `CardVariant`; set `comic` variant classes to `border-2 border-ink shadow-comic bg-white rounded-2xl`; update `whileHover` (when `hover=true`) to `{ y: -4, scale: 1.01, boxShadow: "5px 5px 0px 0px #0a0a0f" }`; change the `default` variant to include `border-2 border-ink shadow-comic`
    - _Requirements: 7.2, 9.2_

  - [x] 8.3 Update `components/Navbar.tsx` — wrap the "FlashAI" logo text in a `<span>` with `font-display bg-comic-yellow border-2 border-ink rounded-full px-2 py-0.5`; update active link classes to `bg-accent border-2 border-ink shadow-comic-sm rounded-full`
    - _Requirements: 7.3, 7.4, 11.1_

  - [x] 8.4 Update `components/Flashcard.tsx` — change the front face background to `bg-comic-yellow/20 border-2 border-ink`; keep the back face as `bg-ink border-2 border-ink`; update the card-stack decorative layers to use `border-2 border-ink/30`; update the slide transition to `initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}`
    - _Requirements: 7.5, 9.5_

  - [x] 8.5 Update `components/StudyControls.tsx` — change Hard button variant to `"comic-red"`, Good to `"comic-blue"`, Easy to `"comic-green"` (these new variants are added in task 8.1)
    - _Requirements: 7.6_

  - [x] 8.6 Update `components/OnboardingFlow.tsx` — add a `bg-comic-yellow border-b-2 border-ink` header accent strip spanning the full modal width above the "Onboarding" label; add `border-2 border-ink shadow-comic-lg` to the modal card
    - _Requirements: 7.7_

- [x] 9. Apply cartoonistic theme to all pages
  - [x] 9.1 Update `app/page.tsx` — wrap the word "smarter" in the hero `h1` with a relative `<span>` containing a `bg-comic-yellow` underline accent layer (`absolute bottom-1 left-0 right-0 h-3 -z-10 rounded`); apply `font-display` class to the `h1`; update CTA `Link` elements to use `Button` component with `border-2 border-ink shadow-comic`
    - _Requirements: 8.1_

  - [x] 9.2 Update `app/dashboard/page.tsx` `StatCard` — add `border-2 border-ink shadow-comic` to each card; apply distinct `comic-*` background tints per stat (Total Decks → `bg-comic-purple/20`, Total Cards → `bg-comic-blue/20`, Due Today → `bg-comic-red/20`, Mastered → `bg-comic-green/20`); update the `dbUnavailable` error banner to `bg-comic-red/10 border-2 border-comic-red`
    - _Requirements: 8.2, 12.2_

  - [x] 9.3 Update `components/DeckList.tsx` empty state — add a large 📚 emoji, change the headline to use `font-display`, and add a `Button` CTA linking to `/upload`
    - _Requirements: 8.2, 12.1_

  - [x] 9.4 Update `components/UploadZone.tsx` — change the drop zone border to `border-4 border-dashed border-ink`; add a centered 📄 at `text-6xl` inside the zone; add an `AnimatePresence` block that shows a `motion.p` with `"Drop it! 📄"` in `font-display animate-wiggle` when `isDragging`; replace the error `<p>` with a `bg-comic-red/10 border-2 border-comic-red` banner containing a ❌ icon and a "Try Again" `Button` that resets `file`, `previewCards`, and `statusText`
    - _Requirements: 8.3, 12.4_

  - [x] 9.5 Update `app/deck/[id]/page.tsx` — display the deck title in `font-display` with a `bg-comic-yellow border-2 border-ink rounded-full px-3 py-1` highlight chip; add a keyboard shortcut legend `<div className="hidden sm:flex ...">Space = flip · 1 = Hard · 2 = Good · 3 = Easy</div>` below the `DeckStudyClient`
    - _Requirements: 8.4, 11.6_

  - [x] 9.6 Update `components/QuizClient.tsx` — add `border-2 border-ink` to each answer option button base class; animate correct selection to `bg-comic-green border-comic-green` and incorrect to `bg-comic-red border-comic-red` using Framer Motion `animate` on the button; add an SVG score ring on the completion screen (a `<circle>` with `stroke-dasharray` and `stroke-dashoffset` animated via `motion.circle` from 0 to the percentage value); add a retry button in the error state that re-calls `loadQuiz()`
    - _Requirements: 8.5, 11.5, 12.3_

  - [x] 9.7 Update `app/leaderboard/page.tsx` and `components/LeaderboardClient.tsx` — render top-3 entries with oversized medal emojis at `text-3xl` and `shadow-comic-lg border-2 border-ink` card styling; apply `bg-comic-yellow/20` tint to rank #1; update the error state to a `comic-red` styled banner
    - _Requirements: 8.6_

  - [x] 9.8 Update `app/share/[token]/page.tsx` — add a "Shared Deck" banner with `bg-comic-yellow border-2 border-ink rounded-2xl px-4 py-2 font-display text-xl` above the card grid
    - _Requirements: 8.7_

- [x] 10. Add micro-animations and interaction polish
  - [x] 10.1 In `components/DeckStudyClient.tsx`, add a level-up full-screen overlay: when `data.levelUp === true` set a `showLevelUp` state to `true` and auto-clear after 2 seconds; render via `AnimatePresence` a `motion.div` (`fixed inset-0 z-50 flex items-center justify-center bg-ink/70`) containing the level name in `font-display text-6xl text-comic-yellow`
    - _Requirements: 9.4_

  - [x] 10.2 In `components/DeckStudyClient.tsx`, ensure the "all caught up" state triggers `confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })` via `canvas-confetti` (the `useEffect` watching `dueCards.length === 0 && cards.length > 0` already exists — verify it calls `confetti` directly, not just sets `showConfetti`)
    - _Requirements: 9.3_

  - [x] 10.3 In `components/ProgressBar.tsx`, confirm the `motion.div` fill bar uses `transition={{ type: "spring", stiffness: 180, damping: 25 }}` and `animate={{ width: \`${percent}%\` }}` — update if the spring parameters differ
    - _Requirements: 9.6_

  - [x] 10.4 Update `components/DeleteDeckButton.tsx` — add a 2-second `setTimeout` in the confirming state that calls `setConfirming(false)` if the user takes no action; add `border-2 border-ink` to the confirmation button row
    - _Requirements: 11.2_

  - [x] 10.5 Update `components/ShareDeckButton.tsx` — change the "Copied!" status span to a `bg-comic-green border-2 border-ink` badge pill with "Copied! ✓" text; auto-clear after 2 seconds
    - _Requirements: 11.3_

- [x] 11. Performance and UX improvements
  - [x] 11.1 In `components/DeckStudyClient.tsx`, verify `dueCards` is computed with `useMemo(() => cards.filter(isDue), [cards])` — it already is; confirm `handleStudy` and `awardPoints` are wrapped in `useCallback` — they already are; preserve both in any refactor
    - _Requirements: 10.3_

  - [x] 11.2 In `app/dashboard/page.tsx`, confirm all Prisma queries run inside `Promise.all` in `getDashboardData` — they already do; preserve this pattern in any refactor
    - _Requirements: 10.4_

  - [x] 11.3 In `app/layout.tsx`, confirm both font loads use `display: "swap"` — they already do; preserve after the `Syne → Fredoka_One` swap in task 7.2
    - _Requirements: 10.5_

- [x] 12. Code quality fixes
  - [x] 12.1 In `lib/client-user.ts`, remove the `as any` cast in `bootstrapUser`; define a `bootstrapResponseSchema` using Zod (`z.object({ user: z.object({ id, displayName, xp, streak, level, points }) })`); parse the response with `bootstrapResponseSchema.safeParse(data)` and throw on failure; return the typed user object
    - _Requirements: 13.1_

  - [x] 12.2 In `components/LeaderboardClient.tsx`, update the `UserData` type to include `points: number`; update `bootstrapUser` call site to read `user.points` (already returned by bootstrap after task 2.3)
    - _Requirements: 13.1_

  - [x] 12.3 In `app/api/gamify/action/route.ts`, confirm atomic `increment` operations are used for `points` and `xp` — they already are; preserve in any refactor
    - _Requirements: 13.2_

  - [x] 12.4 In `app/api/leaderboard/route.ts`, confirm the `GET` handler uses `select` to fetch only `id`, `displayName`, `xp`, `streak` — it already does; add `streak` to the mapped response object (currently missing from the `users.map` output)
    - _Requirements: 13.4_

  - [x] 12.5 Confirm `app/api/ping/route.ts` returns `{ ok: true }` with HTTP 200 and `components/DbWarmup.tsx` calls `/api/ping` on mount — both already exist; preserve in any refactor
    - _Requirements: 13.6, 13.7_

- [x] 13. Write property-based tests (fast-check)
  - [x] 13.1 Install `fast-check` as a dev dependency and configure a test runner (Jest or Vitest) if not already present; add a `"test"` script to `package.json`
    - fast-check is TypeScript-native and requires no extra setup beyond installation

  - [ ]* 13.2 Ensure all property tests from tasks 3.2, 4.6, and 5.4 are complete and passing
    - P1–P3 in `lib/__tests__/sm2.property.test.ts`
    - P4, P5, P7 in `app/api/__tests__/generate.property.test.ts`
    - P6 in `app/api/__tests__/leaderboard.property.test.ts`
    - Each tagged `// Feature: cartoonistic-app-overhaul, Property {N}: ...`
    - `{ numRuns: 100 }` for all assertions

  - [ ]* 13.3 Ensure all unit tests from tasks 3.3, 4.7, and 5.5 are complete and passing
    - `lib/__tests__/sm2.test.ts`
    - `app/api/__tests__/generate.test.ts`
    - `app/api/__tests__/leaderboard.test.ts`

- [x] 14. Checkpoint — full test suite and build verification
  - Run all tests and confirm they pass; ask the user if questions arise
  - Run `tsc --noEmit` and confirm zero TypeScript errors
  - Run `prisma validate` and confirm schema is valid

- [x] 15. Deployment configuration (Vercel + PostgreSQL)
  - [x] 15.1 Update `prisma/schema.prisma` datasource to use `provider = env("DATABASE_PROVIDER")` so the same schema works with `sqlite` locally and `postgresql` on Vercel
    - _Requirements: (deployment)_

  - [x] 15.2 Update the `"build"` script in `package.json` to `"prisma generate && prisma migrate deploy && next build"` so migrations run automatically on Vercel
    - _Requirements: (deployment)_

  - [x] 15.3 Confirm `vercel.json` has the correct `maxDuration` and `memory` settings for `generate`, `quiz`, and `explain` routes — it already does; preserve in any refactor
    - _Requirements: (deployment)_

  - [x] 15.4 Add a `.env.example` entry for `DATABASE_PROVIDER` (value `sqlite`) alongside the existing `DATABASE_URL` and `GROQ_API_KEY` entries so developers know to set it
    - _Requirements: (deployment)_

- [x] 16. Final checkpoint — production readiness
  - Run `next build` end-to-end and confirm it exits 0
  - Confirm all Tailwind comic tokens appear in the generated CSS
  - Ensure all tests pass; ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 6, 14, 16) ensure incremental validation
- Property tests validate universal correctness properties (SM-2 scheduling, streaming parser, deduplication, displayName validation, text truncation)
- Unit tests validate specific examples and edge cases
- The `fast-check` library must be installed before running property tests (task 13.1)
- For Vercel deployment, set `DATABASE_PROVIDER=postgresql` and `DATABASE_URL` (pooled Postgres connection string) as environment variables in the Vercel dashboard
