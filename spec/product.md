# RentRoll — Product

Source: *RentRoll Product Scope Document, Version 1.0 — scope, workflows and diagrams* (Future Agents).
Wording is kept from the source. Diagrams are transcribed as text. Lines starting `> OPEN:` are conversion notes, not source.

| | |
|---|---|
| PRODUCT | A web app for landlords and tenants |
| PURPOSE | Make renting organised, transparent and tension-free |
| BUILT FOR | Landlords with 5 to 50 units; PG and co-living operators |
| USERS | Landlord (signs in) and tenant (opens a link) |

---

## 1. Executive summary

RentRoll is a web app that keeps a rental business in one place. The landlord signs in and sees everything — who has paid, what is broken, which agreement is about to expire. The tenant does not sign in at all. They open one link, saved once, and use it to report a problem or check its status.

Most small landlords in India run their properties on a diary, a spreadsheet and a WhatsApp group. That works until it doesn't. Rent goes uncollected because nobody is certain who has paid. An agreement expires without anyone noticing and months pass at the old rent. A deposit argument at move-out is settled by whoever remembers more confidently, because nobody has a photo.

None of these are dramatic failures. They are quiet leaks, and they repeat every month.

RentRoll fixes them with four ideas:

- **One record for every unit.** Rent history, photos, repairs and documents live together, for years.
- **Dates that watch themselves.** Rent due dates and agreement expiry are tracked by the app, not by memory.
- **A link for the tenant.** No account, no password, no app to install. One page they can use in two minutes.
- **Everything ready to send.** Reminders, receipts and notices are drafted for the landlord to review and send in one tap.

The result the landlord feels is simple: they stop carrying the rental business in their head.

## 2. The problem we are solving

### What the landlord lives with today

- **Uncertainty about money.** Rent arrives by UPI to a personal number. The notification is buried. On the 12th, they are not sure who has paid.
- **Avoiding the awkward message.** They do not chase on day three because it feels rude, so they wait until day twenty-five and then send something sharper than they meant to.
- **Dates that slip past.** Nothing announces an expiry. An agreement that lapsed in November is discovered in March, and four months of escalation are gone.
- **Interruptions.** Maintenance arrives as phone calls at inconvenient hours, and half are forgotten by the next morning.
- **Arguments without evidence.** At move-out, nobody has a photo of how the flat looked at move-in. The deposit is returned in full because arguing is not worth it.
- **March panic.** The accountant reconstructs a year of rental income from bank statements, because no receipts were ever issued.

### What the tenant lives with today

- No receipt, which becomes a problem when they need proof of rent paid.
- No idea whether their repair request was noted, or when someone is coming.
- Uncertainty about the exact amount and where to send it.
- At move-out, a deposit deduction with no explanation attached.

**The insight:** both sides want the same thing — a clear record. The landlord wants to know what is owed. The tenant wants proof of what they paid and what they reported. One shared record solves both, and removes most of the tension between them.

## 3. Product vision and design principles

*A rental business should feel like a tidy folder, not a memory test.*

| ID | Principle | What it means in the product |
|---|---|---|
| PR-1 | The tenant never signs up | A tenant who must create an account to report a leaking tap will call instead. One saved link, no password, works on any phone. |
| PR-2 | Nothing sends by itself | Every message is drafted by the app and sent by the landlord. A firm reminder sent automatically to someone who paid yesterday damages a relationship permanently. |
| PR-3 | Money stays private | The tenant's pages never show rent figures, repair costs or anything about other units. |
| PR-4 | Dates are the product | Rent due and agreement expiry are the two things the app watches so the landlord does not have to. |
| PR-5 | Evidence, always | Photos at move-in, photos on every repair, a written reason on every deduction. This is what makes settlement calm. |
| PR-6 | One tap to act | Wherever the app shows a problem, the action to fix it is on the same screen. |

(Principle IDs PR-1…PR-6 assigned in conversion.)

## 4. Who uses the product

| | Landlord | Tenant |
|---|---|---|
| How they get in | Signs in with email and password | Opens a saved link. No account. |
| How often | A few times a week; more around the 1st to 10th | A few times a year, when something breaks |
| On what | Laptop mostly, phone sometimes | Phone, almost always |
| What they see | Everything — all units, all money, all history | Only their own unit, and no money |
| What they want | To know nothing is slipping | To be heard, and to have proof |

One landlord has many properties. Each property has many units. Each unit has one current tenant and a history of past tenants. Every tenant gets their own unit link.

> OPEN: "Every tenant gets their own unit link" (here) vs "its own reporting link" on UNIT (§15) and "one unguessable token per unit" (T-01). Is the link per tenant/tenancy or per unit? See T-01.

## 5. User journey map (Diagram 1)

The full relationship, from setting up a property to settling a deposit. Read it left to right — the app column shows what happens without anyone asking.

| Stage | Landlord does | Tenant does | The app does | Result |
|---|---|---|---|---|
| 1 · Setting up | Adds properties and units. Enters rent, deposit and his UPI ID. | Not involved yet | Creates a link and a printable QR for every unit. | Everything is in one place. |
| 2 · Move-in | Adds the tenant, agreement dates, and photos of the flat's condition. | Gets a welcome message with their unit link. Saves it. Sees the QR too. | Stores the photos. Starts counting down to agreement expiry. | Both sides agree on the starting point. |
| 3 · Every month | Glances at dues. Sends the drafted reminder. Marks payment received. | Taps the pay link, amount already filled. Receives a numbered receipt. | Creates the month's rent rows, drafts reminders, issues the receipt. | No chasing and no guessing. |
| 4 · Something breaks | Assigns a vendor, sends him the address, records what it cost. | Opens the link, reports the problem with a photo. Checks status later. | Sorts the request, keeps its status, files the cost against the unit. | No late-night calls. Nothing forgotten. |
| 5 · Renewal | Reviews what is expiring. Sends the renewal notice with new rent. | Confirms renewal, or gives notice. Knows the new rent in advance. | Warns at 90, 60 and 30 days. Works out the escalated rent. | No agreement ever lapses again. |
| 6 · Move-out | Notes deductions with a reason and a photo for each one. | Receives a written settlement showing every deduction and its photo. | Builds the statement from the deposit ledger and the repair history. | A calm settlement instead of a row. |

*Diagram 1 — User journey map. Six stages of the landlord-tenant relationship, showing what each side does, what the app quietly handles, and what changes as a result.*

> OPEN: Stage 2 "adds … photos of the flat's condition" — no UI/UX screen defines a capture flow for move-in condition photos. L-09 Photos tab only displays them; L09-BTN-ADDTENANT "Opens the tenant form", which is not specified anywhere.
> OPEN: Stage 2 "Gets a welcome message with their unit link" — no UI/UX screen opens S-01 with a welcome message.
> OPEN: Stage 5 tenant "Confirms renewal, or gives notice" — no tenant screen (T-01…T-05) offers this, and no landlord screen records notice (see L-12).

## 6. What the product does — the eight modules

Eight modules. The first four are what the landlord uses most weeks; the last four are the ones that prevent the expensive mistakes.

| ID | Module | What it shows | What the landlord can do from it | Screens |
|---|---|---|---|---|
| M-1 | Portfolio dashboard | Occupied against vacant, collected this month, dues outstanding, agreements expiring soon, income over time | Jump straight to whatever is red. This is the "is anything wrong" screen. | L-03 |
| M-2 | Rent due board | A grid of month against unit — paid, pending, or overdue by so many days | Send the drafted reminder, share a payment link, mark payment received, issue and send the receipt | L-04, L-05, P-01 |
| M-3 | Tenant request portal (the tenant's page) | To the tenant: a simple form and the status of what they reported | Nothing — this page belongs to the tenant. No rent, no costs, no other units. | T-01…T-05 |
| M-4 | Maintenance board | Every request by status, with photos, the vendor assigned and what it cost | Assign a vendor with the address, update the tenant, record the cost against the unit | L-06, L-07 |
| M-5 | Unit register | Every unit, its rent, its deposit, its condition photos and its full repair history | Add units, print the door QR, review what a unit has cost over the years | L-08, L-09, P-03 |
| M-6 | Tenant record | Contact details, agreement dates, rent paid to date, deposit held, documents | Call, message, share the unit link, attach the agreement | L-10, L-11 |
| M-7 | Agreement tracker | Everything expiring in 90, 60 and 30 days, with the renewal value calculated | Send a renewal notice, add the date to a calendar, record a notice served | L-12 |
| M-8 | Deposit and settlement | Deposit held, each deduction with its reason and photo, the balance due back | Build the settlement statement, print it, send it to the tenant | L-13, P-02 |

(Module IDs M-1…M-8 and the Screens column assigned in conversion.)

**Deliberately not in the product:** listing vacant flats, tenant background checks, accounting software integration, and anything that sends a message without the landlord reading it first. Each of these either belongs to someone else's product or breaks a principle above.

> OPEN: M-2 describes "a grid of month against unit"; L-04 specifies a single-month table with a month stepper (L04-SEL-MONTH). Which is v1?
> OPEN: M-6 "share the unit link" — L-11 has no share-link element; the unit link's copy/share lives on L-09.
> OPEN: M-7 "record a notice served" — L-12 has no element for this (see L-12).
> OPEN: M-8 "send it to the tenant" — L13-BTN-SEND opens S-01 "with the settlement summary"; whether the assistant-written statement (§11) is what is sent is not stated.

## 7. Screen wireframes (Diagram 4)

Three representative layouts. These show arrangement and priority only — not colour, styling or final wording.

**A · Portfolio dashboard** — header "RentRoll", "Account". Stat row: OCCUPIED 12/14 · COLLECTED 2.1L · DUES 36k · EXPIRING 3. Panel "INCOME, LAST 6 MONTHS". Panel "NEEDS ATTENTION":
- 4C · rent 18 days overdue — Remind
- 3B · agreement ends in 22 days
- 1B · geyser leaking, urgent — Open
- 2A · rent 5 days overdue — Remind

**B · Rent due board** — "Rent · February 2026", filters "All units", "Overdue", button "Export". Table UNIT / TENANT / RENT / STATUS:
- 1A · R. Sharma · 16,000 · Paid
- 1B · A. Iyer · 16,000 · Paid
- 2A · M. Desai · 18,000 · 5d late
- 4C · S. Khan · 18,000 · 18d late

Detail: "4C · S. KHAN · 18 DAYS LATE" — "Drafted reminder — firm tone, states amount and due date. Edit before sending." Buttons: Send · Pay link · Mark paid.

**C · Tenant page (phone)** — "Flat 2A · Report a problem". WHAT IS THE PROBLEM? (Plumbing ▾) · DESCRIBE IT ("Geyser is leaking from the bottom...") · ADD A PHOTO (+ Photo) · HOW URGENT? (Low · Normal · Urgent) · Submit · "Your earlier reports (2)".

*Diagram 4 — Wireframes. The dashboard leads with what needs attention. The rent board puts the drafted message and the three actions on the same screen as the problem. The tenant page is one short form with no sign-in and no mention of money.*

> OPEN: Wireframe A orders Needs attention as rent 18 days overdue → agreement 22 days → urgent geyser → rent 5 days. L-03's ordering rules put urgent maintenance first. L-03 rules are taken as authoritative unless decided otherwise.
> OPEN: Wireframe B shows "18d late" with "firm tone"; the ladder (§10, L-15) puts day 10 at direct and day 20 at formal. See S-01.

## 8. Information architecture (Diagram 5)

Two separate worlds sharing one set of records. Everything on the left needs a sign-in; everything on the right needs only a link.

- **Landlord workspace** — requires sign-in: Portfolio dashboard · Rent due board · Maintenance board · Agreement tracker · Unit register · Tenant records · Deposit & settlement · Documents & exports
- **Tenant link** — one link per unit, no sign-in: Report a problem · Track what I reported · My unit and contact details · My receipts
- Both sides read and write the same shared records.

*Diagram 5 — Information architecture. Eight landlord sections, four tenant pages, one shared set of records underneath. The tenant side has no path to any money screen.*

> OPEN: "The tenant side has no path to any money screen" vs "My receipts" (T-05), which shows amounts. See T-05.

## 9. User flow diagram (Diagram 2)

The exact screens each user moves through, and what they can do at each stop.

**Tenant · no sign-in**
1. Opens the saved unit link
2. Reports a problem — category · description · photo · urgency
3. Sees a confirmation with a request number
4. Returns to the same link later to check status, or to find a receipt
- Also arrives by message: rent reminder with a payment link, receipt, and status updates

**Landlord · signs in**
1. Signs in
2. Portfolio dashboard — what needs attention today
3. Then one of:
   - Rent due board → Send reminder · Share payment link · Mark paid → receipt · Print or export
   - Maintenance board → Assign a vendor · Send him the address · Record the cost · Update the tenant
   - Agreement tracker → Send renewal notice · Add date to calendar
   - Units & tenants → Add a unit or tenant · Upload condition photos · Share the unit link · Print the door QR
   - Settle a deposit → Print the statement

*Diagram 2 — User flow. The tenant's path is three screens deep and needs no account. The landlord always starts at the dashboard, which routes to whichever board holds today's problem; every board carries its own actions.*

## 10. Rent lifecycle flowchart (Diagram 3)

The one rule set worth writing down precisely: what happens to a month's rent from the day it is due. Every reminder is drafted by the app and sent by the landlord — the app never sends on its own.

1. **1st of the month** — a rent row is created per unit.
2. **Paid by the due date?**
   - Yes → Landlord marks it paid — receipt is numbered, printed or sent.
   - No → **Day 3 · gentle nudge** — drafted, landlord reviews and sends.
3. **Paid now?**
   - Yes → Marked paid · receipt issued — reminder history is kept on the record.
   - No → **Day 10 · direct reminder** — states the amount and the date.
4. **Paid now?**
   - Yes → Marked paid · receipt issued — the month closes on the board.
   - No → **Day 20 · formal notice** — quotes the agreement clause.
5. **Landlord calls the tenant** — the call is logged on the record.

*Diagram 3 — Rent lifecycle. Three escalation steps at day 3, 10 and 20, each with a different tone. The landlord approves every message. Whatever happens is written to the record, so the history is complete either way.*

> OPEN: Are "Day 3 / 10 / 20" counted from the due date or from the 1st? The flowchart starts at "1st of the month" and then asks "Paid by the due date?"; L-15 makes the days editable.

## 11. Where the assistant helps

The app has an assistant built in. It is used in three places only, and never to send anything.

| Where | What it does | Why it matters | Screen |
|---|---|---|---|
| Rent reminders | Writes the message at the right tone for how late the payment is — warm at day three, direct at day ten, formal at day twenty | This is the feature that changes behaviour. Landlords avoid chasing early because the words feel rude. Having the right words ready removes that hesitation. | S-01 |
| Maintenance requests | Reads what the tenant typed and suggests a category and an urgency | Consistent sorting is what makes the "what keeps breaking" view possible later. | T-01, L-07 |
| Deposit settlement | Turns the deposit amount, the deductions and their reasons into a written statement | A clear statement that explains each deduction turns an argument into a signature. | L-13 |

**Firm rule:** the assistant drafts, the landlord decides. Nothing written by the assistant reaches a tenant without the landlord reading it first. This is a product rule, not a preference.

> OPEN: The tone at day three is "warm" here and "gentle" in §10, L-15 and S-01. Assumed to be the same level.
> OPEN: The UI/UX spec also uses the assistant for drafts in L-07 (vendor dispatch, tenant update) and L-12 (renewal notice) via S-01. That is more than "three places only". Do those drafts use the assistant or templates?

## 12. The twelve connections and how each is used

All twelve are available from day one. None of them is a screen of its own — each one appears inside the workflow where it is needed, often in several different places.

| # | Connection | Where it is used in the product | Placed in UI/UX spec |
|---|---|---|---|
| C-1 | Pay by UPI | Opens the tenant's payment app with the exact amount already filled in. Used for: monthly rent from a reminder · deposit at move-in · a repair the tenant is liable for · a late fee | S-02 (L-05, L-07) |
| C-2 | Payment QR | The same payment, as a scannable code. Used for: printed on every receipt · shown on the rent screen so a landlord can hold up his laptop · shared with a tenant whose phone will not open links | S-02, P-01 |
| C-3 | Send on WhatsApp | Opens WhatsApp with the message already typed, for the landlord to review and send. Used for: rent reminders · receipts · maintenance updates · sending a vendor the job and address · welcoming a new tenant with their link · renewal notices | S-01, T-04 |
| C-4 | Send by email | Opens the email app with subject and body ready. Used for: the year's rent records to the accountant in March · a copy of the agreement to a tenant who needs it for their office · a monthly statement to a property owner | S-01, L-11, L-14 |
| C-5 | Tap to call | Dials without copying the number, then offers to log the call. Used for: calling a tenant from an overdue rent row · calling from a maintenance request · calling a vendor · and on the tenant's own page, so they can reach the landlord without saving his number | L-05, L-11, T-01, T-04 |
| C-6 | Open in Maps | Turns an address into directions. Used for: the vendor being sent to a flat · a prospective tenant coming to view a vacant unit · the location shown on the property record | L-07 (in draft), L-09 |
| C-7 | Copy in one tap | Puts text on the clipboard. Used for: any drafted message · a unit's link · the landlord's UPI ID · a receipt number | S-01, S-02, S-03, L-09 |
| C-8 | Share | Opens the phone's own share menu. Used for: sending a new tenant their unit link · passing a receipt to someone · sharing vacancy details with a broker | S-03, L-09, L-11, T-02 |
| C-9 | Add to calendar | Creates a calendar entry in whatever calendar the landlord already uses. Used for: agreement expiry · the notice period ending · a scheduled vendor visit · a rent due date | L-12 |
| C-10 | Print or save as PDF | A clean printable page. Used for: rent receipts · the monthly statement · the deposit settlement · a one-page summary of an agreement | P-01, P-02, P-03 |
| C-11 | Unit QR code | A printable code that opens that unit's reporting page. Used for: a sticker inside the flat door · the welcome sheet handed over at move-in · a notice board in the building | L-08, L-09, P-03 |
| C-12 | Export to a spreadsheet | Downloads the data as a file. Used for: the rent ledger for the accountant · maintenance spend per unit · the current tenant list · the deposit register | L-04, L-14 |

(Connection IDs C-1…C-12 and the "Placed in UI/UX spec" column assigned in conversion.)

**The design decision behind this list:** we chose connections that open apps the landlord and tenant already use, rather than asking them to adopt anything new. There is nothing to install, nothing to configure, and nothing that can stop working or start charging.

> OPEN: These connection uses have no screen or element in the UI/UX spec: C-1 deposit at move-in, a late fee · C-3 receipts on WhatsApp, welcoming a new tenant with their link · C-4 monthly statement to a property owner · C-6 prospective tenant viewing a vacant unit · C-7 the landlord's UPI ID (no copy on L-15), a receipt number · C-8 passing a receipt, vacancy details to a broker · C-9 notice period ending, scheduled vendor visit, rent due date · C-10 the monthly statement, one-page agreement summary · C-11 the welcome sheet. Are these v1?
> OPEN: C-5 "then offers to log the call" is specified only on L-05. L-07 (maintenance), L-11 and vendor calls have no log-call behaviour.

## 13. System architecture (Diagram 6)

How the parts of the product fit together, described in plain terms.

- **Who uses it:** Landlord workspace — signed in, sees everything · Tenant link — no sign-in, one unit only
- **The product:** The records — units, tenants, rent, requests, documents and photos · The rules and dates — monthly rent rows, due dates, expiry countdowns, escalation · The assistant — drafts reminders, sorts requests, writes settlement statements
- **How it reaches people:** The twelve connections — pay · QR · WhatsApp · email · call · maps · copy · share · calendar · print · unit QR · export
- **Apps they already have:** Payment apps on the tenant's phone · WhatsApp & phone (messages and calls) · Email & calendar (whichever they use) · Printer & files (receipts, exports, QR)
- Nothing new to install · nothing to configure · no third-party account required by either user

*Diagram 6 — System architecture. Two ways in, one product core, and twelve connections that hand off to apps the landlord and tenant already have on their phones.*

## 14. Data flow diagram (Diagram 7)

Where information comes from, what the app does with it, and where it is kept.

- **People:** Landlord · Tenant · Vendor
- **What the app does:** 1 · Record units, tenants and condition photos · 2 · Receive and sort a reported problem · 3 · Assign, resolve and record the cost · 4 · Remind, receipt and settle
- **Where it is kept:** Units, properties and tenants · Rent ledger — one row per unit per month · Maintenance requests and vendors · Photos, agreements and receipts · Reminder and call history · Deposit ledger and deductions
- Reminders, receipts and status updates go back out to the landlord and the tenant.

*Diagram 7 — Data flow. Landlord, tenant and vendor each put information in at a different point. Everything is written to a shared set of records, and what comes back out — reminders, receipts, status updates — is drawn from those same records.*

> OPEN: The diagram shows the Vendor putting information in, but no vendor-facing screen or link exists. Vendor data is entered by the landlord (L07-FLD-VENDOR).

## 15. Entity relationship diagram (Diagram 8)

The main things the product keeps track of, and how they relate to each other.

| Entity | Attributes (source) |
|---|---|
| LANDLORD | name · phone, email · UPI ID · business name for receipts |
| PROPERTY | name · address · number of units |
| UNIT | unit number, type · rent, deposit amount · occupied or vacant · its own reporting link |
| TENANT | name, phone · agreement start, end · deposit paid · notice status |
| RENT ENTRY | month · amount due, amount paid · due date, paid on · payment reference · receipt number |
| REMINDER | level: gentle, direct, formal · sent on · how it was sent · call notes if phoned |
| REQUEST | category, description · urgency, status · vendor assigned · cost · before and after photos |
| DOCUMENT | type: agreement, ID proof, photo, receipt, statement · what it belongs to |

Relationships (each 1 : many, seven in the diagram):
- LANDLORD 1 : many PROPERTY
- PROPERTY 1 : many UNIT
- UNIT 1 : many TENANT (a tenant now and a record of tenants before)
- UNIT 1 : many RENT ENTRY
- RENT ENTRY 1 : many REMINDER
- UNIT 1 : many REQUEST
- UNIT 1 : many DOCUMENT

A unit keeps its history when tenants change — rent entries, requests and photos stay with the unit, not the person.

*Diagram 8 — Entity relationships. One landlord has many properties; each property has many units; each unit has a tenant now and a record of tenants before. Rent entries, requests and documents attach to the unit, which is what makes years of history possible.*

> OPEN: The relationship lines are not labelled in the source diagram. The seven relationships above are read from the caption and layout; REMINDER's parent (RENT ENTRY vs TENANT) is inferred.
> OPEN: RENT ENTRY holds a single amount paid / paid on / payment reference / receipt number, but L-04 supports part payment with a receipt "for the amount actually received". A second instalment has nowhere to be recorded.
> OPEN: Agreement start/end live on TENANT. L12-BTN-RENEW "the agreement dates update", which overwrites the previous term. L-11 shows "rent, deposit paid" per agreement, and P-02 needs the tenancy dates.
> OPEN: TENANT has "notice status", and L-08 has a "Notice period" chip and L-10 an "On notice" filter, but no screen sets notice status.
> OPEN: No entity exists for VENDOR (L07-FLD-VENDOR "remembers previously used vendors"), DEDUCTION / SETTLEMENT (L-13), or an audit trail (L05-BTN-EDIT "recorded on the timeline with the old and new value"; L-13 "a new statement that references the first").
> OPEN: Where does rent due day come from? RENT ENTRY has a due date, but no entity carries a due day.
> OPEN: DOCUMENT can be deleted from L-14, but L-13 says a settled statement becomes read-only. No attribute marks a document as protected.

## 16. Scope

### Included in version one

| Area | What is included |
|---|---|
| Landlord workspace | All eight modules, with sign-in |
| Tenant pages | Report a problem, track it, see unit details and receipts — no sign-in |
| Money tracking | Rent recorded per unit per month, receipts issued and numbered, deposit ledger |
| Dates | Rent due dates and agreement expiry, with warnings at 90, 60 and 30 days |
| Photos and documents | Condition photos, repair photos, agreements, ID proofs |
| Assistant | Reminder drafting, request sorting, settlement statements |
| Connections | All twelve, available from day one |

### Deliberately excluded

- **Automatic sending.** Every message is approved by the landlord. This is a principle, not a limitation to be removed later.
- **Listing vacant units publicly.** That is a different product with a different business model.
- **Tenant background or credit checks.** Not meaningfully available to individual landlords in India.
- **Accounting software integration.** A spreadsheet export serves the accountant and avoids a fragile dependency.
- **Society or apartment-complex management.** Different buyer, different problem.
- **A separate tenant mobile app.** The whole point is that the tenant installs nothing.

### Considered for later, once the product is in real use

| Possible addition | Why it is not in version one |
|---|---|
| Collecting rent through a payment gateway, with the rent row updating on its own | Requires the landlord to complete merchant registration, and money would then settle a day later instead of arriving instantly. Worth it for operators with many small payments; a step backwards for a landlord with fourteen flats. |
| Sending messages automatically over WhatsApp's business service | Requires business verification, a separately dedicated phone number, and approval of each message format. Adds a monthly cost that only makes sense across many landlords at once. |
| Automatic monthly rent reminders without review | Would break the approval principle. Revisit only if landlords in real use ask for it. |
| Separate access for a caretaker or assistant | Most landlords in this range work alone. Add it when a customer with staff asks. |

> OPEN: "warnings at 90, 60 and 30 days" — L-03 shows expiring items at ≤30 and ≤90 only (no 60-day row), and L-12 offers a 60-day window. Nothing sends a warning (PR-2). What does "warn at 60" mean in v1?

## 17. How this makes life easier

| Today | With RentRoll — landlord | With RentRoll — tenant |
|---|---|---|
| Not sure who has paid this month | One screen, one glance, twelve green and two red | Gets a numbered receipt every time, without asking |
| Avoids sending the awkward reminder | The right words are already written for day three, ten and twenty | Receives a fair reminder early instead of an angry one late |
| Agreement lapses unnoticed | Warned at 90, 60 and 30 days, with the new rent already calculated | Knows well in advance what is changing and when |
| Repairs reported by phone at odd hours | Requests arrive in a list with photos, in order of urgency | Reports in two minutes with a photo and can check the status |
| Deposit argument at move-out | Move-in photos, every repair and every cost, held for years | Receives a written statement explaining each deduction |
| Accountant rebuilds the year from bank statements | One export, one file, done in March in a minute | Has receipts on hand for their own proof of rent |
| Everything lives in the landlord's head | Everything lives in one place, and can be handed over | Knows there is a record, which is most of the trust |

**The one sentence:** the landlord stops carrying the business in his head, and the tenant stops wondering whether anyone heard them. Both changes come from the same thing — a shared, written record.

## 18. How we will measure success

| ID | What we will look at | Why it tells us the product is working |
|---|---|---|
| SM-1 | Rent rows marked paid within the month | The core promise. If collection does not improve, nothing else matters. |
| SM-2 | Days from due date to payment | Should fall once reminders go out on day three instead of day twenty-five. |
| SM-3 | Requests raised through the tenant link rather than by phone | Shows tenants have accepted the link, which is the biggest adoption risk. |
| SM-4 | Agreements renewed before expiry, not after | The clearest money-saving outcome, and easy to demonstrate to a prospect. |
| SM-5 | Units with move-in photos attached | If this is low, the settlement feature is decorative. Worth watching from week one. |
| SM-6 | Landlords still signing in after three months | The honest test of whether the product replaced the diary or joined it. |

(Measure IDs SM-1…SM-6 assigned in conversion.)

> OPEN: No screen or data point is specified for capturing these measures (e.g. SM-3 needs to know a request came by phone — L06-BTN-NEW has a "reported by" field; SM-6 needs sign-in history).
