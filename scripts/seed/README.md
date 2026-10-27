# scripts/seed — RentRoll demo data

A deterministic demo dataset for RentRoll: one Pune landlord, one building (Kulkarni Apartments, Kothrud) with 5 units, 4 let and 1 vacant. Three months of rent with a paid, a part-paid, an overdue and a paid-late tenant; maintenance in every state; an agreement ending in 22 days; a settled move-out; a missing-photo case. Every date is computed from the day you run it, so the dashboard always looks "live".

```sh
npm run seed:demo   # loads it into the Supabase project .env.local points at, prints the sign-in
```

The design, the scenario catalogue and the open schema questions are in [SPEC.md](SPEC.md).

## Status

| File | What it does | State |
|---|---|---|
| `data.mjs` | The authored dataset, with dates as offsets from the run date | done |
| `build.mjs` | Resolves the data for a run date and prints JSON, plus `expected` (what each screen should show) | done |
| `check.mjs` | Asserts every scenario holds for every run date in a range | done |
| `load.mjs` | Writes the dataset into the hosted database (`npm run seed:demo`) | done |
| `lib/dates.mjs` | Calendar-date helpers (UTC-safe; "today" in Asia/Kolkata) | done |

`load.mjs` is idempotent. It finds the demo landlord only by its email, deletes that one auth user (which cascades the landlord, its rows and its number sequence) and its storage folder, then recreates everything. No other user, row or file is touched. It reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`; the password is `DEMO_LANDLORD_PASSWORD` if set, otherwise one is generated and printed for that run. Files are placeholder PNGs and one-page PDFs.

Not seeded: meters and readings, and vacant-unit listings. The schema has no table for either, and product.md §4/§16 rules listings out of the product.

## Use

Requires Node 18 or later. There are no dependencies.

```sh
# Full resolved dataset for today (Asia/Kolkata)
node scripts/seed/build.mjs > /tmp/rentroll-demo.json

# For a fixed date (handy for screenshots and tests)
node scripts/seed/build.mjs --date 2026-10-18

# Only what each screen should show: L-03 cards and Needs attention, L-04, L-06, L-12, L-13
node scripts/seed/build.mjs --date 2026-10-18 --summary

# Prove the scenarios hold whatever day it is run
node scripts/seed/check.mjs                                # today + 800 days
node scripts/seed/check.mjs --from 2026-01-01 --days 1200
```

## Editing the data

- Dates in `data.mjs` are offsets: `{ days: -18 }`, `{ days: -1, at: '21:40' }`, `{ monthsAgo: 1, day: 12 }`. Never write a calendar date.
- A scenario tenancy's `dueDay: { days: -N }` pins its unpaid row to exactly N days overdue (SPEC.md §3).
- After any change, run `check.mjs`. If you change a scenario on purpose, update its assertion and the catalogue in SPEC.md.

## Safety

- The phone numbers (`+91 90000 00xxx`) are made up but may reach real people. Never open WhatsApp or call from demo data.
- Emails are `example.com` / `.example`. The UPI handle `@okdemo` is not a real bank, so payment links built from it will not work.
- `load.mjs` only ever deletes the auth user whose email is the demo landlord's (`@example.com`). It runs against whichever project `.env.local` names.
