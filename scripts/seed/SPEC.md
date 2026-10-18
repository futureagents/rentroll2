# RentRoll demo seed — design

Ticket C2. A realistic, deterministic demo dataset for RentRoll v1: one Pune landlord, two properties, fourteen units, and every situation the dashboard, boards and tenant pages need to show.

**Sources.** RentRoll Product Scope Document v1.0 and RentRoll UI/UX Specification v1.0 (`source/`). Screen IDs (L-03, T-01, S-01 …) and element IDs (L04-BTN-MARKPAID …) refer to the UI/UX spec. Example values are taken from those documents wherever they give one: *Kulkarni Apartments*, *Flat 2A*, *Suresh Khan · Flat 4C · 18 days overdue*, *geyser leaking, urgent*, *Part paid — ₹4,000 pending*, *agreement ends in 22 days*, *Expired 14 days ago*, *Plumbing reported 4 times in 12 months*, rents of ₹16,000–₹18,000.

---

## 1. Ground rules

1. **No schema is invented.** The data is written in the vocabulary of the scope document's entity diagram (landlord, property, unit, tenant, rent entry, reminder, request, document). The keys in `data.mjs` and in `build.mjs` output are seed-domain names, not tables or columns. Mapping them onto the real schema is `load.mjs`, which is a TODO (§9).
2. **Every date is relative to the run date.** Nothing is a fixed calendar date, so the dashboard looks the same whichever day the seed runs. The run date defaults to *today in Asia/Kolkata*.
3. **Deterministic.** The same run date always gives the same output: no randomness, and receipt and request numbers come from date order. `check.mjs` proves the scenarios hold on every run date across a range (§8).
4. **Fictitious people.** Every phone number is `+91 90000 00xxx` and every email uses `example.com` or `.example`. The numbers are made up but could still belong to a real person, so never send anything to them. The UPI handle `@okdemo` is not a real bank.
5. **Tenant-safe by construction.** Nothing in the dataset needs a tenant page to show rent, cost, other units or other tenants. Receipts on T-05 are the documented exception.

## 2. The cast

**Landlord.** Anil Kulkarni · receipt name "Kulkarni Properties" · UPI `anil.kulkarni@okdemo` · accountant `office@gadgil-ca.example`.

**Settings (L-15).** Reminder ladder: day 3 gentle, day 10 direct, day 20 formal. Default escalation 5%; the source gives no default, so 5% was chosen.

**Vendors.** Shinde Plumbing Works · Ramesh Electricals · Deshmukh Waterproofing · Sai Glass & Aluminium · Pune Pest Control Services.

**Properties and units.** Deposits are 3 months' rent at Kulkarni Apartments and 2 months' at Shanti Niwas, both taken on the first term's rent.

| Property | Unit | Type | Rent ₹ | Status | Tenant | Scenarios |
|---|---|---|---|---|---|---|
| Kulkarni Apartments, Mayur Colony, Kothrud 411038 | 1A | 1BHK | 16,000 | Occupied | Rohit Sharma | SC-10 three-term renewal history · SC-27 |
| | 1B | 1BHK | 16,000 | Occupied | Anjali Iyer | SC-20 urgent geyser · SC-25 repeated plumbing |
| | 2A | 2BHK | 18,000 | Occupied | Meera Desai | SC-02 5 days overdue · SC-04 late-payment history · SC-26 |
| | 2B | 2BHK | 18,000 | **Vacant** | (former: Arjun Mehta) | SC-31 settled move-out |
| | 3A | 2BHK | 17,000 | Occupied | Priya Deshpande | SC-11 agreement expired 14 days ago · SC-23 |
| | 3B | 2BHK | 18,000 | Occupied | Vikram Joshi | SC-12 agreement ends in 22 days |
| | 4A | 2BHK | 17,000 | Occupied | Nikhil Patil | SC-13 ends in 45 days · SC-22 |
| | 4B | 2BHK | 17,500 | Occupied | Sneha Gokhale | SC-05 the ordinary tenant |
| | 4C | 2BHK | 18,000 | Occupied | Suresh Khan | SC-01 18 days overdue · SC-28 · SC-41 · SC-42 |
| Shanti Niwas, off Baner Road, Baner 411045 | G1 | 1RK | 10,000 | Occupied | Aditya Bhosale | SC-21 · SC-40 no move-in photos · SC-43 pro-rata |
| | F1 | 1BHK | 12,000 | Occupied | Pooja Nair | SC-03 part paid, ₹4,000 pending |
| | F2 | 1RK | 11,000 | Occupied | Rahul Chavan | SC-14 ends in 75 days · SC-24 |
| | S1 | 1RK | 11,000 | **Notice period** | Kavya Rao | SC-29 · SC-30 notice given |
| | S2 | 1RK | 11,000 | **Vacant** | (never let) | SC-32 |

That gives 14 units, 12 occupied (S1 included, as it is occupied while under notice) and 2 vacant. Unit numbers are distinct across the two properties, so a bare "4C" is never ambiguous in the demo.

## 3. How dates are pinned to the run date

`data.mjs` writes dates as offsets: `{ days: -18 }` means 18 days before the run date. `{ days: -1, at: '21:40' }` adds an Asia/Kolkata time of day. `{ monthsAgo: 1, day: 12 }` means the 12th of last month.

The hard part is rent. A rent row's due date is a day of the month, but the scenarios need an exact number of days overdue on every run date. So a scenario tenancy's **rent due day** is set to the day-of-month of (run date − N):

- 4C (SC-01): due day = day-of-month of run − 18. The row for the month containing run − 18 is unpaid, and so exactly 18 days late. If run − 18 falls in last month (run day ≤ 18), that row belongs to last month, and this month's row is *Due*, not late. This is realistic, and L-04's month stepper shows it.
- 2A (SC-02): the same rule with 5 days.
- F1 (SC-03): due day = the run date's own day. ₹8,000 of ₹12,000 is paid 2 days before the run date (never before the 1st), so the row is *Part paid — ₹4,000 pending*, due today, and not late.
- Every other tenancy is due on the 5th.

Day-of-month values of 29–31 are clamped to the month's last day in shorter months.

## 4. Scenario catalogue

| ID | Situation | Data | Where it should show |
|---|---|---|---|
| **SC-01** | Rent ~18 days overdue | 4C, ₹18,000 unpaid, 18 days late. Reminders: gentle on day 3 and direct on day 10 (both via WhatsApp, confirmed sent), then a call logged on day 15 ("promised to pay"). No formal reminder yet. | L-03 Outstanding and Needs attention rule 2 · L-04 danger chip "18 days late" · L-05 timeline · S-01 context "Rent · 18 days overdue" |
| **SC-02** | Rent ~5 days overdue | 2A, ₹18,000 unpaid, 5 days late. One gentle reminder on day 3. | L-03 rule 4 · L-04 warning chip |
| **SC-03** | Part-paid rent | F1, ₹8,000 received of ₹12,000; ₹4,000 pending; receipt issued for ₹8,000 | L-04 "Part paid — ₹4,000 pending", Pending filter · T-05 receipt for ₹8,000 |
| SC-04 | Payment-history texture | 2A paid every third month 6 days late, with a gentle reminder each time | L-11 paid-on-time % below 100 · L-05 history |
| SC-05 | Ordinary tenancy | 4B, always paid 2 days early | L-04 Paid · L-09 lifetime figures |
| SC-10 | Renewal history | 1A has three 11-month terms (₹14,500 → ₹15,200 → ₹16,000) | L-11 agreement history · L-09 Rent tab · rent changes by term |
| **SC-11** | Agreement expired | 3A ended 14 days ago; tenant still living there, rent continuing at the old ₹17,000 | L-12 top row "Expired 14 days ago" · L-03 rule 3 |
| **SC-12** | Expiring < 30 days | 3B ends in 22 days | L-12 danger chip · L-03 rule 3 |
| SC-13 | Expiring 30–60 days | 4A ends in 45 days | L-12 warning chip · L-03 rule 6 |
| SC-14 | Expiring 60–90 days | F2 ends in 75 days | L-12 neutral chip · L-03 rule 6 |
| **SC-20** | Urgent, new | 1B "Geyser is leaking from the bottom since yesterday.", reported 21:40 last night via the tenant link, with a photo | L-03 rule 1 (top) · L-06 New |
| SC-21 | New, older than 48 hours | G1 dripping kitchen tap, 3 days old | L-06 warning left border |
| SC-22 | New, older than 7 days; phoned in | 4A stiff balcony lock, 9 days old, reported by "phone call" (L06-BTN-NEW) | L-06 danger left border |
| SC-23 | Assigned | 3A slow ceiling fan → Ramesh Electricals | L-06 Assigned · T-03 "Assigned" |
| SC-24 | In progress | F2 bathroom seepage → Deshmukh Waterproofing | L-06 In progress · L-03 rule 5 (oldest open) |
| SC-25 | Repeated category | 1B plumbing reported 4 times in 12 months (300, 190 and 75 days ago, plus today's geyser) | L-09 Maintenance tab note "Plumbing reported 4 times in 12 months." |
| SC-26 | Done with cost and photos | 2A washing-machine inlet leak, ₹850, before and after photos | L-07 gallery · L-09 spend |
| SC-27 | Done, explicit "no cost" | 1A doorbell, loose wire tightened | L-06 Done rule (cost or "no cost") |
| SC-28 | Done, tenant liable | 4C cracked window pane, ₹1,200, tenant liable, payment request not yet paid | L-07 TENANTLIABLE → S-02 · a candidate for the L-13 double-charge question |
| SC-29 | Done, no photos | S1 cockroaches, pest control ₹1,500 | |
| **SC-30** | Notice given | S1 gave notice 20 days ago with a 30-day period, so she leaves in 10 days. The agreement runs longer. | L-08 "Notice period" chip · L-10 "On notice" filter |
| **SC-31** | Move-out and settlement | 2B, Arjun Mehta: two terms, ended 25 days ago, settled 12 days ago. Deposit ₹51,000. Deductions: repaint ₹3,500 (photo) · window latch ₹600 pulled from repair history (photo carried over) · deep cleaning ₹1,500 (**no photo**, so a warning). Refund due ₹45,400. Statement is read-only. Move-out photos exist. | L-13 · P-02 · L-14 statement document · E4-2 former-tenant link |
| SC-32 | Never let | S2 has no tenancy, ever | L-08 Vacant · L-04 shows no row (vacant units don't appear) |
| **SC-40** | Missing move-in photos | G1 (moved in last month) has no move-in condition photos. It is the only active tenancy without them. | L-09 Photos tab empty for this tenancy · success measure "units with move-in photos" |
| SC-41 | Missing ID proof | 4C has no ID proof document | L-11 documents |
| SC-42 | No email | 4C has no email address | S01-BTN-EMAIL hidden |
| SC-43 | Mid-month move-in | G1 moved in on the 12th of last month; the first row is pro-rata (e.g. ₹6,333 of ₹10,000) | L-04 "pro-rata" note |

## 5. Rent rules used to generate rows

- One row per tenancy per month, from the move-in month up to the run date's month (or the move-out month). Vacant months have no row.
- **Amount** = the rent of the agreement in force on the 1st of that month. Once the last term has expired (3A), the last term's rent continues.
- **First month.** If move-in is after the 1st, the row is pro-rata (rent × days remaining ÷ days in month, rounded to the rupee), due and paid on the move-in date.
- **Payments.** On-time tenants pay 2 days before the due date, never before the 1st. Any payment dated after the run date is dropped, which makes that row *Due* (or *Overdue* if the due date has passed).
- **Status** (derived): *Paid* when the amount is fully received · *Part paid* when something has been received · *Overdue* when unpaid and the due date is before the run date · *Due* otherwise.
- **Payments are a list per row** so SC-03 can carry a second instalment later; how the schema stores this is an open question (§9).
- **Receipt numbers** `RR-0001…` are gapless, one per payment, in payment-date order. Every seventh payment has no reference (the reference is optional, per L-04); the others carry a 12-digit UPI reference generated deterministically.
- **Reminders** are recorded only as confirmed sends (S-01 "Did you send it?" → Yes), plus logged calls.

## 6. Other judgement calls

- **Agreements** are 11-month leave-and-licence terms, which is the Pune norm. Renewals are new terms, not edits to the old one.
- **Notice period** is 30 days.
- **Request numbers** `R-0001…` are assigned in report order. Timelines are derived: reported → assigned (with a "job sent to vendor" message) → in progress → done (with the cost or "no cost").
- **Tenant-facing status words** map New → Received, Assigned → Assigned, In progress → In progress, Done → Done (T03-CHP-STATUS).
- **Categories** use L-07's list. The 4A lock is filed under "Other".
- **Unit types** are 1RK, 1BHK and 2BHK; the source gives no list.
- **Documents.** Every tenancy has one agreement per term, an ID proof (except 4C), and six move-in photos (except G1). Requests have before and after photos where noted, and 2B has move-out photos and a read-only settlement statement. Every photo has descriptive alt text (E5). All files are placeholders (`file: null`).
- **Not seeded:** rent receipts as stored documents (whether P-01 receipts are stored is a schema decision), unit and tenant link tokens (generated by the app), and the assistant's suggested category and urgency.

## 7. Expected screens for run date 2026-10-18 (worked example)

`node scripts/seed/build.mjs --date 2026-10-18 --summary` prints all of this.

- **L-03 cards:** Occupied 12 / 14 (vacant: 2B, S2) · Collected this month ₹1,41,500 · Outstanding past due ₹36,000 across 2 units, which matches the scope wireframe's "DUES 36k". Another ₹22,000 is pending but not yet due (F1 ₹4,000 and 4C's October ₹18,000). Agreements expiring within 90 days: 4, including the expired one.
- **L-03 Needs attention**, in order:
  1. 1B urgent geyser
  2. 4C rent 18 days overdue
  3. 3A agreement expired 14 days ago
  4. 3B agreement ends in 22 days
  5. 2A rent 5 days overdue
  6. F2 seepage (12 days, oldest open)
  7. 4A lock (9 days)
  8. 3A fan (4 days)
  9. G1 tap (3 days)
  10. 4A agreement ends in 45 days
  11. F2 agreement ends in 75 days
- **L-04 October 2026:** 10 Paid · 2A Overdue 5 days · F1 Part paid ₹4,000 pending · 4C Due on 30 Oct. September shows 4C Overdue 18 days, due 30 Sep.
- **L-06:** New 3 (1B urgent, G1, 4A) · Assigned 1 · In progress 1 · Done 8.
- **L-12** by days remaining: 3A −14 · 3B 22 · 4A 45 · F2 75 · …
- **L-13:** 12 deposits held totalling ₹4,83,000. One settlement: 2B, held ₹51,000, deductions ₹5,600, refundable ₹45,400.
- **Record counts:** 13 tenancies, 179 rent entries, 176 payments, 6 reminders, 13 requests, 119 documents.

## 8. Verifying it

`node scripts/seed/check.mjs --from 2026-01-01 --days 1200` builds the dataset for every run date in the range and asserts each scenario above. The checks cover the 14/12/2 shape, exactly two overdue rows (18 and 5 days), one part-paid row with ₹4,000 pending, nothing dated after the run date, every request inside its tenancy, the three L-06 ageing bands, the four agreement bands, notice, settlement arithmetic, the single missing-photo tenancy, and gapless receipts. It passes for 2026-01-01 through 2029-04 (including the 2028 leap year).

## 9. Schema-dependent work — TODO

These decisions belong to the schema (and, upstream, to the spec's open questions). The loader can't be written until they're made.

| TODO | Seed today | Needs deciding |
|---|---|---|
| Table and column names for every entity | seed-domain keys | the schema |
| Money storage unit | whole rupees | rupees or paise |
| Payments per rent entry | list per row | separate table, or fields on the rent entry (part payments) |
| Agreement terms | list per tenancy | separate entity, or fields on the tenant (renewal history) |
| Rent due day | per tenancy | on the agreement, the unit, or the landlord |
| Notice | given-on date plus period on the tenancy | how "notice status" is stored |
| Tenant link tokens | not generated | one per unit, per tenancy, or both |
| Vendors | own list, referenced by key | entity, or free text on the request |
| Request timeline / audit | derived event list | audit or event storage |
| Settlement and deductions | own record | entity shape; read-only and protected documents |
| Documents and photos | metadata, `file: null` | storage bucket, paths, placeholder images |
| Receipts as documents | not stored | whether P-01 receipts are stored rows |
| Assistant suggestions | not seeded | separate suggested category/urgency fields |
| Demo-database guard | none | how `load.mjs` recognises a safe target |
| Second landlord for E4 cross-landlord tests | not included | whether the demo carries a second, isolated landlord |
