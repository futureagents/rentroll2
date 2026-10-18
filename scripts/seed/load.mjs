#!/usr/bin/env node
// Loads the resolved demo dataset into the RentRoll database.
//
// TODO(schema): not implemented. The database schema does not exist yet, so there
// is nothing to map onto. This file deliberately refuses to run rather than guess
// table or column names. Once the schema lands, replace the body below with:
//
//   1. buildDataset(runDate) from ./build.mjs
//   2. a guard: refuse to run against anything but a local/demo database
//      (TODO: decide how a demo database is identified — env var, project ref)
//   3. delete the previous demo landlord's rows, then insert, in dependency order:
//      landlord → settings → vendors → properties → units → tenancies/agreements
//      → rent entries → payments/receipts → reminders → requests (+ timeline)
//      → settlements/deductions → documents/photos
//   4. generate unit/tenant link tokens the way the app does (never hand-written,
//      never derived from a unit number — UI/UX spec T-01)
//   5. upload placeholder images for every document with file: null (TODO: storage)
//
// The mapping decisions this depends on are listed in SPEC.md §9.

console.error('load.mjs: not implemented yet — the database schema does not exist (see scripts/seed/SPEC.md §9).');
console.error('Use build.mjs to inspect the dataset: node scripts/seed/build.mjs --summary');
process.exit(1);
