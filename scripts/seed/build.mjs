#!/usr/bin/env node
// Resolves the authored demo data (data.mjs) against a run date and prints the
// result as JSON: every date concrete, every rent row generated, plus `expected`
// — what each screen should show for that run date.
//
//   node scripts/seed/build.mjs                    run date = today in Asia/Kolkata
//   node scripts/seed/build.mjs --date 2026-10-18  fixed run date
//   node scripts/seed/build.mjs --summary          print `expected` only
//
// Writes nothing to any database. See load.mjs (TODO) and SPEC.md.

import { pathToFileURL } from 'node:url';
import {
  addDays, addMonths, dayInMonth, dayOfMonth, daysInMonth, diffDays, firstOfMonth,
  isValidIso, maxIso, monthKey, toDate, todayInKolkata,
} from './lib/dates.mjs';
import * as data from './data.mjs';

const TENANT_STATUS = { New: 'Received', Assigned: 'Assigned', 'In progress': 'In progress', Done: 'Done' }; // L-06 → T03-CHP-STATUS

export function buildDataset(runDate, src = data) {
  if (!isValidIso(runDate)) throw new Error(`Run date must be YYYY-MM-DD, got "${runDate}"`);

  const at = (o) => ('monthsAgo' in o ? dayInMonth(addMonths(firstOfMonth(runDate), -o.monthsAgo), o.day) : addDays(runDate, o.days));
  const stamp = (o) => `${at(o)}T${o.at ?? '12:00'}:00+05:30`;

  const units = new Map();
  for (const p of src.properties) for (const u of p.units) units.set(u.key, { ...u, property: p });

  // ── Tenancies and agreement terms ──────────────────────────────────────────
  const tenancies = src.tenancies.map((t) => {
    const unit = units.get(t.unit);
    const terms = agreementTerms(t.agreement, at);
    const endedOn = t.endedOn ? at(t.endedOn) : null;
    const dueDay = typeof t.dueDay === 'number' ? t.dueDay : dayOfMonth(at(t.dueDay));
    const notice = t.notice
      ? { givenOn: at(t.notice.givenOn), periodDays: t.notice.periodDays, leavingOn: addDays(at(t.notice.givenOn), t.notice.periodDays) }
      : null;
    return {
      key: t.key,
      unit: t.unit,
      tenant: t.tenant,
      startedOn: terms[0].start,
      endedOn,
      active: !endedOn,
      agreements: terms,
      currentAgreement: terms[terms.length - 1],
      rentDueDay: dueDay,
      deposit: { amount: unit.property.depositMonths * t.agreement.rents[0], receivedOn: terms[0].start },
      notice,
      scenarios: t.scenarios,
      _src: t,
    };
  });
  const tenancyByKey = new Map(tenancies.map((t) => [t.key, t]));

  // ── Rent entries and payments ──────────────────────────────────────────────
  const rentEntries = [];
  const payments = [];
  const reminders = [];
  // Rows start at the history window (the run month and the months before it), or at move-in
  // when that is later. Without a window, from move-in.
  const windowStart = src.historyMonths ? addMonths(firstOfMonth(runDate), -(src.historyMonths - 1)) : '0000-01-01';
  for (const t of tenancies) {
    const s = t._src;
    const last = t.endedOn ?? runDate;
    let month = maxIso(firstOfMonth(t.startedOn), windowStart);
    let index = 0;
    while (month <= firstOfMonth(last)) {
      const isFirst = month === firstOfMonth(t.startedOn) && dayOfMonth(t.startedOn) > 1;
      const term = termInForce(t.agreements, maxIso(month, t.startedOn));
      const dim = daysInMonth(toDate(month).getUTCFullYear(), toDate(month).getUTCMonth() + 1);
      let dueDate = isFirst ? t.startedOn : dayInMonth(month, t.rentDueDay);
      if (t.endedOn && dueDate > t.endedOn) dueDate = t.endedOn;
      const amountDue = isFirst ? Math.round((term.rent * (dim - dayOfMonth(t.startedOn) + 1)) / dim) : term.rent;
      const entry = { tenancy: t.key, unit: t.unit, month: monthKey(month), amountDue, dueDate, proRata: isFirst, scenario: null };

      let paid = null; // [{ amount, paidOn }]
      if (s.overdueRow && dueDate === addDays(runDate, s.overdueRow.dueOffsetDays)) {
        entry.scenario = 'overdue';
        paid = [];
        for (const r of s.reminders ?? []) {
          reminders.push(reminder(t, entry, addDays(dueDate, r.afterDue), r));
        }
      } else if (s.partPaidRow && dueDate === addDays(runDate, s.partPaidRow.dueOffsetDays)) {
        entry.scenario = 'part-paid';
        paid = [{ amount: s.partPaidRow.amount, paidOn: maxIso(month, addDays(runDate, s.partPaidRow.paidOffsetDays)) }];
      } else if (isFirst) {
        paid = [{ amount: amountDue, paidOn: t.startedOn }];
      } else {
        const late = typeof s.pays === 'object' && index % s.pays.lateEvery === s.pays.lateEvery - 1;
        const paidOn = late ? addDays(dueDate, s.pays.daysLate) : maxIso(month, addDays(dueDate, -2));
        paid = [{ amount: amountDue, paidOn }];
        if (late && addDays(dueDate, 3) <= runDate) {
          reminders.push(reminder(t, entry, addDays(dueDate, 3), { level: 'gentle', method: 'WhatsApp' }));
        }
      }
      paid = paid.filter((p) => p.paidOn <= runDate);
      for (const p of paid) payments.push({ tenancy: t.key, unit: t.unit, month: entry.month, ...p });

      const received = paid.reduce((n, p) => n + p.amount, 0);
      entry.amountPaid = received;
      entry.pending = amountDue - received;
      entry.daysLate = entry.pending > 0 && dueDate < runDate ? diffDays(runDate, dueDate) : 0;
      entry.status = entry.pending === 0 ? 'Paid' : received > 0 ? 'Part paid' : entry.daysLate > 0 ? 'Overdue' : 'Due';
      rentEntries.push(entry);
      month = addMonths(month, 1);
      index += 1;
    }
  }

  // Receipt numbers: one per payment, in date order (P-01, E1 "RR-0847" format).
  payments.sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.tenancy.localeCompare(b.tenancy));
  payments.forEach((p, i) => {
    p.receiptNumber = `RR-${String(i + 1).padStart(4, '0')}`;
    p.reference = i % 7 === 3 ? null : `UPI ${upiRef(`${p.tenancy}|${p.month}|${p.paidOn}`)}`; // optional field (L-04)
  });
  for (const e of rentEntries) {
    e.payments = payments.filter((p) => p.tenancy === e.tenancy && p.month === e.month)
      .map(({ amount, paidOn, reference, receiptNumber }) => ({ amount, paidOn, reference, receiptNumber }));
  }
  reminders.sort((a, b) => a.sentOn.localeCompare(b.sentOn));

  // ── Maintenance requests ───────────────────────────────────────────────────
  const requests = src.requests
    .map((r) => ({ ...r, reportedAtResolved: stamp(r.reportedAt) }))
    .sort((a, b) => a.reportedAtResolved.localeCompare(b.reportedAtResolved))
    .map((r, i) => {
      const vendor = r.vendor ? src.vendors.find((v) => v.key === r.vendor) : null;
      const timeline = [{ at: r.reportedAtResolved, event: `Reported (${r.reportedBy})` }];
      if (r.assignedAt) {
        timeline.push({ at: stamp(r.assignedAt), event: `Status → Assigned · vendor ${vendor.name}` });
        timeline.push({ at: stamp(r.assignedAt), event: 'Job sent to vendor (S-01, landlord confirmed "Yes")' });
      }
      if (r.startedAt) timeline.push({ at: stamp(r.startedAt), event: 'Status → In progress' });
      if (r.closedAt) {
        timeline.push({ at: stamp(r.closedAt), event: `Status → Done · cost ${r.cost === 'no cost' ? '"no cost"' : `₹${r.cost}`}` });
        if (r.closingNote) timeline.push({ at: stamp(r.closedAt), event: `Note: ${r.closingNote}` });
        if (r.tenantLiable) timeline.push({ at: stamp(r.closedAt), event: 'Tenant marked liable · payment request not yet paid' });
      }
      return {
        key: r.key,
        number: `R-${String(i + 1).padStart(4, '0')}`,
        unit: r.unit,
        tenancy: r.tenancy,
        category: r.category,
        urgency: r.urgency,
        status: r.status,
        tenantStatus: TENANT_STATUS[r.status],
        description: r.description,
        reportedBy: r.reportedBy,
        reportedAt: r.reportedAtResolved,
        assignedAt: r.assignedAt ? stamp(r.assignedAt) : null,
        startedAt: r.startedAt ? stamp(r.startedAt) : null,
        closedAt: r.closedAt ? stamp(r.closedAt) : null,
        closingNote: r.closingNote ?? null,
        ageDays: diffDays(runDate, at(r.reportedAt)),
        vendor: vendor ? { name: vendor.name, phone: vendor.phone } : null,
        cost: r.cost,
        tenantLiable: !!r.tenantLiable,
        tenantLiablePaid: r.tenantLiable ? !!r.tenantLiablePaid : null,
        photosBefore: r.photosBefore,
        photosAfter: r.photosAfter,
        timeline,
      };
    });

  // ── Settlements ────────────────────────────────────────────────────────────
  const settlements = src.settlements.map((s) => {
    const t = tenancyByKey.get(s.tenancy);
    const total = s.deductions.reduce((n, d) => n + d.amount, 0);
    const balance = t.deposit.amount - total;
    return {
      tenancy: s.tenancy,
      unit: t.unit,
      depositHeld: t.deposit.amount,
      depositReceivedOn: t.deposit.receivedOn,
      tenancyDates: { start: t.startedOn, end: t.endedOn },
      deductions: s.deductions.map((d) => ({ ...d, photoMissing: !d.photo })),
      totalDeductions: total,
      balance: { amount: Math.abs(balance), direction: balance >= 0 ? 'refundable to tenant' : 'owed by tenant' },
      preparedOn: at(s.preparedOn),
      settledOn: at(s.settledOn),
      readOnly: true,
    };
  });

  // ── Documents and photos (files are placeholders — TODO storage) ───────────
  const documents = [];
  for (const t of tenancies) {
    const s = t._src;
    for (const a of t.agreements) {
      documents.push({ type: 'agreement', belongsTo: t.key, title: `Leave and licence agreement, ${a.start} to ${a.end}`, uploadedOn: a.start, file: null });
    }
    if (s.idProof) documents.push({ type: 'ID proof', belongsTo: t.key, title: 'Aadhaar card (masked)', uploadedOn: t.startedOn, file: null });
    for (const caption of s.moveInPhotos) {
      documents.push({ type: 'photo', group: 'move-in condition', belongsTo: t.key, alt: caption, uploadedOn: t.startedOn, file: null });
    }
    for (const caption of s.moveOutPhotos ?? []) {
      documents.push({ type: 'photo', group: 'move-out condition', belongsTo: t.key, alt: caption, uploadedOn: t.endedOn, file: null });
    }
  }
  for (const r of requests) {
    for (const caption of r.photosBefore) documents.push({ type: 'photo', group: 'repair — before', belongsTo: r.key, alt: caption, uploadedOn: r.reportedAt.slice(0, 10), file: null });
    for (const caption of r.photosAfter) documents.push({ type: 'photo', group: 'repair — after', belongsTo: r.key, alt: caption, uploadedOn: r.timeline.at(-1).at.slice(0, 10), file: null });
  }
  for (const s of settlements) {
    documents.push({ type: 'statement', belongsTo: s.tenancy, title: `Deposit settlement statement, unit ${unitLabel(units.get(s.unit))}`, uploadedOn: s.settledOn, readOnly: true, file: null });
  }

  // ── Units with status ──────────────────────────────────────────────────────
  const properties = src.properties.map((p) => ({
    key: p.key,
    name: p.name,
    address: p.address,
    numberOfUnits: p.units.length,
    units: p.units.map((u) => {
      const t = tenancies.find((x) => x.unit === u.key && x.active);
      return {
        key: u.key, unitNumber: u.unitNumber, type: u.type, rent: u.rent, deposit: u.deposit,
        status: !t ? 'Vacant' : t.notice ? 'Notice period' : 'Occupied',
        currentTenancy: t?.key ?? null,
      };
    }),
  }));

  const dataset = {
    meta: {
      runDate,
      timezone: 'Asia/Kolkata',
      note: 'Seed-domain shape, not a database schema. Money in whole rupees. Files are placeholders.',
    },
    landlord: src.landlord,
    settings: src.settings,
    vendors: src.vendors,
    properties,
    tenancies: tenancies.map((t) => {
      const out = { ...t };
      delete out._src;
      return out;
    }),
    rentEntries,
    reminders,
    requests,
    settlements,
    documents,
  };
  dataset.expected = expectations(dataset, runDate, units);
  return dataset;

  function reminder(t, entry, sentOn, r) {
    return {
      tenancy: t.key,
      unit: t.unit,
      rentMonth: entry.month,
      level: r.method === 'call' ? null : r.level,
      method: r.method,
      sentOn,
      confirmedSent: r.method !== 'call', // S-01 "Did you send it?" → Yes
      outcome: r.outcome ?? null,
      note: r.note ?? null,
    };
  }
}

function agreementTerms(spec, at) {
  const n = spec.rents.length;
  const terms = new Array(n);
  if (spec.currentEnd) {
    let end = at(spec.currentEnd);
    for (let i = n - 1; i >= 0; i--) {
      const start = addDays(addMonths(end, -spec.termMonths), 1);
      terms[i] = { start, end, rent: spec.rents[i] };
      end = addDays(start, -1);
    }
  } else {
    let start = at(spec.start);
    for (let i = 0; i < n; i++) {
      const end = addDays(addMonths(start, spec.termMonths), -1);
      terms[i] = { start, end, rent: spec.rents[i] };
      start = addDays(end, 1);
    }
  }
  return terms;
}

// Rent of the agreement in force on `date`; after the last term ends, the last term's rent
// (an expired agreement keeps generating at the old rent — see SPEC.md §6).
function termInForce(terms, date) {
  return terms.find((a) => a.start <= date && date <= a.end) ?? (date < terms[0].start ? terms[0] : terms.at(-1));
}

function upiRef(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return String(400000000000 + (h % 99999999999)).slice(0, 12);
}

function unitLabel(u) {
  return `${u.unitNumber}, ${u.property.name}`;
}

// What each screen should show for this run date, per the UI/UX spec's rules.
function expectations(d, runDate, units) {
  const label = (key) => unitLabel(units.get(key));
  const active = d.tenancies.filter((t) => t.active);
  const allUnits = d.properties.flatMap((p) => p.units);
  const thisMonth = monthKey(runDate);
  const open = d.requests.filter((r) => r.status !== 'Done');
  const daysLeft = (t) => diffDays(t.currentAgreement.end, runDate);

  const collectedByMonth = {};
  for (let i = 5; i >= 0; i--) collectedByMonth[monthKey(addMonths(firstOfMonth(runDate), -i))] = 0;
  for (const e of d.rentEntries) for (const p of e.payments) {
    if (monthKey(p.paidOn) in collectedByMonth) collectedByMonth[monthKey(p.paidOn)] += p.amount;
  }
  const pastDue = d.rentEntries.filter((e) => e.pending > 0 && e.dueDate < runDate);

  // L-03 Needs attention, rules 1–6 in order.
  const attention = [];
  for (const r of open.filter((r) => r.urgency === 'Urgent')) attention.push({ rule: 1, unit: label(r.unit), item: `${r.category} request ${r.number}, urgent` });
  for (const e of pastDue.filter((e) => e.daysLate >= 10)) attention.push({ rule: 2, unit: label(e.unit), item: `rent ${e.month} ${e.daysLate} days overdue` });
  const byEnd = [...active].sort((a, b) => daysLeft(a) - daysLeft(b));
  for (const t of byEnd.filter((t) => daysLeft(t) <= 30)) attention.push({ rule: 3, unit: label(t.unit), item: daysLeft(t) < 0 ? `agreement expired ${-daysLeft(t)} days ago` : `agreement ends in ${daysLeft(t)} days` });
  for (const e of pastDue.filter((e) => e.daysLate < 10)) attention.push({ rule: 4, unit: label(e.unit), item: `rent ${e.month} ${e.daysLate} days overdue` });
  for (const r of open.filter((r) => r.urgency !== 'Urgent').sort((a, b) => b.ageDays - a.ageDays)) attention.push({ rule: 5, unit: label(r.unit), item: `${r.category} request ${r.number}, ${r.status}, ${r.ageDays} days old` });
  for (const t of byEnd.filter((t) => daysLeft(t) > 30 && daysLeft(t) <= 90)) attention.push({ rule: 6, unit: label(t.unit), item: `agreement ends in ${daysLeft(t)} days` });

  return {
    'L-03': {
      occupied: `${allUnits.filter((u) => u.status !== 'Vacant').length} / ${allUnits.length}`,
      vacant: allUnits.filter((u) => u.status === 'Vacant').map((u) => label(u.key)),
      collectedThisMonth: collectedByMonth[thisMonth],
      outstandingPastDue: { amount: pastDue.reduce((n, e) => n + e.pending, 0), units: new Set(pastDue.map((e) => e.unit)).size },
      pendingNotYetDue: d.rentEntries.filter((e) => e.pending > 0 && e.dueDate >= runDate).reduce((n, e) => n + e.pending, 0),
      agreementsExpiringWithin90Days: active.filter((t) => daysLeft(t) <= 90).length,
      incomeLast6Months: collectedByMonth,
      needsAttention: attention,
      missingMoveInPhotos: active.filter((t) => !d.documents.some((x) => x.belongsTo === t.key && x.group === 'move-in condition')).map((t) => label(t.unit)),
    },
    'L-04': d.rentEntries
      .filter((e) => e.month === thisMonth || e.pending > 0)
      .map((e) => ({ unit: label(e.unit), tenant: d.tenancies.find((t) => t.key === e.tenancy).tenant.name, month: e.month, rent: e.amountDue, dueDate: e.dueDate, status: e.status, daysLate: e.daysLate, pending: e.pending, proRata: e.proRata })),
    'L-06': Object.fromEntries(['New', 'Assigned', 'In progress', 'Done'].map((s) => [s, d.requests.filter((r) => r.status === s).map((r) => `${r.number} ${label(r.unit)} · ${r.category} · ${r.urgency} · ${r.ageDays}d`)])),
    'L-12': byEnd.map((t) => ({ unit: label(t.unit), tenant: t.tenant.name, endsOn: t.currentAgreement.end, daysRemaining: daysLeft(t), currentRent: t.currentAgreement.rent })),
    'L-13': {
      depositsHeld: active.map((t) => ({ unit: label(t.unit), tenant: t.tenant.name, amount: t.deposit.amount, since: t.deposit.receivedOn })),
      totalHeld: active.reduce((n, t) => n + t.deposit.amount, 0),
      settlements: d.settlements.map((s) => ({ unit: label(s.unit), held: s.depositHeld, deductions: s.totalDeductions, balance: s.balance })),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--date');
  const runDate = i >= 0 ? args[i + 1] : todayInKolkata();
  const out = buildDataset(runDate);
  process.stdout.write(JSON.stringify(args.includes('--summary') ? { runDate, ...out.expected } : out, null, 2) + '\n');
}
