# Requirements Document

## Introduction

FlashAI is a Next.js 14+ spaced-repetition flashcard app with Groq AI card generation, SM-2 scheduling, gamification, quiz mode, leaderboard, PDF upload, and deck sharing. The codebase currently has critical syntax errors that prevent compilation, missing database schema fields that break runtime features, and a plain/minimal visual design. This overhaul transforms the app into a polished, production-ready product with a professional cartoonistic theme (bold outlines, playful palette, comic-style UI elements, fun typography) while fixing all bugs and completing every feature end-to-end.

---

## Glossary

- **App**: The FlashAI Next.js application.
- **SM2_Engine**: The `lib/sm2.ts` module implementing the SM-2 spaced-repetition algorithm.
- **Groq_Client**: The `lib/groq.ts` module wrapping the Groq SDK.
- **Prisma_Client**: The `lib/prisma.ts` singleton and `prisma/schema.prisma` database schema.
- **Generate_API**: The `app/api/generate/route.ts` streaming endpoint.
- **Gamify_API**: The `app/api/gamify/action/route.ts` endpoint.
- **Leaderboard_API**: The `app/api/leaderboard` endpoints.
- **Bootstrap_API**: The `app/api/user/bootstrap/route.ts` endpoint.
- **Card**: A `Flashcard` record in the database.
- **Deck**: A `Deck` record containing one or more Cards.
- **User**: A `User` record storing gamification state.
- **Theme_System**: The combination of `tailwind.config.ts`, `app/globals.css`, and shared UI components that define the visual language.
- **Cartoonistic_Theme**: A visual style characterised by bold 2–3 px black outlines on interactive elements, a vibrant pastel-plus-saturated palette, rounded "bubbly" corners, playful display typography (e.g. Fredoka One or Nunito Black), subtle drop-shadow offsets, and comic-style micro-animations.
- **Navbar**: The `components/Navbar.tsx` top navigation bar.
- **PageShell**: The `components/PageShell.tsx` page wrapper.
- **DeckStudyClient**: The `components/DeckStudyClient.tsx` interactive study session component.
- **QuizClient**: The `components/QuizClient.tsx` multiple-choice quiz component.
- **LeaderboardClient**: The `components/LeaderboardClient.tsx` leaderboard display component.
- **UploadZone**: The `components/UploadZone.tsx` PDF upload and card-generation component.
- **Flashcard_Component**: The `components/Flashcard.tsx` 3-D flip card component.
- **StudyControls**: The `components/StudyControls.tsx` Hard / Good / Easy button row.
- **ConfidenceHeatmap**: The `components/ConfidenceHeatmap.tsx` card-status grid.
- **ReviewForecast**: The `components/ReviewForecast.tsx` upcoming-review summary.
- **OnboardingFlow**: The `components/OnboardingFlow.tsx` first-visit modal.
- **XP**: Experience points accumulated by the User through study actions.
- **Streak**: Consecutive days the User has studied at least one card.
- **Level**: A User tier derived from XP: Beginner (0–499 XP), Learner (500–1999 XP), Master (2000+ XP).

---

## Requirements

### Requirement 1: Fix Critical Syntax and Compilation Errors

**User Story:** As a developer, I want the codebase to compile without errors, so that the app can be built and deployed.

#### Acceptance Criteria

1. THE SM2_Engine SHALL contain syntactically valid TypeScript with no unclosed string literals, missing braces, or undefined variables (fixing the broken `if (quality === "hard"` block and missing `ease` variable in `applySm2`).
2. THE Generate_API SHALL contain syntactically valid TypeScript with no orphaned code blocks, misplaced variable references, or duplicate/conflicting stream-event logic (fixing the mangled `for await` loop and duplicate `errorCard` enqueue).
3. THE Leaderboard_API SHALL contain a complete, syntactically valid `POST /api/leaderboard/join` handler including the `joinSchema` definition, request parsing, and response (fixing the truncated file).
4. THE App SHALL contain a single `import type { Metadata }` declaration in `app/layout.tsx` (removing the duplicate import that causes a TypeScript error).
5. WHEN the command `next build` is executed, THE App SHALL complete the build with zero TypeScript compilation errors.

---

### Requirement 2: Fix Database Schema Mismatches

**User Story:** As a developer, I want the Prisma schema to match the fields used in API routes and components, so that runtime database errors do not occur.

#### Acceptance Criteria

1. THE Prisma_Client schema SHALL include `xp Int @default(0)` on the `User` model (used by `Gamify_API`, `Bootstrap_API`, and `LeaderboardClient`).
2. THE Prisma_Client schema SHALL include `streak Int @default(0)` on the `User` model (used by `Gamify_API` and `LeaderboardClient`).
3. THE Prisma_Client schema SHALL include `displayName String?` on the `User` model (used by `Leaderboard_API` and `LeaderboardClient`).
4. THE Prisma_Client schema SHALL include `lastStudiedDate DateTime?` on the `User` model (used by `Gamify_API`).
5. THE Prisma_Client schema SHALL include `updatedAt DateTime @updatedAt` on the `User` model (used by `Leaderboard_API` ordering).
6. WHEN a Prisma migration is generated and applied, THE App SHALL connect to the database and execute all queries without `PrismaClientKnownRequestError` field-not-found errors.

---

### Requirement 3: Fix SM-2 Algorithm Correctness

**User Story:** As a student, I want the spaced-repetition algorithm to correctly schedule my card reviews, so that I study at the optimal time.

#### Acceptance Criteria

1. WHEN `applySm2` is called with `quality === "hard"`, THE SM2_Engine SHALL compute `ease = Math.min(3.0, Math.max(1.3, card.ease - 0.20))` before constructing the returned card object (fixing the missing `ease` variable).
2. WHEN `applySm2` is called with any valid `StudyQuality`, THE SM2_Engine SHALL return a `Flashcard` object where `dueDate` is a valid ISO-8601 string representing a future date relative to the call time.
3. THE SM2_Engine SHALL clamp `ease` to the range [1.3, 3.0] for all quality values.
4. FOR ALL valid `Flashcard` inputs and `StudyQuality` values, THE SM2_Engine SHALL return a `Flashcard` where `interval >= 1` and `repetitions >= 0`.

---

### Requirement 4: Fix Generate API Streaming Logic

**User Story:** As a student, I want flashcard generation to stream cards correctly without duplicating error events or dropping valid cards, so that I see accurate results.

#### Acceptance Criteria

1. WHEN the Generate_API processes a streaming chunk, THE Generate_API SHALL split the buffer on newlines, parse each complete line as JSON, validate it against `generatedFlashcardSchema`, and enqueue a `{ type: "card" }` event only for valid cards.
2. IF a parsed line fails `generatedFlashcardSchema` validation, THEN THE Generate_API SHALL skip that line without enqueuing any event (removing the broken error-card enqueue that references undefined variables).
3. WHEN a duplicate card is detected (same question and answer, case-insensitive), THE Generate_API SHALL skip the duplicate without enqueuing it.
4. WHEN all chunks are processed, THE Generate_API SHALL enqueue exactly one `{ type: "done" }` event containing `deckId`, `cardsCount`, and `truncated`.
5. IF an unrecoverable error occurs during streaming, THEN THE Generate_API SHALL enqueue exactly one `{ type: "error" }` event and close the stream.

---

### Requirement 5: Complete the Leaderboard Join Feature

**User Story:** As a student, I want to join the leaderboard with a display name, so that I can compete with other learners.

#### Acceptance Criteria

1. THE Leaderboard_API `POST /api/leaderboard/join` SHALL accept a JSON body `{ userId: string, displayName: string }` where `displayName` is 2–20 alphanumeric characters (spaces allowed).
2. WHEN a valid join request is received, THE Leaderboard_API SHALL update the `User.displayName` field in the database and return `{ success: true, user: { id, displayName, xp, streak, level } }`.
3. IF the `displayName` fails validation, THEN THE Leaderboard_API SHALL return HTTP 400 with `{ error: string }`.
4. IF the `userId` does not exist, THEN THE Leaderboard_API SHALL return HTTP 404 with `{ error: "User not found." }`.
5. THE LeaderboardClient SHALL render a "Join Leaderboard" form when the current user has no `displayName`, allowing the user to submit a display name and immediately see themselves on the board.

---

### Requirement 6: Apply Cartoonistic Visual Theme — Design Tokens

**User Story:** As a user, I want the app to have a fun, polished cartoonistic look, so that studying feels engaging and enjoyable.

#### Acceptance Criteria

1. THE Theme_System SHALL define a cartoonistic color palette in `tailwind.config.ts` including: `comic-yellow: "#FFE566"`, `comic-blue: "#4FC3F7"`, `comic-green: "#69F0AE"`, `comic-red: "#FF5252"`, `comic-purple: "#CE93D8"`, `comic-orange: "#FFB74D"`, and retain existing `accent`, `coral`, `mint`, `ink`, `cream` tokens.
2. THE Theme_System SHALL define a `shadow-comic` box-shadow token: `"3px 3px 0px 0px #0a0a0f"` and a `shadow-comic-lg` token: `"5px 5px 0px 0px #0a0a0f"` for the bold-outline cartoonistic effect.
3. THE Theme_System SHALL load a playful display font (Fredoka One or Nunito with weight 900) via `next/font/google` and expose it as `--font-display` CSS variable.
4. THE App `globals.css` SHALL apply `--font-display` to `h1` and `h2` elements and set `letter-spacing: -0.01em` for display headings.
5. THE Theme_System SHALL define a `border-comic` utility class applying `border-2 border-ink` to create the bold outline effect on cards and buttons.

---

### Requirement 7: Apply Cartoonistic Visual Theme — UI Components

**User Story:** As a user, I want all interactive elements to look and feel cartoonistic, so that the app has a consistent playful identity.

#### Acceptance Criteria

1. THE `Button` component SHALL apply `shadow-comic` and `border-2 border-ink` by default, and on hover SHALL shift the element `translate(2px, 2px)` while removing the shadow (simulating a pressed comic-button effect).
2. THE `Card` component SHALL apply `border-2 border-ink` and `shadow-comic` by default, giving every card a bold outlined appearance.
3. THE Navbar SHALL display the "FlashAI" logo in the display font with a `comic-yellow` background badge and `border-2 border-ink` outline.
4. THE Navbar SHALL use pill-shaped active-link indicators with `bg-accent border-2 border-ink shadow-comic-sm` styling.
5. THE Flashcard_Component front face SHALL use a `comic-yellow` background tint and the back face SHALL use the `ink` background, both with `border-2 border-ink` outlines.
6. THE StudyControls Hard button SHALL use `comic-red` background, Good SHALL use `comic-blue`, and Easy SHALL use `comic-green`, all with `border-2 border-ink` and `shadow-comic`.
7. THE OnboardingFlow modal SHALL use a `comic-yellow` header accent strip and `border-2 border-ink` card border.

---

### Requirement 8: Apply Cartoonistic Visual Theme — Pages

**User Story:** As a user, I want every page to feel cohesive and cartoonistic, so that the visual experience is consistent throughout the app.

#### Acceptance Criteria

1. THE Home page (`app/page.tsx`) hero section SHALL display the headline in `--font-display` at `text-5xl` or larger with a `comic-yellow` underline accent on the word "smarter".
2. THE Dashboard page SHALL render each `StatCard` with a `border-2 border-ink shadow-comic` style and a distinct `comic-*` background color per stat type.
3. THE Upload page SHALL render the drag-and-drop zone with a `border-4 border-dashed border-ink` style and a large emoji illustration (📄) centered in the zone.
4. THE Deck study page SHALL display the deck title in `--font-display` with a `comic-yellow` highlight chip.
5. THE Quiz page SHALL render each answer option button with `border-2 border-ink` and on correct selection SHALL animate to `bg-comic-green`, on incorrect to `bg-comic-red`.
6. THE Leaderboard page SHALL render the top-3 entries with oversized medal emojis (🥇🥈🥉) and `shadow-comic-lg` card styling.
7. THE Share page SHALL display a "Shared Deck" banner in `comic-yellow` with `border-2 border-ink`.

---

### Requirement 9: Micro-animations and Interaction Polish

**User Story:** As a user, I want smooth, playful animations throughout the app, so that interactions feel responsive and fun.

#### Acceptance Criteria

1. WHEN a user clicks a `Button` component, THE Button SHALL animate with `whileTap: { x: 2, y: 2, boxShadow: "0px 0px 0px 0px #0a0a0f" }` to simulate a comic press.
2. WHEN a `Card` component has `hover={true}` and the user hovers over it, THE Card SHALL animate with `whileHover: { y: -4, scale: 1.01 }` and a `shadow-comic-lg` shadow.
3. WHEN the DeckStudyClient renders the "all caught up" state, THE App SHALL display a confetti burst via `canvas-confetti` automatically.
4. WHEN a user earns a level-up, THE DeckStudyClient SHALL display a full-screen overlay with the new level name in `--font-display` at `text-6xl` for 2 seconds before fading out.
5. WHEN a flashcard transitions to the next card, THE Flashcard_Component SHALL animate with a horizontal slide (`x: 60 → 0`) and opacity fade.
6. THE ProgressBar component SHALL animate the fill bar with a spring transition whenever the progress value changes.

---

### Requirement 10: Performance Improvements

**User Story:** As a developer, I want the app to load and respond quickly, so that users have a smooth experience.

#### Acceptance Criteria

1. THE Generate_API SHALL truncate extracted PDF text to 12,000 characters before sending to the Groq_Client, preventing oversized prompts and timeouts.
2. THE Groq_Client `streamFlashcardsFromText` function SHALL set `max_tokens: 4096` on the completion request to bound response size.
3. THE DeckStudyClient SHALL memoize the `dueCards` array with `useMemo` and only recompute when the `cards` array reference changes.
4. THE Dashboard page SHALL use `Promise.all` for all Prisma queries (already implemented — SHALL be preserved in any refactor).
5. THE App `layout.tsx` SHALL use `display: "swap"` for all Google Font loads to prevent render-blocking (already implemented — SHALL be preserved).
6. THE Prisma_Client `prisma/schema.prisma` SHALL retain `@@index([deckId])` and `@@index([dueDate])` on the `Flashcard` model.

---

### Requirement 11: UX Improvements — Navigation and Feedback

**User Story:** As a user, I want clear navigation and immediate feedback on my actions, so that I always know what is happening.

#### Acceptance Criteria

1. THE Navbar SHALL display the current page's label in bold and highlight the active link with the cartoonistic pill style.
2. WHEN a deck is deleted, THE DeleteDeckButton SHALL show an inline confirmation with a 2-second auto-cancel timeout if the user takes no action.
3. WHEN the ShareDeckButton copies a link, THE ShareDeckButton SHALL display a "Copied! ✓" toast for 2 seconds using a `comic-green` background badge.
4. WHEN the UploadZone is in the dragging state, THE UploadZone SHALL display a large animated "Drop it! 📄" label inside the drop zone.
5. WHEN the QuizClient finishes a quiz, THE QuizClient SHALL display the score as a large animated percentage ring (CSS or SVG) in addition to the text score.
6. THE DeckStudyClient SHALL display a keyboard shortcut legend (`Space` = flip, `1/2/3` = Hard/Good/Easy) as a persistent tooltip below the card on desktop viewports.

---

### Requirement 12: UX Improvements — Empty States and Error States

**User Story:** As a user, I want helpful empty states and clear error messages, so that I am never left confused.

#### Acceptance Criteria

1. WHEN the Dashboard has no decks, THE DeckList SHALL display an illustrated empty state with a large emoji (📚), a headline "No decks yet", and a CTA button linking to `/upload`.
2. WHEN a Prisma query fails on the Dashboard, THE Dashboard page SHALL display a styled error banner with `comic-red` background and `border-2 border-ink` rather than a plain text message.
3. WHEN the QuizClient encounters an error loading questions, THE QuizClient SHALL display a retry button that re-fetches the quiz.
4. WHEN the UploadZone encounters a generation error, THE UploadZone SHALL display the error in a `comic-red` styled banner with an icon (❌) and a "Try Again" button that resets the form.
5. IF the Groq API key is missing, THEN THE Generate_API SHALL return HTTP 503 with `{ error: "AI service is not configured." }` instead of an unhandled exception.

---

### Requirement 13: Code Quality and Correctness

**User Story:** As a developer, I want the codebase to follow consistent patterns and have no runtime type errors, so that it is maintainable and reliable.

#### Acceptance Criteria

1. THE `lib/client-user.ts` `bootstrapUser` function SHALL remove the `as any` cast and use a typed response schema validated with Zod.
2. THE `app/api/gamify/action/route.ts` SHALL use atomic Prisma `increment` operations for `points` and `xp` (already implemented — SHALL be preserved).
3. THE `app/api/generate/route.ts` SHALL declare the `lines` variable before the `for` loop that iterates over it (fixing the reference-before-declaration bug).
4. THE `app/api/leaderboard/route.ts` `GET` handler SHALL use `select` to fetch only `id`, `displayName`, `xp`, and `streak` fields (already implemented — SHALL be preserved).
5. THE `components/LeaderboardClient.tsx` SHALL identify the current user by `userId` string equality rather than XP/streak coincidence (fixing the unreliable `isCurrent` check).
6. THE `app/api/ping/route.ts` SHALL exist and return `{ ok: true }` with HTTP 200 to serve as a health-check endpoint (already exists — SHALL be preserved).
7. THE `components/DbWarmup.tsx` component SHALL call `/api/ping` on mount to warm the database connection (already exists — SHALL be preserved).
