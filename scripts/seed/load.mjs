#!/usr/bin/env node
// Loads the demo dataset (build.mjs, resolved for today in Asia/Kolkata) into the hosted Supabase
// project that .env.local points at. Run with `npm run seed:demo`.
//
// Idempotent: the demo landlord is identified only by its email (data.mjs, an example.com
// address). Each run removes that one auth user, which cascades the landlord row, every row it
// owns and its receipt/request number sequence, removes its storage folder, then creates it all
// again. No other user, row or file is touched, so the same run gives the same state every time.
//
// The service role key is used here because creating an auth user and writing history the API
// never lets a landlord write (dated payments, closed requests, a settled statement) needs it.
// It is read from .env.local (or the environment), never hardcoded, and this script is not app code.
//
// Receipt and request numbers are left to the database triggers (D-12) so the per-landlord
// sequence ends past the seeded history and the next payment recorded in the app gets the next
// number. Rows are inserted in date order, so numbering follows history.

import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { createClient } from '@supabase/supabase-js';

import { buildDataset } from './build.mjs';
import { todayInKolkata } from './lib/dates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUCKET = 'documents';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...process.env };
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[key]) fail(`${key} is not set in .env.local`);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runDate = todayInKolkata();
const d = buildDataset(runDate);
const L = d.landlord;

// The password every lane signs in with must survive a re-seed, so a password from .env.local
// always wins: DEMO_LANDLORD_PASSWORD, else DEV_LANDLORD_PASSWORD when DEV_LANDLORD_EMAIL is this
// demo landlord. Only with neither set is a password generated (and printed) for this run.
const passwordSource = env.DEMO_LANDLORD_PASSWORD
  ? 'DEMO_LANDLORD_PASSWORD'
  : env.DEV_LANDLORD_PASSWORD && env.DEV_LANDLORD_EMAIL?.toLowerCase() === L.email.toLowerCase()
    ? 'DEV_LANDLORD_PASSWORD'
    : null;
const password = passwordSource ? env[passwordSource] : randomBytes(12).toString('base64url');

console.log(`Seeding the demo landlord into ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host} for ${runDate} …`);

// ── 1. Remove the previous demo landlord (only that one) ─────────────────────────────────────
const existing = await findUserByEmail(L.email);
if (existing) {
  const { data: old } = await db.from('landlord').select('id').eq('auth_user_id', existing.id).maybeSingle();
  if (old) await removeFolder(old.id);
  check(await db.auth.admin.deleteUser(existing.id), 'delete the previous demo user');
}

// ── 2. The landlord: auth user (the trigger creates the landlord row, D-20), then profile ────
const { data: created, error: createError } = await db.auth.admin.createUser({
  email: L.email,
  password,
  email_confirm: true,
  user_metadata: { name: L.name },
});
if (createError) fail(`create the demo user: ${createError.message}`);
const landlord = one(await db.from('landlord').select('id').eq('auth_user_id', created.user.id), 'landlord row');
const landlordId = landlord.id;
check(
  await db.from('landlord').update({
    phone: L.phone,
    upi_id: L.upiId,
    receipt_name: L.receiptName,
    accountant_email: d.settings.accountantEmail,
    escalation_default_pct: d.settings.escalationPercentDefault,
    ladder_days: [d.settings.reminderLadderDays.gentle, d.settings.reminderLadderDays.direct, d.settings.reminderLadderDays.formal],
  }).eq('id', landlordId),
  'update the landlord profile',
);

// ── 3. Vendors, property, units ──────────────────────────────────────────────────────────────
const vendorId = new Map();
for (const v of d.vendors) {
  const row = one(await db.from('vendor').insert({ landlord_id: landlordId, name: v.name, phone: v.phone }).select('id'), 'vendor');
  vendorId.set(v.name, row.id);
}

const unitId = new Map();
const unitNumber = new Map();
for (const p of d.properties) {
  const prop = one(await db.from('property').insert({ landlord_id: landlordId, name: p.name, address: p.address }).select('id'), 'property');
  for (const u of p.units) {
    const row = one(
      await db.from('unit').insert({
        landlord_id: landlordId, property_id: prop.id, unit_number: u.unitNumber, type: u.type, rent: u.rent, deposit_amount: u.deposit,
      }).select('id'),
      'unit',
    );
    unitId.set(u.key, row.id);
    unitNumber.set(u.key, u.unitNumber);
  }
}

// ── 4. Tenancies and agreements (D-05, D-08, D-09, D-23) ─────────────────────────────────────
const tenancyId = new Map();
const agreementIds = new Map(); // tenancy key → [{ id, start, end }]
for (const t of d.tenancies) {
  const settled = d.settlements.some((s) => s.tenancy === t.key);
  const row = one(
    await db.from('tenancy').insert({
      landlord_id: landlordId,
      unit_id: unitId.get(t.unit),
      name: t.tenant.name,
      phone: t.tenant.phone,
      email: t.tenant.email,
      moved_in_on: t.startedOn,
      ended_on: t.endedOn,
      status: t.endedOn ? (settled ? 'settled' : 'ended') : 'active',
      deposit_paid: t.deposit.amount,
      deposit_received_on: t.deposit.receivedOn,
      notice_given_on: t.notice?.givenOn ?? null,
      notice_vacate_on: t.notice?.leavingOn ?? null,
    }).select('id'),
    'tenancy',
  );
  tenancyId.set(t.key, row.id);
  const terms = [];
  for (const a of t.agreements) {
    const ag = one(
      await db.from('agreement').insert({
        landlord_id: landlordId, tenancy_id: row.id, starts_on: a.start, ends_on: a.end, rent: a.rent, rent_due_day: t.rentDueDay,
      }).select('id'),
      'agreement',
    );
    terms.push({ id: ag.id, start: a.start, end: a.end });
  }
  agreementIds.set(t.key, terms);
}
const tenancyOf = (key) => d.tenancies.find((t) => t.key === key);

// ── 5. Rent entries, payments and reminders (D-10, D-12, D-17, D-24) ─────────────────────────
const rentEntryId = new Map(); // `${tenancy}|${month}` → id
for (const e of d.rentEntries) {
  const t = tenancyOf(e.tenancy);
  const month = `${e.month}-01`;
  const on = month > t.startedOn ? month : t.startedOn;
  const terms = agreementIds.get(e.tenancy);
  const term = terms.find((a) => a.start <= on && on <= a.end) ?? (on < terms[0].start ? terms[0] : terms.at(-1));
  const row = one(
    await db.from('rent_entry').insert({
      landlord_id: landlordId,
      tenancy_id: tenancyId.get(e.tenancy),
      unit_id: unitId.get(e.unit),
      agreement_id: term.id,
      month,
      amount_due: e.amountDue,
      due_on: e.dueDate,
      is_pro_rata: e.proRata,
    }).select('id'),
    'rent entry',
  );
  rentEntryId.set(`${e.tenancy}|${e.month}`, row.id);
}

// Date order, so the trigger's RR-nnnn numbers follow history (D-12).
const payments = d.rentEntries
  .flatMap((e) => e.payments.map((p) => ({ ...p, tenancy: e.tenancy, month: e.month })))
  .sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.receiptNumber.localeCompare(b.receiptNumber));
for (const p of payments) {
  check(
    await db.from('payment').insert({
      landlord_id: landlordId,
      rent_entry_id: rentEntryId.get(`${p.tenancy}|${p.month}`),
      amount: p.amount,
      received_on: p.paidOn,
      reference: p.reference,
      created_at: istStamp(p.paidOn, '19:30'),
    }),
    'payment',
  );
}

const LEVEL = { gentle: 1, direct: 2, formal: 3 };
for (const r of d.reminders) {
  const t = tenancyOf(r.tenancy);
  const entry = d.rentEntries.find((e) => e.tenancy === r.tenancy && e.month === r.rentMonth);
  const base = {
    landlord_id: landlordId,
    rent_entry_id: rentEntryId.get(`${r.tenancy}|${r.rentMonth}`),
    tenancy_id: tenancyId.get(r.tenancy),
    confirmed_at: istStamp(r.sentOn, '10:15'),
    created_at: istStamp(r.sentOn, '10:15'),
  };
  const row = r.method === 'call'
    ? { ...base, kind: 'call', channel: 'call', call_outcome: r.outcome, call_note: r.note }
    : { ...base, kind: 'rent_reminder', channel: 'whatsapp', level: LEVEL[r.level], body: reminderBody(r.level, t, entry) };
  check(await db.from('message').insert(row), 'reminder');
}

// ── 6. Maintenance requests with their history (D-12, D-14, D-17, D-21, D-22, D-32, D-35) ──
const STATUS = { New: 'new', Assigned: 'assigned', 'In progress': 'in_progress', Done: 'done' };
const VIA = { 'tenant link': 'tenant_link', 'phone call': 'phone' };
const requestId = new Map();
for (const r of d.requests) { // build.mjs sorts by report time, so R-nnnn follows history
  const t = tenancyOf(r.tenancy);
  const viaTenant = r.reportedBy === 'tenant link';
  const done = r.status === 'Done';
  const row = one(
    await db.from('request').insert({
      landlord_id: landlordId,
      unit_id: unitId.get(r.unit),
      tenancy_id: tenancyId.get(r.tenancy),
      reported_via: VIA[r.reportedBy],
      reporter_name: viaTenant ? t.tenant.name : null,
      reporter_phone: viaTenant ? t.tenant.phone : null,
      description: r.description,
      reported_category: r.category.toLowerCase(),
      reported_urgency: r.urgency.toLowerCase(),
      category: r.category.toLowerCase(),
      urgency: r.urgency.toLowerCase(),
      status: STATUS[r.status],
      vendor_id: r.vendor ? vendorId.get(r.vendor.name) : null,
      cost: done && r.cost !== 'no cost' ? r.cost : null,
      no_cost: done && r.cost === 'no cost',
      tenant_liable: r.tenantLiable,
      payment_requested_at: r.tenantLiable ? r.closedAt : null,
      done_at: done ? r.closedAt : null,
      created_at: r.reportedAt,
    }).select('id'),
    'request',
  );
  requestId.set(r.key, row.id);

  const audits = [{ kind: 'created', new_value: { reported_via: VIA[r.reportedBy] }, created_at: r.reportedAt }];
  const messages = [];
  let status = 'new';
  const move = (to, at) => {
    audits.push({ kind: 'status_change', old_value: { status }, new_value: { status: to }, created_at: at });
    status = to;
  };
  if (r.assignedAt) {
    audits.push({ kind: 'vendor_set', new_value: { vendor_id: vendorId.get(r.vendor.name), name: r.vendor.name }, created_at: r.assignedAt });
    move('assigned', r.assignedAt);
    messages.push({ kind: 'vendor_dispatch', vendor_id: vendorId.get(r.vendor.name), body: dispatchBody(r, t), confirmed_at: r.assignedAt });
  }
  if (r.startedAt) {
    move('in_progress', r.startedAt);
    messages.push({ kind: 'tenant_update', body: `Hello ${firstName(t.tenant.name)}, work on your ${r.category.toLowerCase()} request has started. — ${L.name}`, confirmed_at: r.startedAt });
  }
  if (done) {
    audits.push({ kind: 'cost_recorded', new_value: { cost: r.cost === 'no cost' ? null : r.cost, no_cost: r.cost === 'no cost' }, created_at: r.closedAt, note: r.closingNote });
    move('done', r.closedAt);
    if (r.tenantLiable) {
      audits.push({ kind: 'tenant_liable', new_value: { tenant_liable: true }, created_at: r.closedAt });
      messages.push({ kind: 'payment_link', body: `Hello ${firstName(t.tenant.name)}, the ${r.category.toLowerCase()} repair cost ${rupees(r.cost)}. You can pay by UPI to ${L.upiId}. — ${L.name}`, confirmed_at: r.closedAt });
    }
  }
  check(
    await db.from('audit_event').insert(audits.map((a) => ({
      landlord_id: landlordId, actor: 'landlord', entity_type: 'request', entity_id: row.id, old_value: null, note: null, ...a,
    }))),
    'request history',
  );
  for (const m of messages) {
    check(
      await db.from('message').insert({
        landlord_id: landlordId, channel: 'whatsapp', request_id: row.id, tenancy_id: tenancyId.get(r.tenancy), created_at: m.confirmed_at, ...m,
      }),
      `${m.kind} message`,
    );
  }
}

// ── 7. Settlement and deductions (D-18, D-35) ───────────────────────────────────────────────
const deductionId = new Map(); // `${tenancy}|${position}` → id
const settlementId = new Map();
for (const s of d.settlements) {
  const t = tenancyOf(s.tenancy);
  const row = one(
    await db.from('settlement').insert({
      landlord_id: landlordId,
      tenancy_id: tenancyId.get(s.tenancy),
      deposit_held: s.depositHeld,
      deposit_received_on: s.depositReceivedOn,
      statement_text: statementText(s, t),
      status: 'settled',
      settled_at: istStamp(s.settledOn, '16:00'),
      created_at: istStamp(s.preparedOn, '11:00'),
    }).select('id'),
    'settlement',
  );
  settlementId.set(s.tenancy, row.id);
  for (const [i, x] of s.deductions.entries()) {
    const ded = one(
      await db.from('deduction').insert({
        landlord_id: landlordId,
        settlement_id: row.id,
        description: x.description,
        reason: x.reason,
        amount: x.amount,
        request_id: x.fromRequest ? requestId.get(x.fromRequest) : null,
        position: i,
      }).select('id'),
      'deduction',
    );
    deductionId.set(`${s.tenancy}|${i}`, ded.id);
  }
}

// ── 8. Documents: placeholder files in the private bucket, rows pointing at them (D-15) ─────
const TYPE = {
  agreement: 'agreement',
  'ID proof': 'id_proof',
  statement: 'statement',
  'move-in condition': 'move_in_photo',
  'move-out condition': 'move_out_photo',
  'repair — before': 'request_before_photo',
  'repair — after': 'request_after_photo',
};
let fileCount = 0;
for (const doc of d.documents) {
  const type = TYPE[doc.group ?? doc.type];
  const isRequest = type === 'request_before_photo' || type === 'request_after_photo';
  const request = isRequest ? d.requests.find((r) => r.key === doc.belongsTo) : null;
  const tenancyKey = request ? request.tenancy : doc.belongsTo;
  const t = tenancyOf(tenancyKey);
  const settled = type === 'statement' ? settlementId.get(tenancyKey) : null;
  const docId = await upload({
    type,
    unit_id: unitId.get(t.unit),
    tenancy_id: tenancyId.get(tenancyKey),
    request_id: request ? requestId.get(request.key) : null,
    settlement_id: settled,
    title: doc.title ?? doc.alt,
    alt_text: doc.alt ?? null,
    uploaded_at: istStamp(doc.uploadedOn, '12:00'),
    uploaded_by: type === 'request_before_photo' && request.reportedBy === 'tenant link' ? 'tenant' : 'landlord',
    is_protected: type === 'statement',
  });
  if (type === 'statement') check(await db.from('settlement').update({ document_id: docId }).eq('id', settled), 'link the statement');
}
// Deduction photos (L-13): one per deduction that has one; the photo-less one keeps its warning.
for (const s of d.settlements) {
  const t = tenancyOf(s.tenancy);
  for (const [i, x] of s.deductions.entries()) {
    if (!x.photo) continue;
    const docId = await upload({
      type: 'deduction_photo',
      unit_id: unitId.get(t.unit),
      tenancy_id: tenancyId.get(s.tenancy),
      settlement_id: settlementId.get(s.tenancy),
      deduction_id: deductionId.get(`${s.tenancy}|${i}`),
      title: x.photo,
      alt_text: x.photo,
      uploaded_at: istStamp(s.preparedOn, '11:00'),
      uploaded_by: 'landlord',
    });
    check(await db.from('deduction').update({ document_id: docId }).eq('id', deductionId.get(`${s.tenancy}|${i}`)), 'link a deduction photo');
  }
}

// ── Done ─────────────────────────────────────────────────────────────────────────────────────
const units = d.properties.flatMap((p) => p.units);
console.log(`
Done. ${d.properties.length} property · ${units.length} units (${units.filter((u) => u.status === 'Vacant').length} vacant) · ${d.tenancies.length} tenancies · ${d.rentEntries.length} rent rows · ${payments.length} payments · ${d.reminders.length} reminders and calls · ${d.requests.length} requests · ${d.settlements.length} settlement · ${fileCount} files

Sign in at http://localhost:3000/signin
  Email:    ${L.email}
  Password: ${passwordSource ? `${passwordSource} from .env.local` : `${password}\n  (generated for this run; set DEMO_LANDLORD_PASSWORD in .env.local to keep one)`}`);

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

async function upload({ type, title, ...row }) {
  const id = randomUUID();
  const isPdf = type === 'agreement' || type === 'id_proof' || type === 'statement';
  const bytes = isPdf ? placeholderPdf(title) : placeholderPng(type);
  const storagePath = `${landlordId}/${id}`; // D-15: <landlord_id>/<document_id>
  const { error: upError } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: isPdf ? 'application/pdf' : 'image/png',
    upsert: false,
  });
  if (upError) fail(`upload ${type}: ${upError.message}`);
  fileCount += 1;
  check(
    await db.from('document').insert({
      id,
      landlord_id: landlordId,
      type,
      storage_path: storagePath,
      file_name: `${slug(title)}.${isPdf ? 'pdf' : 'png'}`,
      mime: isPdf ? 'application/pdf' : 'image/png',
      size_bytes: bytes.length,
      ...row,
    }),
    `${type} document`,
  );
  return id;
}

async function removeFolder(oldLandlordId) {
  for (;;) {
    const { data: files, error } = await db.storage.from(BUCKET).list(oldLandlordId, { limit: 1000 });
    if (error) fail(`list old demo files: ${error.message}`);
    if (!files.length) return;
    check(await db.storage.from(BUCKET).remove(files.map((f) => `${oldLandlordId}/${f.name}`)), 'remove old demo files');
  }
}

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit || data.users.length < 1000) return hit ?? null;
  }
}

function reminderBody(level, t, entry) {
  const first = firstName(t.tenant.name);
  const month = monthName(entry.month);
  const due = displayDate(entry.dueDate);
  if (level === 'gentle') {
    return `Hi ${first}, a gentle reminder that the rent of ${rupees(entry.amountDue)} for ${month} was due on ${due}. Please pay when you can. — ${L.name}`;
  }
  if (level === 'direct') {
    return `Hi ${first}, the rent of ${rupees(entry.amountDue)} for ${month}, due on ${due}, is still unpaid. Please pay it this week. — ${L.name}`;
  }
  return `Dear ${t.tenant.name}, the rent of ${rupees(entry.amountDue)} for ${month}, due on ${due} under our agreement, remains unpaid. Please pay it immediately. — ${L.name}`;
}

function dispatchBody(r, t) {
  const unit = `Flat ${unitNumber.get(r.unit)}, ${d.properties[0].name}, ${d.properties[0].address}`;
  return `Hello ${r.vendor.name}, a ${r.category.toLowerCase()} job at ${unit}: ${r.description} Tenant: ${t.tenant.name}, ${t.tenant.phone}. — ${L.name}`;
}

function statementText(s, t) {
  const lines = s.deductions.map((x) => `- ${x.description}: ${rupees(x.amount)}. ${x.reason}`);
  return [
    `Deposit settlement for Flat ${unitNumber.get(t.unit)}, ${d.properties[0].name}.`,
    `Tenant: ${t.tenant.name}. Tenancy ${displayDate(t.startedOn)} to ${displayDate(t.endedOn)}.`,
    `Deposit held: ${rupees(s.depositHeld)}.`,
    'Deductions:',
    ...lines,
    `Total deductions: ${rupees(s.totalDeductions)}. Refund due to the tenant: ${rupees(s.balance.amount)}.`,
  ].join('\n');
}

// Display helpers for message text only (the app's own formatters are TypeScript, src/lib/format).
function rupees(n) {
  const s = String(n);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${rest ? `${rest},${last3}` : last3}`;
}
function displayDate(iso) {
  return `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
function monthName(key) {
  return `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}
function firstName(name) {
  return name.split(' ')[0];
}
function istStamp(date, time) {
  return `${date}T${time}:00+05:30`;
}
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'file';
}

// A plain 640×480 PNG in a muted tone per document type: enough for the galleries to render.
function placeholderPng(type) {
  const tones = {
    move_in_photo: [214, 226, 232], move_out_photo: [232, 220, 214], request_before_photo: [236, 224, 206],
    request_after_photo: [212, 232, 216], deduction_photo: [232, 214, 214],
  };
  const [r, g, b] = tones[type] ?? [226, 230, 234];
  const width = 640;
  const height = 480;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (name, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(name, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

// A one-page PDF carrying the document's title, so the viewer opens something readable.
function placeholderPdf(title) {
  const text = `Demo document: ${title}`.replace(/[()\\]/g, '').replace(/[^\x20-\x7e]/g, '-');
  const stream = `BT /F1 14 Tf 56 760 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8').split('\n')
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

function one({ data, error }, what) {
  if (error) fail(`${what}: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) fail(`${what}: no row returned`);
  return row;
}

function check({ error }, what) {
  if (error) fail(`${what}: ${error.message}`);
}

function fail(message) {
  console.error(`seed:demo failed — ${message}`);
  process.exit(1);
}
