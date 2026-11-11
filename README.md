# Smart Campus Room Availability Checker

Checks whether a campus room is free for a requested time window, using fictional
room and booking data. It only reports availability — it never creates or confirms
a booking.

## Tech stack
React + Vite + TypeScript. Tests run on Vitest.

## Run it
`package.json` lives at the repository root. From there:

```sh
npm install
npm run dev
```

## Check it
```sh
npm test          # unit tests (Vitest)
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # production build
```

## Source layout
- `src/App.tsx` — main UI: room finder, time inputs, availability result, timeline.
- `src/availability.ts` — pure availability rules (time range, duration, overlap, blocked).
- `src/filters.ts` — pure room filters by capacity and equipment.
- `src/data/rooms.ts` — fictional, read-only room catalog and bookings.
- `src/App.test.ts` — tests for the App component.
- `src/rooms.tests.ts` — tests for availability and filter logic.
- `src/dependencies.test.ts` — regression test: no database dependency.
- `src/main.tsx` — React entry point.
- `src/index.css` — global styles (Tailwind).

## Note
Rules for AI agents are in AGENTS.md.
