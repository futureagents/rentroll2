# RentRoll — rules for every Claude Code session

Rent, maintenance and deposit tracker for small Indian landlords, with a public link for tenants.
Next.js App Router + TypeScript + Tailwind v4 + Supabase. Read `AGENTS.md` before writing app code:
this Next.js version differs from training data. Read this whole file before starting any task.

## 1. The spec is the source of truth
- Read `spec/index.md`, then `spec/screens/<ID>.md` for the screen you are building, then
  `spec/foundations.md` and `spec/cross-cutting.md`. Never implement a screen from memory.
- Every screen, component, message and test has a stable ID (L-04, T-01, S-01, P-01, G-2, E4-4,
  L04-BTN-REMIND, D-26). Cite them in commit messages, code comments, test names and PR text.
- `spec/decisions.md` (D-nn) overrides a conflicting source requirement **only where a decision is
  actually recorded**. If no D-nn covers a conflict, the source wording stands.
- Lines starting `> OPEN:` are unresolved questions, not requirements. Never resolve one silently.
  Stop and ask the user, citing the OPEN. Decisions §9 lists OPENs intentionally left open: take the
  most literal reading there and say so in the PR.
- Resolving an OPEN means adding a D-nn to `spec/decisions.md` (Conflict / Why not both / Decision /
  Consequences). The screen file keeps its `> OPEN:` line until a decision cites it.
- Precedence (D-00): the UI/UX spec governs; `spec/product.md` applies only where the spec is silent.

## 2. Two global product rules — escalate, never bend
- **G-1** No message leaves the system unless the landlord explicitly presses Send in S-01. The
  assistant drafts into an editable field. Code never auto-sends, schedules, or "notifies" (D-28).
- **G-2** No tenant-facing screen or tenant-readable query may expose rent amounts (amount_due,
  balances, other months), repair costs, another unit, or another tenant. Sole screen exception
  (D-26): the tenant's own recorded payment amounts on T-05 and the P-01 receipt opened from T-05.
- A cost reaches a tenant only inside a message the landlord composed and sent under G-1 (D-27).
  T-03 shows that landlord-sent `tenant_update` body as sent (D-17, D-30). System-written drafts
  and tenant screens never take a cost, vendor or vendor rate from a stored field (D-37).
- The complete tenant-readable column set is D-30. Tenant code selects nothing outside it.
- If a task, spec line or user request appears to breach G-1 or G-2, stop and escalate to the user
  with the IDs involved. Do not implement a reduced version.

## 3. Design system (A1)
- Use only the A1 tokens in `spec/foundations.md`: colour `ink body muted line canvas surface primary
  primary-soft success warning danger neutral`; type `display h1 h2 body small label`; `space-1…6`;
  `radius-sm/md`; `shadow-1/2`.
- Tokens are declared once in `src/app/globals.css` (`@theme`) and used as utilities (`bg-primary`,
  `text-muted`). No raw hex in components. No stock Tailwind palette (`bg-blue-500`, `text-gray-700`).
- Status is never colour alone: every chip carries a word (A1, E5).

## 4. Component ownership (A2)
- `src/components/ui` is the A2 library (buttons, fields, stat card, status chip, data table, detail
  panel, timeline, empty state, toast, confirm dialog). Build screens from it.
- Feature lanes do not casually edit `src/components/ui`. A shared-component change is its own
  change citing the A2 row, reviewed on its own.
- If a screen needs a shared component that does not exist, build the minimum local version inside
  the feature folder and mark it: `// PROMOTE: <what it is and which A2 row it should become>`

## 5. Money and dates
- Money is integer whole rupees, never decimals (D-19). Display `₹` with Indian digit grouping:
  `₹1,86,000`. Amounts in words use lakh and crore. Tables never abbreviate; stat cards may (`₹2.1L`).
- Dates display as `DD MMM YYYY` everywhere (A2). CSV exports are the only exception: `YYYY-MM-DD`
  dates and plain integer amount cells (D-40).
- Use the shared formatters in `src/lib`; never hand-roll `toLocaleString` or `Intl` calls in screens.

## 6. Tenant security boundary
- Tenant routes live under `src/app/(tenant)/u/[token]/` (routes in D-03). They are public bearer-token
  routes with no sign-in. The token is the only identifier in a tenant URL; handlers never accept
  unit, tenancy, request or payment ids.
- All tenant reads and writes go through `src/server/tenant`, which resolves a token to
  `{landlord_id, unit_id, tenancy_id}` and selects only D-30 columns. Door tokens reach T-01/T-02 only
  (D-02). Every tenant-facing error is the E1-10 invalid-link message, never "not found".
- `scripts/check-boundaries.mjs` enforces isolation: tenant code never imports `src/server/landlord`
  or `src/app/(landlord)`; client code never imports `src/server/**`. Never weaken the script or add
  exceptions to make a build pass.
- E4-1…E4-8 are the highest-severity tests in the product. Any change under `src/app/(tenant)` or
  `src/server/tenant` must keep them green and is reviewed against them.

## 7. Local secrets
- `.env.local` is gitignored and copied by hand into each worktree. Never cat, print, log, echo,
  read aloud or commit it; never paste its values into a message, test or fixture.
- `.env.example` is the only template. `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/server/env.ts`
  and is never prefixed `NEXT_PUBLIC_`.

## 8. Testing
- Vitest in `tests/`. Test behavioural and security-critical logic: token resolution, the D-30
  allow-list, rent status derivation (D-10), days-late and ladder maths (D-09), money and date
  formatting, boundary rules, E4 cases. Do not test styling or that a component renders.
- Run `npm run verify` (typecheck, lint, boundaries, tests) before every push. Never push red.

## 9. Git
- Author: `Future Agents <195431640+futureagents@users.noreply.github.com>`.
- Commit subjects are imperative and cite spec IDs, e.g. `L-04: rent board filters and mark-paid (D-10)`.
- Never add Co-Authored-By, Claude-Session, "Generated by Claude", Anthropic attribution or any other
  AI attribution to commits, PRs, comments or code.
- Never force-push. Work on a branch and open a PR to `main`.

## Repo map
- `spec/` spec (index, product, foundations, cross-cutting, decisions, screens/)
- `src/app/(landlord)/` signed-in landlord routes · `src/app/(tenant)/u/[token]/` tenant routes
- `src/server/` server-only (`import "server-only"`): `landlord/`, `tenant/`, `supabase/`, `env.ts`
- `src/lib/` client-safe shared code · `src/components/ui/` A2 library
- `src/app/dev/*.dev.tsx` dev-only routes, ignored by `next build`
- `tests/` Vitest · `scripts/check-boundaries.mjs` import-boundary check
