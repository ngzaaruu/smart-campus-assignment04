# AGENTS.md

## Project
Smart Campus room availability checker; fictional data only.
Stack: React + Vite + TypeScript, tests with Vitest.

## Structure
- src/data/rooms.ts: fictional room catalog (read-only fixture data)
- src/availability.ts: pure availability rules (AC1–AC5) and TIME_LIMITS
- src/filters.ts: pure room filters (F1 capacity, F2 equipment)
- src/App.tsx: UI (Timeline chart, App page) and a legacy three-argument
  checkAvailability wrapper bound to room b-204, kept for existing consumers
- src/App.test.ts: regression tests for the legacy wrapper (AC1–AC5)
- src/rooms.tests.ts: regression tests for availability, filters, and AC5

## Acceptance criteria
- AC1: start/end within [startMin–startMax]/[endMin–endMax]; start strictly
  later than NOW; start earlier than end.
- AC2: booking length <= maxDuration (exactly maxDuration is allowed).
- AC3: a blocked room is always unavailable.
- AC4: overlapping an existing booking is unavailable; touching endpoints are
  not overlap.
- AC5: rules only read the room; nothing is created, changed, or mutated.
- AC6: availability feedback is clear and the layout is usable on desktop and
  mobile.

## Constraints
- Fictional data only; no backend, no login, no database, no booking creation.
- No secrets, API keys, or environment variables.
- No external deployments or publishing; the dist/ folder is a build artifact,
  not a shipping target.
- Do not change the UI appearance or the fixture values in TIME_LIMITS
  (now, dayMinutes, startMin, startMax, endMin, endMax, maxDuration) or the
  room data in src/data/rooms.ts.

## Engineering rules
- Prefer pure functions and minimal changes; use at most 2 justified patterns.
- Do not mutate booking fixtures; keep responsive UI feedback (desktop and mobile).
- Do not fix unrelated problems; change only what the current task asks.

## Commands
- Run all commands from the repository root.
- Tests: npm test
- Type check: npm run typecheck
- Lint: npm run lint

## Verification
- Run npm test, npm run typecheck, and npm run lint before proposing acceptance.
- All three must pass; do not propose acceptance on a failing run.
- A human must approve every change before it is applied or merged.
- Add focused regression tests for any behavioral change.
- Do not weaken or delete existing assertions.
- Report changed files, rationale, and test evidence.
