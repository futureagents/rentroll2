# scripts/seed — RentRoll demo data

A deterministic demo dataset for RentRoll: one Pune landlord, 2 properties, 14 units (12 occupied, 2 vacant), with overdue and part-paid rent, maintenance in every state, expiring agreements, a notice, a settled move-out and missing-photo cases. Every date is computed from the day you run it, so the dashboard always looks "live".

The design, the scenario catalogue and the open schema questions are in [SPEC.md](SPEC.md).

## Status

| File | What it does | State |
|---|---|---|
| `data.mjs` | The authored dataset, with dates as offsets from the run date | done |
| `build.mjs` | Resolves the data for a run date and prints JSON, plus `expected` (what each screen should show) | done |
| `check.mjs` | Asserts every scenario holds for every run date in a range | done |
| `load.mjs` | Writes the dataset into the database | **TODO**: blocked on the schema, refuses to run |
| `lib/dates.mjs` | Calendar-date helpers (UTC-safe; "today" in Asia/Kolkata) | done |

Nothing here touches a database yet.

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
- When `load.mjs` is written, it must refuse to run against anything but a demo or local database (SPEC.md §9).
