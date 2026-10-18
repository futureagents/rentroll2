# RentRoll

Next.js (App Router) + TypeScript + Tailwind + Supabase.

## Setup

```sh
cp .env.example .env.local   # fill in values; .env.local is gitignored
npm install
npm run dev
```

## Scripts

| Script                    | What it does                                   |
| ------------------------- | ---------------------------------------------- |
| `npm run dev`             | development server                             |
| `npm run build`           | production build                               |
| `npm run typecheck`       | `next typegen` + `tsc --noEmit`                |
| `npm run lint`            | ESLint + import-boundary check                 |
| `npm run lint:boundaries` | import-boundary check only                     |
| `npm run test`            | Vitest                                         |
| `npm run verify`          | typecheck, lint and test together              |

## Structure

```
src/app/(landlord)/        landlord routes
src/app/(tenant)/u/[token] tenant routes (token-scoped, structurally separate)
src/app/dev/               development-only routes (see below)
src/server/                server-only code, see src/server/README.md
src/lib/                   client-safe shared code
scripts/check-boundaries.mjs  import-boundary check
tests/                     Vitest tests
```

## Boundaries

Enforced by `npm run lint:boundaries` (part of `npm run lint`):

1. Client code (`"use client"` files and everything under `src/lib`) must not
   import `src/server/**` or `server-only`.
2. `src/app/(tenant)` must not import `src/server/landlord` or `src/app/(landlord)`.
3. `src/app/(landlord)` must not import `src/app/(tenant)`.
4. `src/server/tenant` must not import `src/server/landlord`.

Every module under `src/server` also starts with `import "server-only"`, so
Next itself fails the build if a client component pulls one in.

## Development-only routes

Route files named `*.dev.tsx` (for example `src/app/dev/components/page.dev.tsx`)
are only recognised by `next dev`. `next build` ignores them, so they never
ship. See `pageExtensions` in `next.config.ts`.

## Environment

`NEXT_PUBLIC_*` variables are inlined into the browser bundle. `SUPABASE_SERVICE_ROLE_KEY`
is server-only: it is read in `src/server/env.ts` and must never be prefixed
with `NEXT_PUBLIC_`.
