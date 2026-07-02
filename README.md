# Client Meeting Calendar & Smart Follow-Up Tool

A clean, visual calendar/CRM-lite that records client meetings (by voice or by hand),
**learns how often you normally meet each client, and automatically adjusts** the
reminder rhythm as that pattern changes — so nobody gets forgotten and nobody gets
over-contacted.

No logins, no accounts — it's a single shared workspace. A client is essentially just
a name plus its meeting history.

## What it does

- **Record meetings** — record audio in the app (with live transcription in the
  browser), or upload a file, or just type notes. Optionally get an AI summary and
  action points.
- **Learns each client's rhythm** — from the gaps between meetings it works out the
  normal interval (weekly, monthly, every 2 months…) and shows a confidence level.
- **Adapts automatically** — if a monthly client starts being seen every two months,
  the suggested interval drifts toward the new pattern instead of flipping on a single
  late meeting.
- **Tells you who's due** — every client gets a live state: on track / due soon /
  due today / overdue, with a suggested next-meeting date.
- **Visual month calendar** — past meetings (green), scheduled visits (blue) and
  suggested follow-ups (amber/red) colour-coded at a glance.
- **Dashboard** — overdue, due-soon, rhythm changes, recent activity, upcoming visits.
- **Manual overrides** — pin a client to a fixed interval, a specific next date, or
  pause reminders entirely.

## Tech

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + SQLite (zero-config local DB; switch to Postgres by changing one line)
- The smart-interval engine is plain, testable TypeScript (`src/lib/interval.ts`)

## Run it

Requirements: Node 18+ (you have Node 24).

```bash
npm install        # installs deps and generates the Prisma client
npm run setup      # creates the SQLite DB and seeds sample clients/meetings
npm run dev        # start the app
```

Then open http://localhost:3000

> Already set up during the build, so you can usually just run `npm run dev`.

### Reset the sample data

```bash
npm run db:reset   # wipes and re-seeds the database
```

## Optional AI features

Everything works without any keys. To switch on the smarter bits, copy `.env.example`
to `.env` (one already exists) and fill in:

- `ANTHROPIC_API_KEY` — AI meeting summaries & action-point extraction.
- `OPENAI_API_KEY` — server-side transcription of *uploaded* audio (Whisper).
  Live in-app recording transcribes for free in the browser and needs no key.

Tuning knobs (also in `.env`):

- `DEFAULT_INTERVAL_DAYS` (default 30) — interval used before there's enough history.
- `DUE_SOON_LEAD_DAYS` (default 7) — how early a client is flagged "due soon".

## How the interval learning works (the short version)

1. Take the day-gaps between a client's completed meetings.
2. Keep the most recent ~5 gaps and drop any obvious freak gap.
3. Weighted-average them so the **most recent** gaps count most.
4. Round to a friendly label (Weekly / Monthly / Every 2 months …).
5. Suggested next date = last meeting + that interval.

Because it's recomputed from history every time (not a stored running number),
editing or deleting a meeting always gives a correct, reproducible result.

## Project layout

```
prisma/schema.prisma     data model (Client, Meeting)
prisma/seed.ts           sample data
src/lib/interval.ts      the smart-interval engine (pure, testable)
src/lib/reminders.ts     schedule + reminder-state logic
src/lib/clients.ts       data access → derived ClientDTOs
src/lib/ai.ts            Anthropic summary + optional Whisper transcription
src/app/(app)/           dashboard, calendar, clients, record pages
src/app/api/             REST endpoints
src/components/          UI (Calendar, RecordMeetingForm, ClientCard, …)
```

## Notes

- This lives in a OneDrive folder. `node_modules` and the database are git-ignored,
  but OneDrive may still try to sync `node_modules` (lots of small files). If sync
  gets slow, consider excluding the `node_modules` folder from OneDrive, or moving
  the project outside OneDrive.
- Audio recordings are stored locally in `./uploads` (git-ignored) and streamed back
  through an API route, so the raw folder is never publicly served.
- Always start recordings deliberately and get consent — the app shows a reminder.
