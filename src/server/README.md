# src/server

Server-only code. Every module here starts with `import "server-only"`, which
makes Next fail the build if a client component pulls it in.

- `supabase/` - server and service-role Supabase clients
- `env.ts` - server-only environment variables
- `landlord/` - private landlord server code. Never imported from
  `src/app/(tenant)`, `src/server/tenant`, or client code.
- `tenant/` - tenant server code (token-scoped)

Client-safe shared code lives in `src/lib` and must not import from here.
Enforced by `scripts/check-boundaries.mjs` (`npm run lint:boundaries`).
