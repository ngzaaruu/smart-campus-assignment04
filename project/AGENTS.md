# AGENTS.md

## Project
Smart Campus room availability checker; one room, fictional data.
Stack: React + Vite + TypeScript, tests with Vitest.

## Structure
- src/App.tsx: UI (Timeline chart, App page) and, before refactoring, the booking rule checkAvailability
- src/App.test.ts: regression tests for AC1–AC6

## Constraints
Preserve AC1–AC6; no backend, login or booking creation.
Do not change the UI appearance or the fixture values (NOW, EXISTING_BOOKINGS, MAX_DURATION).

## Engineering rules
Prefer pure functions and minimal changes; use at most 2 justified patterns.
Do not mutate booking fixtures; keep responsive UI feedback (desktop and mobile).
Do not fix unrelated problems; change only what the current task asks.

## Commands
Run tests: npm test

## Verification
Run existing tests and add focused regression tests.
Do not weaken or delete existing assertions.
Report changed files, rationale and test evidence.