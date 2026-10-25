# RentRoll demo script — five slices

Built from `spec/` only. Every click names the element ID it lands on, so a slide, a bug or a question can be traced back to a spec line. Screen IDs are in `spec/index.md`; element IDs are in `spec/screens/<ID>.md`; D-nn are in `spec/decisions.md`.

## Before you start

Two devices, one account:

- **Tenant phone** — any phone with the *tenant's link* (`tenancy.tenant_token`, D-01) for Flat 2A, Kulkarni Apartments, opened in the browser. Not the door QR: the door link reaches only T-01 and T-02 (D-02), and slices 3 and 5 need T-05 and E4-2.
- **Landlord phone or laptop** — signed in (L-01), landing on L-03.

Seed state the demo assumes (the seed PR provides it; check before going on stage):

| Needs | Why |
|---|---|
| Flat 2A occupied by an active tenancy with a `tenant_token`, deposit recorded, agreement ending within 30 days | Slices 1, 4, 5 |
| Today after the rent due day for the current month, with at least one tenancy 10+ days late and one paid | Slice 2 needs a Direct-tone row; slice 3 needs an unpaid row |
| At least one Done request on Flat 2A with a cost and a before photo | Slice 5 pulls it into the settlement |
| Landlord profile with name, phone, UPI ID, receipt name and logo set (L-15) | T-01 call button, P-01 branding, S-02 QR |
| Escalation default set in L-15 | L12-FLD-ESCALATION starts non-zero |

Rules that hold on every slice, and that a prospect may ask about:

- **G-1.** Nothing is ever sent by the app. Every message ends in S-01's "Did you send it?" and only Yes writes history (D-17). Say this out loud the first time it appears.
- **G-2.** The tenant pages never show rent due, balances, costs, other units or other tenants. The one exception is the tenant's own payment amounts on T-05 and its receipt (D-26). Have E4-4 ready if asked.
- Dates read `DD MMM YYYY`; money reads `₹1,86,000` (D-19). If a number looks off, it is the seed, not the formatter.

---

## Slice 1 · A tenant reports a leak on their phone and I see it on mine

**The sentence.** The tenant stops wondering whether anyone heard them, and the landlord stops taking the call.

**Tenant phone — T-01, from the saved link.**

1. Open the tenant link. T01-HDR shows the landlord's name and "Flat 2A, Kulkarni Apartments" and nothing else. Point out: no sign-in, no menu.
2. T01-SEL-CATEGORY → **Plumbing**.
3. T01-FLD-DESC → type "Geyser is leaking from the bottom since yesterday." (the spec's own placeholder; minimum 10 characters).
4. T01-UPL-PHOTO → **Add a photo** → take one of anything. The thumbnail appears before the upload finishes (S-04).
5. T01-SEG-URGENCY → leave **Normal**, or tap **Urgent** if you want the request at the top of the dashboard (L-03 rule 1).
6. T01-FLD-NAME and T01-FLD-PHONE are already filled from the tenancy. Leave them.
7. T01-BTN-SUBMIT → spinner → **T-02**.
8. T-02 reads "Reported. Your request number is R-0412." and "Your landlord will see this on their board." (D-28: the app does not notify anyone, and the screen does not pretend to). T02-SEC-SUMMARY shows what was captured.
9. Tap T02-BTN-SAVE → **Save this link** so the share sheet appears, then dismiss it. Say: this is the moment we ask them to keep the link.

**Landlord phone — L-03, already open.**

10. Pull to refresh L-03. The new request is in L03-LST-ATTENTION: icon · "2A" · "Plumbing · Geyser is leaking…" · chip · **Open**. If you chose Urgent it is row 1.
11. Tap **L03-BTN-ROWOPEN** → **L-07** opens over the dashboard.
12. L07-SEC-REPORT shows the tenant's words verbatim with their name and the date. L07-GAL-PHOTOS shows the photo. L07-SEL-CATEGORY already reads Plumbing, set by the assistant (D-21); the header chip shows the urgency, which the assistant may raise but never lower.
13. Tap **L07-BTN-DISPATCH** → **S-01** opens with a vendor draft: the problem, "Flat 2A, Kulkarni Apartments, <address>" (D-34), the tenant's phone, a Maps link. Recipient is the vendor, not the tenant.
14. Read the draft aloud. Edit one word in S01-FLD-MESSAGE to show it is a real field.
15. Tap **S01-BTN-WHATSAPP** → WhatsApp opens with the text → come back → S01-STATE-CONFIRMSEND asks "Did you send it?" → **Yes**.
16. L-07's status flips New → Assigned (D-32) and L07-TML-HISTORY gains "Assigned" and the message.

**Tenant phone — T-03.**

17. Tap T02-BTN-TRACK → **Check the status**. T03-CHP-STATUS on R-0412 reads **Assigned**. Expand it: the timeline reads Reported, Assigned. No vendor name, no rate, no other flat (D-30).

---

## Slice 2 · Rent day, and the right words are already written

**The sentence.** Landlords avoid chasing early because the words feel rude; here the words are ready on day three, and nothing goes out until the landlord presses send.

**Landlord laptop — L-04.**

1. From L-03 tap **L03-CRD-DUES** ("Outstanding", in danger colour) → **L-04** opens with the **Overdue** filter applied and the URL `/rent?month=…&status=overdue`.
2. L04-STRIP-SUMMARY shows expected, collected, outstanding for the month. L04-TBL-RENT lists only unpaid rows past their due date; L04-CHP-STATUS reads "n days late", warning at 1–9 days, danger at 10+. Say: the due date is the tenant's own due day (D-09), not the 1st.
3. Tap **L04-SEG-FILTER → All**. Paid rows show the print icon (L04-BTN-RECEIPT); unpaid rows show **Remind** and **Mark paid**. The filter changed the URL and nothing reloaded.
4. Pick the row that is 10+ days late. Tap **L04-BTN-REMIND**.
5. **S-01** opens. S01-HDR: "Message to Suresh Khan · Flat 4C". S01-CHP-CONTEXT: "Rent · 12 days overdue · Level 2 of 3 · m sent", where m counts reminders already confirmed on this row (D-38). S01-SEG-TONE is pre-selected **Direct** because 12 days is past the ladder's day 10 (L-15 default 3 / 10 / 20).
6. Tap **Formal** on S01-SEG-TONE. The draft regenerates and now refers to "our agreement dated <start>" (D-38). Tap **Direct** again. If you edited the text first, the "This will replace your edits." warning appears; say so.
7. S01-CHK-PAYLINK is ticked. Point at it: the UPI link is a plain `upi://pay` intent (D-27); there is no RentRoll payment page for the tenant to land on.
8. Tap **S01-BTN-REGENERATE** → **Write it differently**. A new draft arrives; the previous one is restorable.
9. Tap **S01-BTN-COPY** → toast "Copied." → "Did you send it?" → tap **Not yet**. The composer returns with the draft intact and nothing is written. Say: this is G-1 in code.
10. Tap **S01-BTN-WHATSAPP** → WhatsApp opens → come back → **Yes**. Toast E1-02: "Reminder recorded on the tenant's history."
11. Tap the same row (L04-ROW) → **L-05** opens as a panel. L05-TML-REMINDERS shows the reminder: level Direct, now, WhatsApp. L05-SEC-TENANT shows the phone with call, message and copy.
12. Tap **L05-BTN-LOGCALL** → L05-FRM-LOGCALL → outcome **promised to pay**, note "Will pay Friday" → save. The call joins the timeline (D-17). Calls appear in the history but do not change next time's tone (D-38).

**Do not** open S-01 a second time on the same row and press Yes unless you mean it: the context chip's "m sent" count is live data.

---

## Slice 3 · Mark it paid, and the tenant has a receipt without asking

**The sentence.** The landlord records the payment once; the tenant gets a numbered receipt they can print for proof of rent, and still never sees a rent figure anywhere else.

**Landlord laptop — L-04, still open.**

1. On an unpaid row tap **L04-BTN-MARKPAID**. L04-FRM-MARKPAID opens inline: amount pre-filled with the balance, date today, reference blank.
2. Change the amount to something smaller than the rent (a part payment). Type a reference "UPI 4471". Confirm.
3. Toast E1-01: "Payment recorded. Receipt RR-0847 created." with **Undo** for 10 seconds (D-11, the one 10-second toast). Let it expire; say that Undo voids rather than deletes, so a receipt number is never reused.
4. The row stays unpaid: L04-CHP-STATUS shows the sub-line "Part paid — ₹4,000 pending" and the row sits in Pending or Overdue by its due date (D-10). **Mark paid** is still there, pre-filled with the balance and capped at it.
5. Tap **Mark paid** again → confirm the balance. The row flips to **Paid**; the buttons are replaced by the print icon. Two receipts, two numbers.
6. Tap **L04-BTN-RECEIPT** → **P-01** opens in a new tab with the print dialog. Show: receipt name and logo, RR number, tenant, unit, month, amount in figures and in words with lakh grouping (D-19), date, reference, a payment QR with no amount (D-26), a signature line. Cancel the dialog.
7. Tap the row → **L-05**. L05-SEC-AMOUNT lists both payments with their receipt numbers. L05-BTN-REMIND and L05-BTN-MARKPAID are gone on a Paid row; L05-BTN-PAYLINK remains (D-25).

**Tenant phone — T-05.**

8. On T-01 tap the footer link **T01-LNK-RECEIPTS** (D-03) → **T-05 My receipts**. T05-LST-RECEIPTS shows month · amount · receipt number · a 48×48 print button, for this tenancy only, voided payments excluded. These amounts are the tenant's own payments, the single G-2 exception (D-26).
9. Tap **T05-BTN-PRINT** → **P-01** renders identically, without sign-in. Point out what is *not* on any tenant page: the rent due, the balance, next month, any other flat.
10. Tap **T01-LNK-MYUNIT** → **T-04 My unit**: unit, property, landlord, agreement dates, Call and WhatsApp buttons. **No rent figure**, by design.

If a prospect asks "could a tenant change the link to see another flat?", alter one character of the token in the address bar: E1-10 "This link is not valid…" (E4-3). Never "not found".

---

## Slice 4 · Nothing expires unnoticed

**The sentence.** Renewing before expiry instead of after is the clearest money the product saves, and the new rent is already worked out when the warning appears.

**Landlord laptop — L-12.**

1. From L-03 tap **L03-CRD-EXPIRING** ("Agreements expiring", warning colour) → **L-12** opens with the 90-day window.
2. L12-STRIP-TOTAL: "3 agreements ending in the next 90 days · ₹54,000 monthly rent at stake". L12-TBL-AGREEMENTS is sorted by days remaining; L12-CHP-COUNTDOWN is danger under 30, warning 30–60, neutral 60–90. Any already-expired agreement sits at the top in danger, "Expired 14 days ago", and never hides.
3. Tap **L12-SEG-WINDOW → 30 days**. The list shrinks to Flat 2A.
4. On Flat 2A change **L12-FLD-ESCALATION** from the settings default to 10. The Suggested new rent column recalculates in the row, rounded to the rupee (D-19). Change it back.
5. Tap **L12-BTN-CALENDAR**. Toast E1-05: "Added — open the file to save it to your calendar." The file holds the expiry date with a 30-day reminder. Open it if the laptop has a calendar app.
6. Tap **L12-BTN-NOTICE** → **S-01** with the renewal draft: current rent, new rent, effective date (the day after the current end, D-08). No tone selector: tone is for rent reminders only (D-38). Edit, **Open in WhatsApp**, come back, **Yes**.
7. Tap **L12-BTN-RENEW** → inline form: new start (pre-filled with the day after the current end), new end, new rent (pre-filled with the suggestion). Save.
8. The row leaves the 30-day list. Tap **L12-SEG-WINDOW → All**: Flat 2A reappears with its new end date (D-08). Say: the old term was not overwritten, a new agreement row was added, and months already generated keep the old amount.
9. Sidebar → **Tenants** (L-10) → the Flat 2A tenant → **L-11**. L11-SEC-AGREEMENT shows the current term, and the earlier term listed beneath it. L11-SEC-PAYMENTS shows every month with a paid-on-time percentage at the top.
10. Optional, if the story needs it: **L11-BTN-RECORDNOTICE** → notice given today, vacating in 30 days → save. L-08's chip for Flat 2A becomes "Notice period" and L-10's **On notice** filter finds it (D-13). The agreement itself does not change.

---

## Slice 5 · A calm settlement instead of a row

**The sentence.** Move-in photos, every repair and every cost have been waiting for this day, so the deposit becomes a signed document instead of an argument.

This slice ends the Flat 2A tenancy. Do it last, and reseed before the next demo.

**Landlord laptop — L-11 → L-13.**

1. On **L-11** tap **L11-BTN-ENDTENANCY** (Danger). The confirm dialog asks for the move-out date, default today. Confirm. The tenancy is now `ended` (D-05): no more rent rows, Flat 2A shows Vacant on L-08, and the tenant's link stops working (next page).
2. The app routes to **L-13** at `/deposits/:tenantId`. L13-SEC-DEPOSIT shows amount held, date received, agreement reference.
3. Tap **L13-BTN-FROMREQUESTS** → **Pull from repair history**. The list shows every Done request on this tenancy with a cost; the geyser from slice 1 (now Done with a cost in the seed) is there with its photo. A tenant-liable repair would be unticked with "Tenant liable — payment requested on <date>" (D-35). Tick the geyser. Confirm.
4. L13-TBL-DEDUCTIONS gains the row with description, reason, amount and the photo carried across. Add a second row by hand: "Wall repainting", reason "Marks beyond normal wear", an amount, no photo. The missing photo shows a warning and saves anyway; a missing reason would not.
5. L13-SEC-BALANCE: deposit held − deductions = refund due, large. If you want the owed-by-tenant state, raise a deduction above the deposit: the balance turns danger and the wording becomes "Balance owed by tenant" (D-18). Put it back.
6. Tap **L13-BTN-GENERATE** → **Prepare settlement statement**. The assistant's draft lands in L13-FLD-STATEMENT, editable, with the template fallback after four seconds if needed (E1-09). Read one sentence aloud; change one word.
7. Tap **L13-BTN-PRINT** → **P-02** in a new tab: landlord name and logo, unit and property, tenant, tenancy dates and terms, deposit held and date, the deductions table with thumbnails, total, balance line, the statement text, two signature lines (D-18). Cancel the print dialog.
8. Tap **L13-BTN-SEND** → **S-01** with the settlement summary → **Copy** → **Yes**. The summary is what the tenant receives; the full statement is the printed page.
9. Tap **L13-BTN-CLOSE** → **Mark settled** → confirm. Status becomes `settled`; the rendered statement is filed as a protected document (D-15); L13-BTN-CORRECT appears for later corrections, which supersede rather than edit.
10. Sidebar → **Documents** (L-14). The statement row's delete is disabled with "Settled statements cannot be deleted". Say: the server refuses too.

**Tenant phone — the former tenant's link.**

11. Reload the tenant link from slice 1. E1-10: "This link is not valid. Please ask your landlord for your unit link." (E4-2). No hint, no "not found". The receipts they printed in slice 3 are still theirs on paper; after move-out they ask the landlord, who prints from L-04 or L-09 (D-05).
12. Optional close: on **L-09** for Flat 2A, show L09-TAB-OVERVIEW's lifetime figures, "earned ₹2.1 lakh and cost ₹34,000", and L09-TAB-PHOTOS with the move-in photos grouped by the tenancy that just ended. **Add tenant** (L09-BTN-ADDTENANT) is now visible. That is the next landlord's slice 1.
