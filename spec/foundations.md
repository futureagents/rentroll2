# Foundations — A1 to A4

Source: *RentRoll UI/UX Specification v1.0*, Part A · Foundations. Wording kept from source. `> OPEN:` lines are conversion notes.

---

## A1 · Design tokens

### Colour

| Token | Value | Used for |
|---|---|---|
| `ink` | `#14202B` | Headings, primary text, numbers on cards |
| `body` | `#3C4A57` | Body copy, table cells |
| `muted` | `#7C8B99` | Labels, helper text, placeholders, timestamps |
| `line` | `#E2E8ED` | Borders, dividers, table rules |
| `canvas` | `#F6F8FA` | Page background |
| `surface` | `#FFFFFF` | Cards, panels, table background |
| `primary` | `#1B3A5C` | Primary buttons, active nav, links |
| `primary-soft` | `#DCE7F0` | Selected rows, active tab background |
| `success` | `#1E7A4D` | Paid status, confirmations |
| `warning` | `#B4761A` | Due soon, expiring, 1–9 days late |
| `danger` | `#B3352C` | Overdue 10+ days, urgent requests, destructive actions |
| `neutral` | `#8A98A5` | Vacant, closed, archived |

**Status colour is never the only signal.** Every status chip carries a text label as well as a colour, so the board is readable in print, in greyscale, and by anyone with colour vision deficiency.

> OPEN: L-06 sets the "Low" urgency chip to "muted" (a text token), not one of the status colours. Is `muted` allowed as a chip colour?

### Type scale

| Token | Size / weight | Used for |
|---|---|---|
| `display` | 28px / 600 | Dashboard headline numbers only |
| `h1` | 20px / 600 | Page title |
| `h2` | 16px / 600 | Card and panel titles |
| `body` | 14px / 400 | Default text, table cells, form values |
| `small` | 13px / 400 | Helper text, secondary detail |
| `label` | 11px / 600, uppercase, 0.6px tracking | Field labels, column headers, stat captions |

One typeface throughout. Numbers in tables and money columns use tabular figures so digits align vertically.

> OPEN: The colour token `body` and the type token `body` share a name.
> OPEN: The typeface itself is not named.
> OPEN: "display — Dashboard headline numbers only", yet L-13 asks for the balance to be "Large, unmissable". Which token does L13-SEC-BALANCE use?

### Spacing, radius, elevation

| Token | Value | Rule |
|---|---|---|
| `space-1 … 6` | 4, 8, 12, 16, 24, 32px | Nothing outside this scale. Card padding is 16px on mobile, 24px on desktop. |
| `radius-sm` | 6px | Buttons, inputs, chips |
| `radius-md` | 10px | Cards, panels, modals |
| `shadow-1` | `0 1px 2px rgba(20,32,43,.06)` | Cards at rest |
| `shadow-2` | `0 8px 24px rgba(20,32,43,.12)` | Modals, drawers, dropdown menus |

> OPEN: Fixed sizes elsewhere in the spec sit outside the spacing scale (220px sidebar, 480px panel, 560px modal, 32/40/48px button heights, 48px rows, 3px active bar). Does "Nothing outside this scale" apply to spacing only (padding, margin, gap)?

---

## A2 · Component library

Build these once. Every screen below refers to them by name.

### Buttons

| Variant | Appearance | Use for | Notes |
|---|---|---|---|
| **Primary** | Solid primary, white text | The one main action on a screen | Maximum one per screen region |
| **Secondary** | White, primary border and text | Supporting actions | Any number |
| **Quiet** | No border, body text, hover fill | Row-level actions, cancel | Used inside tables |
| **Danger** | White, danger border and text | Delete, remove, end tenancy | Always behind a confirm dialog |
| **Icon** | 32×32, icon only | Call, copy, share, print | Must carry a tooltip and an accessible label |

Heights: 40px default, 32px compact in table rows, 48px on tenant screens (touch targets). Disabled buttons show a tooltip explaining why. A button that triggers a network call shows an inline spinner and becomes non-interactive until it resolves — never a full-page block.

> OPEN: Icon buttons are 32×32, but tenant screens require a 48×48 minimum touch target (A4) and T05-BTN-PRINT is an icon button. Which wins on tenant screens?
> OPEN: "Maximum one [primary] per screen region", but L-13 has two primary buttons (L13-BTN-GENERATE and L13-BTN-CLOSE) and L-05 places L05-BTN-REMIND as primary. Is each of L-13's primaries in its own region?

### Form fields

| Component | Behaviour |
|---|---|
| **Text field** | Label above, helper text below, error replaces helper text in danger colour. Validates on blur, not on keystroke. |
| **Money field** | Prefixed ₹, digits only, thousands separators shown as the user types, no decimals. |
| **Phone field** | Prefixed +91, accepts 10 digits, strips spaces and dashes on save. |
| **Date field** | Native date picker. Displays as `DD MMM YYYY` everywhere in the product. |
| **Dropdown** | Native select on mobile. Always has a placeholder that is not a valid choice. |
| **Segmented choice** | 2–4 options shown as adjacent buttons. Used for urgency and status filters. |
| **Photo uploader** | See S-04. |
| **Text area** | Auto-grows to 8 lines then scrolls. Character counter appears past 400 characters. |

> OPEN: "thousands separators" does not say whether grouping is Western (186,000) or Indian (1,86,000). The scope wireframe shows abbreviated "2.1L" and "36k"; L-09 says "₹2.1 lakh".
> OPEN: S01-FLD-MESSAGE "Auto-grows" without the 8-line cap being restated. Assumed to inherit the Text area rule.

### Display components

| Component | Definition |
|---|---|
| **Stat card** | Uppercase label, display-size number, optional comparison line. Clickable when it has a destination — the whole card is the target, not just the number. |
| **Status chip** | Rounded pill, coloured background at 12% opacity, text in the full colour. Always includes a word. |
| **Data table** | Sticky header, sortable columns marked with an arrow, row hover fill, 48px rows. Row click opens the detail panel; buttons inside the row stop the click from propagating. |
| **Detail panel** | Slides in from the right, 480px wide on desktop, full screen on mobile. Closes on Escape, on backdrop click, and on the close button. Warns before closing if a field has unsaved edits. |
| **Timeline** | Vertical list of events, newest first, each with an icon, a line of text and a timestamp. Used for request history and reminder history. |
| **Empty state** | One line explaining what would appear here, and the button that creates the first one. Never just "No data". |
| **Toast** | Bottom-centre, 4 seconds, one line, optional Undo. Never used for errors that need a decision. |
| **Confirm dialog** | Title as a question, one line of consequence, cancel plus a labelled action button. The action button says what it does — "Delete unit", never "OK". |

> OPEN: Toast lasts 4 seconds, but the L-04 payment toast carries an Undo "that reverses it for 10 seconds". Does the toast stay for 10 seconds, or does Undo outlive it?
> OPEN: S03-BTN-COPY toast / E1 "Copied." is "Toast, 2 seconds", not 4.
> OPEN: Data table "Row click opens the detail panel", but L-08 and L-10 rows open full pages (L-09, L-11). L-09 is "a full page, not a panel"; L-11's form is not stated.
> OPEN: Empty state "the button that creates the first one", but E2 lists some empty states with action "None" (L-04 all paid, T-05).

---

## A3 · Global navigation

| Region | Contents and behaviour |
|---|---|
| **Sidebar** (desktop) | Fixed 220px. Logo, then: Dashboard, Rent, Maintenance, Units, Tenants, Agreements, Deposits, Documents. Settings and account sit at the bottom. Active item has primary-soft background and a 3px left bar. |
| **Bottom bar** (mobile) | Five items only: Dashboard, Rent, Maintenance, Units, More. "More" opens a sheet with the rest. |
| **Page header** | Title on the left, primary action on the right, filters on the row beneath. Persists while the table scrolls. |
| **Global search** | Not in version one. Filters on each board cover the need. |

Tenant screens have **no navigation at all** — no sidebar, no menu, no links to anything except the tenant's own three pages.

| Sidebar item | Screen |
|---|---|
| Dashboard | L-03 |
| Rent | L-04 |
| Maintenance | L-06 |
| Units | L-08 |
| Tenants | L-10 |
| Agreements | L-12 |
| Deposits | L-13 |
| Documents | L-14 |
| Settings | L-15 |

(Mapping table assigned in conversion.)

> OPEN: "the tenant's own three pages" vs five tenant screens (T-01…T-05) and the scope's "four tenant pages". Which three are linkable?
> OPEN: The "account" item at the bottom of the sidebar has no screen (sign-out, change password, account name used by L02-FLD-BIZNAME).
> OPEN: Global search is excluded because "Filters on each board cover the need", but L-08, L-13 and L-14 specify no filters.

---

## A4 · Responsive rules

| Breakpoint | Behaviour |
|---|---|
| **Under 640px** | Data tables become stacked cards — one card per row, key fields only, tap to open the detail panel full-screen. Bottom navigation bar. Stat cards go two per row. |
| **640–1024px** | Sidebar collapses to icons. Tables keep three columns plus actions. |
| **Over 1024px** | Full sidebar, full tables, detail panel opens alongside rather than over content. |

**Tenant screens are designed mobile-first and are never tested on desktop only.** Minimum touch target on tenant screens is 48×48px.

> OPEN: "key fields only" (under 640px) and "three columns plus actions" (640–1024px) do not say which fields/columns per table.
> OPEN: "Over 1024px … detail panel opens alongside rather than over content" vs L-03 "Row action 'Open' — Opens the relevant detail panel over the dashboard".
