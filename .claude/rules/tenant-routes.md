---
paths:
  - "src/app/(tenant)/**"
  - "src/server/tenant/**"
  - "tests/**/tenant*"
  - "tests/**/e4*"
---

# Tenant routes — what they may and may not do

Applies to every file under `src/app/(tenant)` and `src/server/tenant`. Source: G-2, E1, E4,
D-01…D-05, D-26, D-29, D-30, D-31 in `spec/`. When this file and the spec disagree, the spec wins.

## Routes (D-03) — the complete list
`/u/:token` T-01 · `/u/:token/reported/:requestNumber` T-02 · `/u/:token/reports` T-03 ·
`/u/:token/unit` T-04 · `/u/:token/receipts` T-05 · `/u/:token/receipts/:receiptNumber/print` P-01.
No other tenant route exists. The token is the only identifier in a tenant URL besides the
per-landlord request and receipt numbers. Handlers never accept unit, tenancy, request or payment ids.

## Token resolution (D-01, D-02, D-04, D-05)
- Both `unit.door_token` and `tenancy.tenant_token` are served at `/u/:token`. Resolution yields
  exactly one of them as `{landlord_id, unit_id, tenancy_id | null}` and happens only in `src/server/tenant`.
- A door token reaches T-01 and T-02 only, with name and phone fields blank and no footer links.
  Every other route under a door token renders the invalid-link message (E4-8).
- A `tenant_token` whose tenancy is `ended` or `settled` is revoked: invalid-link message (E4-2).
- A door token for a vacant unit (no active tenancy) renders the invalid-link message.
- A request or receipt number that does not belong to the token's tenancy: invalid-link message.
- Every failure, including unknown token, is E1-10 "This link is not valid. Please ask your landlord
  for your unit link." Never "not found", never an error page, never a redirect to sign-in.

## May read — the closed set (D-30)
- tenancy: name, phone (pre-fill only), moved_in_on, current agreement `starts_on`/`ends_on`
- unit: unit number, type · property: name · landlord: name, receipt_name, phone, logo
- request, own tenancy only: request_number, effective category, created_at, status, photo count,
  latest `tenant_update` message body
- audit_event, own requests only: `status_change` rows for the timeline
- payment, own tenancy, `status = recorded` only: amount, received_on, reference, receipt_number, month
Every query names its columns (never `select('*')`), filters by the resolved `landlord_id` and
`tenancy_id`, and never joins to another unit or tenancy. Nothing outside this list is selectable from
tenant code, even if it is not rendered.

## Must never read or render (G-2, D-26, D-30)
- `rent_entry.amount_due`, balances, "pending" figures, other months' dues, deposit amounts
- `request.cost`, `no_cost`, `tenant_liable`, vendor, internal notes, urgency, assistant suggestions
- any other unit, tenancy, tenant, request, payment or landlord record
- voided payments, internal ids (uuids), error codes
Sole exception: amounts of the tenant's own recorded payments on T-05 and on P-01 opened from T-05
(see "Money a tenant may see" below). The P-01 payment QR carries no amount.
Cost-privacy exception (D-17, D-27, D-37), not a bug: a tenant-facing screen never renders a cost from a stored field; a cost may leave the system only inside a message the landlord composed and sent (e.g. the L07-CHK-TENANTLIABLE payment request; T-03 echoing the landlord-sent `tenant_update` body verbatim is that same message, D-17 — never scrub or filter it); tenant update drafts are built from status and category only — never cost, vendor, or vendor rate.

## Money a tenant may see — the one exception, and it is not a leak (G-2, D-26)
A tenant sees their own payments and no other money. A receipt without its amount is not a
receipt, so these two surfaces show rupee amounts on purpose. Do not flag them in review and do not
remove them:
- **T-05** `/u/:token/receipts` — the amount of each **recorded** payment of the token's own tenancy
  (voided payments excluded).
- **P-01 opened from T-05** `/u/:token/receipts/:receiptNumber/print` — that one payment's amount
  in figures and words. Its payment QR carries no amount.

That is the whole exception. It covers money the tenant paid, not money they owe or anything else:
- never their own `amount_due`, balance, "pending" figure, other months' dues, deposit, or agreement
  rent (T-04 shows agreement dates and no rent figure);
- never another unit, never another tenant;
- never a repair cost (the landlord-sent message case above is D-27, not this exception);
- never a landlord business figure (collections, totals, expenses, vendor rates).
No other tenant screen shows an amount. A new tenant surface with money needs its own D-nn first.

## May write — one thing (D-29, D-31, T-01)
- Create a `request` with `reported_via = tenant_link`, attached to the token's current tenancy, up
  to 3 photos (S-04), rate-limited to 5 submissions per token per hour. Nothing else is writable from
  tenant code. No `request` row exists until the server accepts it; no background queue.
- Tenant code never creates or sends a `message`, notification, email or WhatsApp (G-1, D-28).

## Rendering rules (A3, A4, E1, E5)
- No navigation except the three footer links (T-03, T-04, T-05) plus "Report a problem" → T-01.
- Mobile-first; 48×48 px minimum touch targets, including icon buttons.
- Never use the words error, invalid, failed or unauthorised in tenant-facing text. Say what happens next.
- Status words: New → "Received"; Assigned, In progress, Done, Reopened as written.

## Code structure
- Tenant files never import `src/server/landlord`, `src/app/(landlord)` or any landlord component.
  `scripts/check-boundaries.mjs` enforces this; never add an exception to it.
- In tenant code, the service-role Supabase client is used only inside `src/server/tenant`, behind
  token resolution. (Landlord server code also uses it, to sign storage URLs under D-15.)
- Any change here must keep E4-1…E4-8 green and be reviewed with the `privacy-boundary` agent before
  the PR is opened.
