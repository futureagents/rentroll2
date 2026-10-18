# Cross-cutting behaviour — global rules, E1 to E5

Source: *RentRoll UI/UX Specification v1.0*, "How to read this document" and Part E · Cross-cutting behaviour. Wording kept from source. `> OPEN:` lines are conversion notes.

---

## G · The two rules that apply to every screen

**Two rules that apply to every screen in this document.**

- **G-1** — No message ever leaves the system without the landlord pressing send — the assistant drafts into an editable field and never dispatches.
- **G-2** — No tenant-facing screen ever queries or displays rent amounts, repair costs, other units, or other tenants.

Any ticket that appears to breach either rule should be escalated, not implemented.

(Rule IDs G-1, G-2 assigned in conversion.)

Product principles behind them (product.md §3): PR-2 *Nothing sends by itself* · PR-3 *Money stays private*. Scope firm rule (product.md §11): *the assistant drafts, the landlord decides. Nothing written by the assistant reaches a tenant without the landlord reading it first. This is a product rule, not a preference.*

> OPEN: G-2 vs T-05 — T05-LST-RECEIPTS shows "Month · amount · receipt number", and P-01 (opened from T05-BTN-PRINT) shows "amount in figures and words". The T-04 note calls receipts a deliberate exception ("those are the tenant's own payments and the receipt is the point"), but G-2 has no stated exception.
> OPEN: G-2 vs L07-CHK-TENANTLIABLE — L-07 says never expose "the cost recorded" to the tenant, while the tenant-liable checkbox sends the tenant a payment request (S-02) "with the cost pre-filled". Is a cost inside a landlord-sent message allowed? G-2 covers screens; L-07's "Never expose" note does not say.
> OPEN: G-1 vs T02-SEC-CONFIRM "Your landlord has been notified." — no notification to the landlord is specified anywhere, and L-06 says "No notification, just a visual" for ageing cards. Either the sentence is untrue or a landlord notification is missing.

---

## E1 · Every message the system shows

| ID | Situation | Message | Type |
|---|---|---|---|
| E1-01 | Payment recorded | Payment recorded. Receipt RR-0847 created. | Toast with Undo |
| E1-02 | Reminder logged | Reminder recorded on the tenant's history. | Toast |
| E1-03 | Copied | Copied. | Toast, 2 seconds |
| E1-04 | Export ready | Downloaded rent-2026-02.csv | Toast |
| E1-05 | Calendar file | Added — open the file to save it to your calendar. | Toast |
| E1-06 | Request submitted (tenant) | Reported. Your request number is R-0412. | Full screen — T-02 |
| E1-07 | Save failed | Could not save. Your changes are still here — try again. | Inline, above the form |
| E1-08 | Network lost | You are offline. We will save this when you reconnect. | Banner |
| E1-09 | Assistant unavailable | Wrote this from a template — edit as needed. | Quiet note inside S-01 |
| E1-10 | Invalid tenant link | This link is not valid. Please ask your landlord for your unit link. | Full screen |
| E1-11 | Rent rows missing | This month's rent rows have not been created. | Banner with action |

(Message IDs E1-01…E1-11 assigned in conversion.)

**Wording rules.** Never blame the user. Never show a code or an internal identifier. Never use the words error, invalid, failed, or unauthorised in tenant-facing text. Always say what happens next.

Messages stated on individual screens but not in this table: L-01 "Email or password is incorrect." · L-01 five-failed-attempts delay ("say so plainly", wording not given) · T-01 "Could not submit. Please try again." · T-01 offline banner "You are offline. Your report will be sent when you reconnect." · T-01 rate limit ("a plain message", wording not given) · S-01 "This will replace your edits." · S-01 "Did you send it?" · S-02 tooltip "Scan the code with your phone instead." · S-04 "That file is too large" / "That file type is not supported" / "Uploading photo…" · L-03 "Nothing needs your attention today." · L-04 "Part paid — ₹4,000 pending" · L-05 "Log this call?" · L-12 "Expired 14 days ago".

> OPEN: E1-08 "You are offline. We will save this when you reconnect." differs from T-01's offline banner "You are offline. Your report will be sent when you reconnect." Which wording applies on T-01?
> OPEN: E1-02 "Reminder recorded on the tenant's history." — S-01 says only "Yes" in the "Did you send it?" step writes the reminder; it does not say this toast is then shown. Assumed to be the toast for that write.
> OPEN: E1-06 says "Your request number is R-0412." while T02-SEC-CONFIRM continues "Your landlord has been notified." (see G-1 OPEN).
> OPEN: "Never show … an internal identifier" — receipt numbers (RR-0847) and request numbers (R-0412) are shown to users. Assumed these are user-facing identifiers, not internal ones.
> OPEN: The L-01 and T-01 rate-limit/delay messages are required ("say so plainly", "a plain message") but no wording is given.
> OPEN: E1-04 shows the filename `rent-2026-02.csv` for the L-04 export; filenames for the four L-14 exports are not given.

---

## E2 · Empty states

| ID | Screen | Message | Action offered |
|---|---|---|---|
| E2-01 | L-04 Rent, no units | Add a unit and this month's rent will appear here. | Add unit |
| E2-02 | L-04 Rent, all paid | Everything is paid for February. Nice. | None |
| E2-03 | L-06 Maintenance | No open requests. Tenants report problems through their unit link. | Print door QR codes |
| E2-04 | L-08 Units | Your properties and units live here. | Add your first unit |
| E2-05 | L-12 Agreements | Nothing expiring in the next 90 days. | Switch to All |
| E2-06 | L-13 Deposits | Deposits appear here once you add tenants. | Add tenant |
| E2-07 | T-03 Tenant reports | You have not reported anything yet. | Report a problem |
| E2-08 | T-05 Tenant receipts | Receipts appear here once your landlord records a payment. | None |

(Empty-state IDs E2-01…E2-08 assigned in conversion.)

Empty state stated on a screen but not in this table: L-03 "No data at all" — "Add your first property to see your dashboard" with a button to L-08.

> OPEN: No empty state is specified for L-05 reminder timeline, L-07 history, L-09 tabs, L-10 Tenants, L-11 payments/docs, L-14 documents, or L-13 deductions.
> OPEN: E2-02 "Everything is paid for February." — the month name is shown as fixed; presumably it is the selected month.
> OPEN: E2-06 action "Add tenant" — L-13 has no add-tenant control and the tenant form is not specified (see L-09).
> OPEN: E2-03 "Print door QR codes" — on L-08, L08-BTN-PRINTQR prints "one card per selected unit"; from an empty L-06 there is no selection.

---

## E3 · Loading

- **Page load** — skeleton shapes matching the real layout. Never a centred spinner on a blank page.
- **Row action** — spinner inside the button only; the rest of the screen stays usable.
- **Assistant draft** — skeleton lines inside the text area, with a 4-second ceiling before falling back to a template.
- **Photo upload** — thumbnail appears instantly from the local file with a progress ring over it.
- Anything expected to take over 10 seconds does not exist in version one. If a feature needs that long, it is scoped wrong.

---

## E4 · Permissions — the boundary tests

QA should treat these as the highest-severity test cases in the product.

| ID | Test | Expected |
|---|---|---|
| E4-1 | Open a unit link belonging to another landlord's unit | Invalid link message |
| E4-2 | Open a former tenant's link after the tenancy ended | Invalid link message |
| E4-3 | Alter the token in a valid tenant URL | Invalid link message |
| E4-4 | Inspect the data behind any tenant page | Contains no rent amount, no cost, no other unit, no other tenant |
| E4-5 | Request another landlord's rent, unit, tenant or request record while signed in | Not found |
| E4-6 | Reach any landlord route while signed out | Redirect to L-01, then return to the intended screen after signing in |
| E4-7 | Open a document belonging to another landlord | Not found |

(Test IDs E4-1…E4-7 assigned in conversion. Build tracker: "All seven tests pass".)

> OPEN: E4-1 — a valid unit link "belonging to another landlord's unit" is a valid link for that unit; it is not clear what context makes it invalid (the tester is not signed in on tenant routes).
> OPEN: E4-2 vs the one-token-per-unit route (T-01): if the link is per unit, a former tenant holds the same link as the current tenant and it cannot stop working only for them. See T-01.
> OPEN: E4-4 vs T-05 receipt amounts (see G-2 OPEN).

---

## E5 · Accessibility floor

- Every control reachable and operable by keyboard, with a visible focus ring. Tab order follows reading order.
- Text contrast at least 4.5:1; status chips are tested against their tinted backgrounds specifically.
- Icon-only buttons carry an accessible label and a visible tooltip on hover.
- Form errors are announced, and the label is programmatically tied to its field.
- Detail panels and modals trap focus, return it to the trigger on close, and close on Escape.
- Status is never carried by colour alone — every chip has a word.
- Photo thumbnails carry meaningful alternative text, not the file name.

> OPEN: A1 tokens fail this floor as specified. Chip text on its own 12% tint over white measures (WCAG ratio, computed in conversion): success 4.52 · danger 5.05 · warning 3.31 · muted 3.09 · neutral 2.65. `muted` (3.49) and `neutral` (2.95) also fail as text on white. Which gives way, the tokens or the floor?
