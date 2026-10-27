#!/usr/bin/env node
// Asserts that the demo scenarios in SPEC.md hold for every run date in a range,
// so the seed behaves the same whatever day it is run.
//
//   node scripts/seed/check.mjs                         today + the next 800 days
//   node scripts/seed/check.mjs --from 2026-01-01 --days 1200

import assert from 'node:assert/strict';
import { addDays, addMonths, diffDays, isValidIso, todayInKolkata } from './lib/dates.mjs';
import { buildDataset } from './build.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const from = opt('--from', todayInKolkata());
const days = Number(opt('--days', 800));

const one = (list, what) => {
  assert.equal(list.length, 1, `expected exactly one ${what}, got ${list.length}`);
  return list[0];
};

function check(run) {
  const d = buildDataset(run);
  const units = d.properties.flatMap((p) => p.units);
  const tenancy = (k) => d.tenancies.find((t) => t.key === k);
  const rows = (k) => d.rentEntries.filter((e) => e.tenancy === k);

  // Shape: 1 property, 5 units, 4 let, 2B vacant.
  assert.equal(d.properties.length, 1);
  assert.equal(units.length, 5);
  assert.deepEqual(units.filter((u) => u.status === 'Vacant').map((u) => u.key), ['K-2B']);

  // 3 months of history: no row before the window, at most 3 rows per tenancy.
  const windowStart = `${addMonths(`${run.slice(0, 7)}-01`, -2).slice(0, 7)}`;
  for (const e of d.rentEntries) assert.ok(e.month >= windowStart, `row before the window: ${e.tenancy} ${e.month}`);
  for (const t of d.tenancies) assert.ok(rows(t.key).length <= 3, `${t.key} has more than 3 rows`);

  // Nothing is dated after the run date; every date is real.
  for (const e of d.rentEntries) {
    assert.ok(isValidIso(e.dueDate));
    for (const p of e.payments) assert.ok(p.paidOn <= run, `payment after run date: ${e.tenancy} ${e.month}`);
  }
  for (const r of d.reminders) assert.ok(r.sentOn <= run, `reminder after run date: ${r.tenancy}`);
  for (const r of d.requests) for (const ev of r.timeline) assert.ok(ev.at.slice(0, 10) <= run, `request event after run date: ${r.key}`);

  // Overdue: exactly one row, 4C, 18 days, nothing paid. Reminders gentle, direct, then a call.
  const overdue = one(d.rentEntries.filter((e) => e.daysLate > 0), 'overdue row');
  assert.equal(`${overdue.unit}:${overdue.daysLate}`, 'K-4C:18');
  assert.equal(overdue.amountPaid, 0);
  const r4c = d.reminders.filter((r) => r.tenancy === 'TN-4C' && r.rentMonth === overdue.month);
  assert.deepEqual(r4c.map((r) => r.level ?? r.method), ['gentle', 'direct', 'call']);

  // Part paid: exactly one row, 3A, ₹9,000 of ₹17,000 pending, due today so not late.
  const part = one(d.rentEntries.filter((e) => e.status === 'Part paid'), 'part-paid row');
  assert.equal(part.unit, 'K-3A');
  assert.equal(part.pending, 9000);
  assert.equal(part.daysLate, 0);

  // Paid late: 2A's previous month was paid after its due date.
  const late = rows('TN-2A').filter((e) => e.payments.some((p) => p.paidOn > e.dueDate));
  assert.ok(late.length >= 1, '2A has no row paid late');

  // Paid: 1B is fully paid every month whose due date has passed.
  for (const e of rows('TN-1B').filter((e) => e.dueDate < run)) assert.equal(e.status, 'Paid');

  // The vacant unit generates nothing after its tenancy ended.
  assert.ok(!d.rentEntries.some((e) => e.unit === 'K-2B' && e.dueDate > tenancy('TN-2B-OLD').endedOn));

  // Maintenance: every status present; New ages land in the three L-06 bands.
  for (const s of ['New', 'Assigned', 'In progress', 'Done']) assert.ok(d.requests.some((r) => r.status === s), `no ${s} request`);
  const ages = (k) => d.requests.find((r) => r.key === k).ageDays;
  assert.ok(ages('RQ-1B-GEYSER') < 2);
  assert.ok(ages('RQ-4C-TAP') >= 2 && ages('RQ-4C-TAP') <= 7);
  assert.ok(ages('RQ-3A-LOCK') > 7);
  // SC-25: plumbing on 1B reported 4 times in 12 months.
  assert.equal(d.requests.filter((r) => r.unit === 'K-1B' && r.category === 'Plumbing' && r.ageDays <= 365).length, 4);
  // Every request falls inside its tenancy.
  for (const r of d.requests) {
    const t = tenancy(r.tenancy);
    assert.ok(r.reportedAt.slice(0, 10) >= t.startedOn && (!t.endedOn || r.reportedAt.slice(0, 10) <= t.endedOn), `${r.key} outside tenancy`);
  }

  // SC-12: 3A's agreement ends in 22 days.
  assert.equal(diffDays(tenancy('TN-3A').currentAgreement.end, run), 22);

  // SC-31: settled move-out, refund = deposit − deductions, one deduction without a photo.
  const s = one(d.settlements, 'settlement');
  assert.equal(s.balance.amount, s.depositHeld - s.totalDeductions);
  assert.equal(s.balance.direction, 'refundable to tenant');
  assert.equal(s.deductions.filter((x) => x.photoMissing).length, 1);

  // SC-40 / SC-41: 4C is the one active tenancy without move-in photos, and has no ID proof.
  assert.deepEqual(d.expected['L-03'].missingMoveInPhotos, ['4C, Kulkarni Apartments']);
  assert.ok(!d.documents.some((x) => x.belongsTo === 'TN-4C' && x.type === 'ID proof'));

  // Receipt numbers are unique and gapless.
  const receipts = d.rentEntries.flatMap((e) => e.payments.map((p) => p.receiptNumber)).sort();
  receipts.forEach((r, i) => assert.equal(r, `RR-${String(i + 1).padStart(4, '0')}`));
}

let failures = 0;
for (let i = 0; i < days; i++) {
  const run = addDays(from, i);
  try {
    check(run);
  } catch (e) {
    failures += 1;
    if (failures <= 10) console.error(`✗ ${run}: ${e.message}`);
  }
}
console.log(failures ? `${failures} of ${days} run dates failed (from ${from})` : `✓ all scenarios hold for ${days} run dates from ${from}`);
process.exit(failures ? 1 : 0);
