#!/usr/bin/env node
// Asserts that the demo scenarios in SPEC.md hold for every run date in a range,
// so the seed behaves the same whatever day it is run.
//
//   node scripts/seed/check.mjs                         today + the next 800 days
//   node scripts/seed/check.mjs --from 2026-01-01 --days 1200

import assert from 'node:assert/strict';
import { addDays, diffDays, isValidIso, todayInKolkata } from './lib/dates.mjs';
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
  const unitOf = (k) => units.find((u) => u.key === k);

  // Shape: 2 properties, 14 units, 12 occupied, 2 vacant.
  assert.equal(d.properties.length, 2);
  assert.equal(units.length, 14);
  assert.equal(units.filter((u) => u.status !== 'Vacant').length, 12);
  assert.deepEqual(units.filter((u) => u.status === 'Vacant').map((u) => u.key).sort(), ['K-2B', 'S-S2']);

  // Nothing is dated after the run date; every date is real.
  for (const e of d.rentEntries) {
    assert.ok(isValidIso(e.dueDate));
    for (const p of e.payments) assert.ok(p.paidOn <= run, `payment after run date: ${e.tenancy} ${e.month}`);
  }
  for (const r of d.reminders) assert.ok(r.sentOn <= run, `reminder after run date: ${r.tenancy}`);
  for (const r of d.requests) for (const ev of r.timeline) assert.ok(ev.at.slice(0, 10) <= run, `request event after run date: ${r.key}`);

  // SC-01 / SC-02: exactly two overdue rows — 18 days (4C) and 5 days (2A). No other arrears.
  const overdue = d.rentEntries.filter((e) => e.daysLate > 0);
  assert.deepEqual(overdue.map((e) => `${e.unit}:${e.daysLate}`).sort(), ['K-2A:5', 'K-4C:18']);
  assert.ok(overdue.every((e) => e.amountPaid === 0));

  // SC-01 reminder history: gentle (day 3), direct (day 10), logged call (day 15); no formal yet.
  const r4c = d.reminders.filter((r) => r.tenancy === 'TN-4C' && r.rentMonth === overdue.find((e) => e.unit === 'K-4C').month);
  assert.deepEqual(r4c.map((r) => r.level ?? r.method), ['gentle', 'direct', 'call']);

  // SC-03: one part-paid row, ₹4,000 pending, not overdue.
  const part = one(d.rentEntries.filter((e) => e.status === 'Part paid'), 'part-paid row');
  assert.equal(part.unit, 'S-F1');
  assert.equal(part.pending, 4000);
  assert.equal(part.daysLate, 0);

  // Vacant units generate nothing after their tenancy (SC-31) or ever (S2).
  assert.ok(!d.rentEntries.some((e) => e.unit === 'S-S2'));
  assert.ok(!d.rentEntries.some((e) => e.unit === 'K-2B' && e.dueDate > tenancy('TN-2B-OLD').endedOn));

  // SC-43: G1's first row is pro-rata.
  const g1 = d.rentEntries.filter((e) => e.tenancy === 'TN-G1');
  assert.ok(g1[0].proRata && g1[0].amountDue < 10000);

  // Maintenance: every status present; New ages land in the three L-06 bands.
  for (const s of ['New', 'Assigned', 'In progress', 'Done']) assert.ok(d.requests.some((r) => r.status === s), `no ${s} request`);
  const ages = (k) => d.requests.find((r) => r.key === k).ageDays;
  assert.ok(ages('RQ-1B-GEYSER') < 2);
  assert.ok(ages('RQ-G1-TAP') >= 2 && ages('RQ-G1-TAP') <= 7);
  assert.ok(ages('RQ-4A-LOCK') > 7);
  // SC-25: plumbing on 1B reported 4 times in 12 months.
  assert.equal(d.requests.filter((r) => r.unit === 'K-1B' && r.category === 'Plumbing' && r.ageDays <= 365).length, 4);
  // Every request falls inside its tenancy.
  for (const r of d.requests) {
    const t = tenancy(r.tenancy);
    assert.ok(r.reportedAt.slice(0, 10) >= t.startedOn && (!t.endedOn || r.reportedAt.slice(0, 10) <= t.endedOn), `${r.key} outside tenancy`);
  }

  // SC-10…SC-14 agreements: expired, <30, 30–60, 60–90 bands each represented once.
  const left = (k) => diffDays(tenancy(k).currentAgreement.end, run);
  assert.equal(left('TN-3A'), -14);
  assert.equal(left('TN-3B'), 22);
  assert.equal(left('TN-4A'), 45);
  assert.equal(left('TN-F2'), 75);
  assert.equal(tenancy('TN-1A').agreements.length, 3);

  // SC-30: notice given, unit shows Notice period, leaving in 10 days.
  assert.equal(unitOf('S-S1').status, 'Notice period');
  assert.equal(diffDays(tenancy('TN-S1').notice.leavingOn, run), 10);

  // SC-31: settled move-out, refund = deposit − deductions, one deduction without a photo.
  const s = one(d.settlements, 'settlement');
  assert.equal(s.balance.amount, s.depositHeld - s.totalDeductions);
  assert.equal(s.balance.direction, 'refundable to tenant');
  assert.equal(s.deductions.filter((x) => x.photoMissing).length, 1);

  // SC-40: exactly one active tenancy without move-in photos (G1).
  assert.deepEqual(d.expected['L-03'].missingMoveInPhotos, ['G1, Shanti Niwas']);
  // SC-41: 4C has no ID proof on file.
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
