# RentRoll v1 — Specification index

This folder is the implementation spec for RentRoll v1, converted from the two source documents in `source/`:

- *RentRoll Product Scope Document, Version 1.0* (`source/RentRoll - Product Scope Document.pdf`) → [product.md](product.md)
- *RentRoll UI/UX Specification v1.0* (`source/RentRoll - UI-UX Specification.pdf`) — "treat as the source of truth for version one" → everything else

**How to use it.** Read this index, then the file for the ID you are working on, then [foundations.md](foundations.md). Every screen file is self-contained for its own Meta, Layout, Components, Interactions, States and Rules; global rules live in [cross-cutting.md](cross-cutting.md). Source wording is preserved. Lines starting `> OPEN:` are unresolved questions or contradictions found during conversion — they are not requirements. Resolutions go in [decisions.md](decisions.md). IDs marked † were assigned during conversion where the source names an element without an ID.

---

## Two rules that apply to every screen

**G-1** No message ever leaves the system without the landlord pressing send — the assistant drafts into an editable field and never dispatches.
**G-2** No tenant-facing screen ever queries or displays rent amounts, repair costs, other units, or other tenants.

Any ticket that appears to breach either rule should be escalated, not implemented. (Full text and OPENs: [cross-cutting.md](cross-cutting.md#g--the-two-rules-that-apply-to-every-screen).)

---

## Identifier scheme (source: "How to read this document")

Every screen, component and interaction has a stable ID. Use these IDs in tickets, commit messages and QA notes so a bug can be traced to a line in this document.

| Pattern | Example | Meaning |
|---|---|---|
| `L-nn` | L-03 | Landlord screen, requires sign-in |
| `T-nn` | T-01 | Tenant screen, public link, no sign-in |
| `S-nn` | S-02 | Shared component used on several screens |
| `P-nn` | P-01 | Print view |
| `Lnn-TYPE-NAME` | L04-BTN-REMIND | A specific element on a specific screen |

Element types: `BTN` button · `LNK` link · `FLD` input field · `SEL` dropdown · `CHK` checkbox · `TAB` tab · `ROW` table or list row · `CRD` card · `MOD` modal · `TST` toast · `CHP` chip or badge.

Types used in the source but not in the list above: `TBL` table · `SEG` segmented choice · `STRIP` summary strip · `SEC` section/block · `TML` timeline · `CHT` chart · `LST` list · `COL` board column · `GAL` photo strip · `UPL` uploader · `IMG` image · `HDR` header · `ZONE` drop zone · `THUMB` thumbnail · `ERR` inline error. Conversion additions: `FRM` inline form · `BNR` banner · `STATE` modal state.

IDs added in conversion (not in source): `PR-1…6` principles · `M-1…8` modules · `C-1…12` connections · `SM-1…6` success measures (product.md) · `G-1`, `G-2`, `E1-01…11`, `E2-01…08`, `E4-1…7` (cross-cutting.md) · element IDs marked † in screen files.

What each screen section contains: **Meta** — route, who can reach it, why it exists, where users arrive from and leave to · **Layout** — the regions of the screen, top to bottom · **Components** — every element with its ID and content · **Interactions** — what happens on every click, in order · **States** — loading, empty, error, and any state-specific display · **Rules** — validation, permissions, edge cases.

---

## ID map

### Product and foundations

| ID | File | Purpose |
|---|---|---|
| — | [product.md](product.md) | Scope document: summary, problem, principles, users, journey, eight modules, wireframes, IA, user flow, rent lifecycle, assistant, twelve connections, architecture, data flow, ERD, scope, success measures |
| A1 | [foundations.md](foundations.md#a1--design-tokens) | Design tokens — colour, type, spacing, radius, elevation |
| A2 | [foundations.md](foundations.md#a2--component-library) | Component library — buttons, form fields, display components |
| A3 | [foundations.md](foundations.md#a3--global-navigation) | Global navigation — sidebar, bottom bar, page header |
| A4 | [foundations.md](foundations.md#a4--responsive-rules) | Responsive rules — breakpoints, tenant touch targets |
| G-1, G-2 | [cross-cutting.md](cross-cutting.md#g--the-two-rules-that-apply-to-every-screen) | The two rules that apply to every screen |
| E1 | [cross-cutting.md](cross-cutting.md#e1--every-message-the-system-shows) | Every message the system shows, and wording rules |
| E2 | [cross-cutting.md](cross-cutting.md#e2--empty-states) | Empty states |
| E3 | [cross-cutting.md](cross-cutting.md#e3--loading) | Loading |
| E4 | [cross-cutting.md](cross-cutting.md#e4--permissions--the-boundary-tests) | Permission boundary tests — highest severity |
| E5 | [cross-cutting.md](cross-cutting.md#e5--accessibility-floor) | Accessibility floor |
| — | [decisions.md](decisions.md) | Resolutions to OPEN items (empty) |

### Landlord screens — signed in

| ID | Name | Route | File | One-line purpose | Module |
|---|---|---|---|---|---|
| L-01 | Sign in | `/signin` · `/signup` · `/reset` | [screens/L-01.md](screens/L-01.md) | Get the landlord in with the least friction. | — |
| L-02 | First-run setup | `/setup` | [screens/L-02.md](screens/L-02.md) | Get one property, one unit and payment details in, so the dashboard is not empty. | — |
| L-03 | Portfolio dashboard · the hub | `/` | [screens/L-03.md](screens/L-03.md) | Answer one question in five seconds: is anything wrong today? | M-1 |
| L-04 | Rent due board | `/rent` | [screens/L-04.md](screens/L-04.md) | See who has paid, and act on who has not, without leaving the screen. | M-2 |
| L-05 | Rent detail panel | `/rent/:entryId` | [screens/L-05.md](screens/L-05.md) | Everything about one month's rent for one unit, including reminder history. | M-2 |
| L-06 | Maintenance board | `/maintenance` | [screens/L-06.md](screens/L-06.md) | See every reported problem, in order of urgency, and move it along. | M-4 |
| L-07 | Request detail panel | `/maintenance/:requestId` | [screens/L-07.md](screens/L-07.md) | Everything about one reported problem, and every action needed to close it. | M-4 |
| L-08 | Unit register | `/units` | [screens/L-08.md](screens/L-08.md) | The list of everything owned, and the way in to a unit's full history. | M-5 |
| L-09 | Unit detail | `/units/:unitId` | [screens/L-09.md](screens/L-09.md) | The unit's whole life: who lives there, earnings, costs, move-in condition. | M-5 |
| L-10 | Tenant list | `/tenants` | [screens/L-10.md](screens/L-10.md) | Contact, agreement and payment history for a person, past or present. | M-6 |
| L-11 | Tenant detail | `/tenants/:tenantId` | [screens/L-11.md](screens/L-11.md) | Contact, agreement and payment history for a person, past or present. | M-6 |
| L-12 | Agreement tracker | `/agreements` | [screens/L-12.md](screens/L-12.md) | Make sure nothing expires unnoticed. Highest-value screen. | M-7 |
| L-13 | Deposit & settlement | `/deposits` · `/deposits/:tenantId` | [screens/L-13.md](screens/L-13.md) | Turn a potential argument into a document. Exists to be printed. | M-8 |
| L-14 | Documents & exports | not stated | [screens/L-14.md](screens/L-14.md) | Every uploaded file; four exports; email to accountant. | — |
| L-15 | Settings | not stated | [screens/L-15.md](screens/L-15.md) | UPI ID, receipt name, logo, escalation default, reminder ladder, accountant email. | — |

### Tenant screens — link only, no sign-in

| ID | Name | Route | File | One-line purpose |
|---|---|---|---|---|
| T-01 | Report a problem · the entry point | `/u/:unitToken` | [screens/T-01.md](screens/T-01.md) | Capture a problem with enough detail to act on, in under two minutes. Holds the Part C design brief. |
| T-02 | Submitted confirmation | not stated | [screens/T-02.md](screens/T-02.md) | Confirm the request number; ask the tenant to save the link. |
| T-03 | My reports and their status | not stated | [screens/T-03.md](screens/T-03.md) | Every request from this tenancy with status. |
| T-04 | My unit and landlord contact | not stated | [screens/T-04.md](screens/T-04.md) | Unit, property, landlord, agreement dates — no rent. Call / WhatsApp the landlord. |
| T-05 | My receipts | not stated | [screens/T-05.md](screens/T-05.md) | The tenant's receipts, each printable. |

### Shared components and print views

| ID | Name | File | One-line purpose |
|---|---|---|---|
| S-01 | Message composer | [screens/S-01.md](screens/S-01.md) | The single place where every outgoing message is reviewed and sent. Enforces G-1. |
| S-02 | Payment sheet | [screens/S-02.md](screens/S-02.md) | UPI amount, note, QR and payment link. Never claims payment received. |
| S-03 | Share & copy menu | [screens/S-03.md](screens/S-03.md) | Device share sheet with copy fallback; copy with tick feedback. |
| S-04 | Photo uploader | [screens/S-04.md](screens/S-04.md) | On-device compression, instant thumbnails, 3 (tenant) / 10 (landlord) photos. |
| P-01 | Rent receipt | [screens/P-01.md](screens/P-01.md) | Printable numbered receipt. |
| P-02 | Settlement statement | [screens/P-02.md](screens/P-02.md) | Printable deposit settlement with deductions and signatures. |
| P-03 | Door QR card | [screens/P-03.md](screens/P-03.md) | Printable unit QR, four to an A4 page. |

Source groupings split into one file per ID: "L-10 · Tenant list · L-11 · Tenant detail", "L-14 · Documents and exports · L-15 · Settings", "T-03 · My reports · T-04 · My unit · T-05 · My receipts", "S-03 · Share and copy menu · S-04 · Photo uploader", and "Print views" (P-01…P-03).

---

## Screen map (source)

- **LANDLORD · signed in:** L-01 Sign in · L-02 First-run setup · **L-03 Portfolio dashboard · the hub** · L-04 Rent due board · L-05 Rent detail panel · L-06 Maintenance board · L-07 Request detail panel · L-08 Unit register · L-09 Unit detail · L-10 Tenant list · L-11 Tenant detail · L-12 Agreement tracker · L-13 Deposit & settlement · L-14 Documents & exports · L-15 Settings
- **TENANT · link only, no sign-in:** **T-01 Report a problem · the entry point** · T-02 Submitted confirmation · T-03 My reports and their status · T-04 My unit and landlord contact · T-05 My receipts
- **SHARED & PRINT:** S-01 Message composer · S-02 Payment sheet · S-03 Share & copy menu · S-04 Photo uploader

Fifteen landlord screens, five tenant screens, four shared components and three print views. The dashboard is the only hub; every other landlord screen is reachable from the sidebar as well.

> OPEN: The source cover says "COVERS 14 landlord screens · 5 tenant screens · 6 shared components"; the screen map says fifteen landlord screens, four shared components and three print views.
> OPEN: "every other landlord screen is reachable from the sidebar" — L-01, L-02, L-05, L-07, L-09 and L-11 have no sidebar entry (A3); they are reached from their parent screens.

---

## Part F · Build tracker (source)

Suggested order. Each row is a ticket. Nothing in a later phase blocks anything in an earlier one, so this order can be followed straight through.

| Phase | Ref | Ticket | Done when |
|---|---|---|---|
| 1 | A1, A2 | Design tokens and component library | Every component in A2 exists in isolation with all its states |
| 1 | A3, A4 | App shell, navigation, responsive rules | Sidebar, bottom bar and breakpoints behave as specified |
| 1 | L-01 | Sign in, sign up, password reset | All three flows, plus the five-attempt delay |
| 2 | L-08, L-09 | Unit register and unit detail | Units can be created, listed and opened; tokens generated |
| 2 | L-10, L-11 | Tenant list and detail | A tenant can be attached to a unit with agreement dates |
| 2 | L-02 | First-run setup | A new account reaches a populated dashboard without help |
| 3 | T-01, T-02 | Tenant report form and confirmation | A request submitted from a phone appears in the database |
| 3 | S-04 | Photo uploader with compression | A 6MB photo uploads in under 5 seconds on a normal connection |
| 3 | L-06, L-07 | Maintenance board and request detail | Full lifecycle from New to Done, with cost captured |
| 4 | L-04 | Rent due board | Rows generated monthly; filters, statuses and mark-paid all work |
| 4 | L-05 | Rent detail panel with reminder history | Timeline shows every reminder and logged call |
| 4 | P-01 | Rent receipt print view | Prints cleanly to A4 with the landlord's branding |
| 5 | S-01 | Message composer with the three tones | Draft arrives, is editable, and the send-confirmation step records correctly |
| 5 | S-02 | Payment sheet, link and QR | A phone opens the payment app with the right amount; desktop shows the QR |
| 5 | S-03 | Share and copy across all screens | Desktop fallback verified; no broken share icons |
| 6 | L-03 | Portfolio dashboard | All four cards route correctly; Needs attention sorted as specified |
| 6 | L-12 | Agreement tracker with calendar file | Countdowns correct; the calendar file opens in a real calendar app |
| 6 | T-03, T-04, T-05 | Tenant status, unit and receipt pages | Verified against every test in E4 |
| 7 | L-13, P-02 | Deposit settlement and its statement | Deductions pull from repair history with photos attached |
| 7 | L-14, L-15 | Exports, documents and settings | All four CSVs open correctly in Excel with the rupee symbol intact |
| 7 | P-03 | Door QR cards | Four to a page, scannable from print |
| 8 | E1–E3 | Message, empty and loading state pass | Every state in the tables above exists and matches the wording |
| 8 | E4 | Permission boundary testing | All seven tests pass |
| 8 | E5 | Accessibility pass | Keyboard-only run through every screen completes |

**A note on order.** The tenant form is built in phase 3, before the rent board. That is deliberate — it is the screen most likely to be judged by a real user, it is the smallest, and having real requests in the system makes every later screen easier to build against.

> OPEN: "Nothing in a later phase blocks anything in an earlier one" is not true as written. S-01 (phase 5) is opened by L-07 (phase 3), L-04 and L-05 (phase 4); phase 3's done-when "Full lifecycle from New to Done" needs L07-BTN-DISPATCH → S-01. S-02 (phase 5) is opened by L05-BTN-PAYLINK (phase 4), and P-01 (phase 4) prints a payment QR. L-15 (phase 7) holds the ladder S-01 (phase 5) reads and the UPI ID S-02 needs. L-02 (phase 2) leads to L-03 (phase 6).
> OPEN: Phase 2 "tokens generated" — which tokens (see the T-01 token OPEN).
> OPEN: Phase 7 "with the rupee symbol intact" (see L-14).

---

## Coverage — where every source section lives

| Source | Section | Home |
|---|---|---|
| Scope §1–§18, Diagrams 1–8 | All | product.md (§ numbers kept) |
| UI/UX cover | Purpose, audience, covers, version | index.md (this file) |
| UI/UX "How to read this document" | Identifier scheme, section contents, two rules | index.md · cross-cutting.md (G) |
| UI/UX Part A | A1–A4 | foundations.md |
| UI/UX Screen map | | index.md |
| UI/UX Part B | L-01…L-15 | screens/L-01.md … L-15.md |
| UI/UX Part C | Design brief, T-01…T-05 | screens/T-01.md (brief) … T-05.md |
| UI/UX Part D | S-01…S-04, Print views | screens/S-01.md … S-04.md, P-01.md … P-03.md |
| UI/UX Part E | E1–E5 | cross-cutting.md (E1–E3 rows are also repeated in the screen files they belong to) |
| UI/UX Part F | Build tracker, note on order | index.md |

Source cover metadata: PURPOSE "The build reference. Every screen, every component, every click." · AUDIENCE "Developer, designer, QA" · COMPANION TO "RentRoll Product Scope Document v1.0" · VERSION "1.0 — treat as the source of truth for version one".
