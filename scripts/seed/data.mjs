// RentRoll demo dataset — the authored half. build.mjs resolves it against a run date.
//
// Keys here are SEED-DOMAIN names in the vocabulary of the scope document's ERD
// (landlord, property, unit, tenant, rent entry, reminder, request, document).
// They are NOT database tables or columns; load.mjs maps them onto the schema
// (supabase/migrations, D-01…D-41).
//
// Conventions
//   { days: n }            run date + n days (negative = in the past)
//   { days: n, at: 'HH:MM' } same, with an Asia/Kolkata time of day
//   { monthsAgo: n, day: d } day d of the month n months before the run date's month
//   money                  whole rupees (D-19)
//   phones                 +91 and 10 digits, all 90000 00xxx — fictitious, but may
//                          still reach a real person: never send to them
//   emails                 @example.com / .example only

export const landlord = {
  name: 'Anil Kulkarni',
  phone: '+919000000001',
  email: 'anil.kulkarni@example.com',
  upiId: 'anil.kulkarni@okdemo', // shape name@handle (L-02); handle is not a real bank
  receiptName: 'Kulkarni Properties', // L02-FLD-BIZNAME / L15-FLD-RECEIPTNAME
};

export const settings = {
  reminderLadderDays: { gentle: 3, direct: 10, formal: 20 }, // L15-TBL-LADDER defaults
  escalationPercentDefault: 5, // L15-FLD-ESCDEFAULT — source gives no default; 5% chosen
  accountantEmail: 'office@gadgil-ca.example', // L15-FLD-CAEMAIL
};

export const vendors = [
  { key: 'V-PLUMB', name: 'Shinde Plumbing Works', phone: '+919000000201', trade: 'Plumbing' },
  { key: 'V-ELEC', name: 'Ramesh Electricals', phone: '+919000000202', trade: 'Electrical' },
  { key: 'V-WATER', name: 'Deshmukh Waterproofing', phone: '+919000000203', trade: 'Structural' },
  { key: 'V-GLASS', name: 'Sai Glass & Aluminium', phone: '+919000000204', trade: 'Glass' },
  { key: 'V-PEST', name: 'Pune Pest Control Services', phone: '+919000000205', trade: 'Pest' },
];

// Rent history covers the run month and the two before it: 3 months (product owner's brief).
export const historyMonths = 3;

// 1 property, 5 units: 4 let, 1 vacant. Unit rent/deposit are the current asking figures;
// for an occupied unit they equal the current agreement's.
export const properties = [
  {
    key: 'P-KUL',
    name: 'Kulkarni Apartments', // the property named in the UI/UX spec examples
    address: 'Plot 14, Mayur Colony, Kothrud, Pune 411038',
    depositMonths: 3, // deposit taken at move-in = 3 × first term's rent
    units: [
      { key: 'K-1B', unitNumber: '1B', type: '1BHK', rent: 16000, deposit: 48000 },
      { key: 'K-2A', unitNumber: '2A', type: '2BHK', rent: 18000, deposit: 54000 },
      { key: 'K-2B', unitNumber: '2B', type: '2BHK', rent: 18000, deposit: 54000 }, // vacant
      { key: 'K-3A', unitNumber: '3A', type: '2BHK', rent: 17000, deposit: 51000 },
      { key: 'K-4C', unitNumber: '4C', type: '2BHK', rent: 18000, deposit: 54000 },
    ],
  },
];

const MOVE_IN_PHOTOS = [
  'Living room — walls, floor and windows',
  'Kitchen — platform, sink and cabinets',
  'Bedroom — walls, window and wardrobe',
  'Bathroom — tiles, taps and geyser',
  'Main door, lock and safety door',
  'Switchboards and electricity meter reading',
];

// Agreements: 11-month leave-and-licence terms, chained back from the current
// term's end (`currentEnd`) or forward from `start`. `rents` lists every term's
// monthly rent, oldest first. The tenancy starts on the first term's start date.
//
// dueDay: day of month rent falls due — a number, or { days: n } meaning
// "the day-of-month of run date + n". The latter pins a scenario row to an exact
// number of days overdue whatever the run date (see SPEC.md §3).
//
// pays: how past rows were paid — 'onTime' (2 days before due, not before the 1st)
// or { lateEvery: k, daysLate: n } (every k-th month paid n days late).
export const tenancies = [
  {
    key: 'TN-1B', unit: 'K-1B',
    tenant: { name: 'Anjali Iyer', phone: '+919000000102', email: 'anjali.iyer@example.com' },
    agreement: { currentEnd: { days: 150 }, termMonths: 11, rents: [15000, 16000] },
    dueDay: 5, pays: 'onTime', moveInPhotos: MOVE_IN_PHOTOS, idProof: true,
    scenarios: ['SC-05', 'SC-20', 'SC-25', 'SC-27'], // paid on time
  },
  {
    key: 'TN-2A', unit: 'K-2A',
    tenant: { name: 'Meera Desai', phone: '+919000000103', email: 'meera.desai@example.com' },
    agreement: { currentEnd: { days: 130 }, termMonths: 11, rents: [18000] },
    // Every second month of the 3-month window is paid 6 days late: last month's row.
    dueDay: 5, pays: { lateEvery: 2, daysLate: 6 }, moveInPhotos: MOVE_IN_PHOTOS, idProof: true,
    scenarios: ['SC-04', 'SC-24', 'SC-26'], // paid late
  },
  {
    key: 'TN-3A', unit: 'K-3A',
    tenant: { name: 'Priya Deshpande', phone: '+919000000104', email: 'priya.deshpande@example.com' },
    agreement: { currentEnd: { days: 22 }, termMonths: 11, rents: [16000, 17000] },
    dueDay: { days: 0 }, pays: 'onTime', moveInPhotos: MOVE_IN_PHOTOS, idProof: true,
    partPaidRow: { dueOffsetDays: 0, amount: 8000, paidOffsetDays: -2 },
    scenarios: ['SC-03', 'SC-12', 'SC-23'], // part paid, due today; agreement ends in 22 days
  },
  {
    key: 'TN-4C', unit: 'K-4C',
    tenant: { name: 'Suresh Khan', phone: '+919000000108', email: null }, // no email: S01-BTN-EMAIL hidden
    agreement: { currentEnd: { days: 180 }, termMonths: 11, rents: [17000, 18000] },
    dueDay: { days: -18 }, pays: 'onTime', moveInPhotos: [], idProof: false, // no move-in photos, no ID proof
    overdueRow: { dueOffsetDays: -18 },
    reminders: [
      { level: 'gentle', method: 'WhatsApp', afterDue: 3 },
      { level: 'direct', method: 'WhatsApp', afterDue: 10 },
      { method: 'call', afterDue: 15, outcome: 'promised_to_pay', note: 'Said salary is delayed this month; will pay by the weekend.' },
    ],
    scenarios: ['SC-01', 'SC-28', 'SC-40', 'SC-41', 'SC-42'], // overdue
  },
  {
    // Former tenancy of the now-vacant 2B: ended and settled.
    key: 'TN-2B-OLD', unit: 'K-2B',
    tenant: { name: 'Arjun Mehta', phone: '+919000000113', email: 'arjun.mehta@example.com' },
    agreement: { currentEnd: { days: -25 }, termMonths: 11, rents: [17000, 17500] },
    dueDay: 5, pays: 'onTime', moveInPhotos: MOVE_IN_PHOTOS, idProof: true,
    endedOn: { days: -25 },
    moveOutPhotos: ['Bedroom wall with marker drawings', 'Kitchen platform and hob, uncleaned'],
    scenarios: ['SC-31'],
  },
];

// Maintenance requests. status: New · Assigned · In progress · Done (L-06).
// cost: number, or 'no cost' (explicit, L-06 rule), or null while open.
export const requests = [
  // SC-25: repeated plumbing on 1B — 4 reports inside 12 months
  {
    key: 'RQ-1B-SINK', unit: 'K-1B', tenancy: 'TN-1B', category: 'Plumbing', urgency: 'Normal',
    description: 'Kitchen sink drain is blocked, water is not going down.',
    reportedAt: { days: -300, at: '08:40' }, reportedBy: 'tenant link',
    vendor: 'V-PLUMB', assignedAt: { days: -300, at: '11:00' }, closedAt: { days: -299, at: '17:30' },
    status: 'Done', cost: 450, photosBefore: ['Kitchen sink full of standing water'], photosAfter: [],
  },
  {
    key: 'RQ-1B-FLUSH', unit: 'K-1B', tenancy: 'TN-1B', category: 'Plumbing', urgency: 'Normal',
    description: 'Bathroom flush keeps running after every use.',
    reportedAt: { days: -190, at: '19:10' }, reportedBy: 'tenant link',
    vendor: 'V-PLUMB', assignedAt: { days: -189, at: '10:15' }, closedAt: { days: -187, at: '13:00' },
    status: 'Done', cost: 700, photosBefore: [], photosAfter: [],
  },
  {
    key: 'RQ-1B-BASIN', unit: 'K-1B', tenancy: 'TN-1B', category: 'Plumbing', urgency: 'Low',
    description: 'Water leaking slowly from under the wash basin.',
    reportedAt: { days: -75, at: '07:55' }, reportedBy: 'tenant link',
    vendor: 'V-PLUMB', assignedAt: { days: -74, at: '09:30' }, closedAt: { days: -72, at: '16:45' },
    status: 'Done', cost: 350, photosBefore: ['Wet floor under the wash basin'], photosAfter: ['New basin waste pipe fitted'],
  },
  // SC-20: urgent, brand new (wireframe "1B · geyser leaking, urgent")
  {
    key: 'RQ-1B-GEYSER', unit: 'K-1B', tenancy: 'TN-1B', category: 'Plumbing', urgency: 'Urgent',
    description: 'Geyser is leaking from the bottom since yesterday.',
    reportedAt: { days: -1, at: '21:40' }, reportedBy: 'tenant link',
    status: 'New', cost: null, photosBefore: ['Water dripping from the bottom of the bathroom geyser'], photosAfter: [],
  },
  // SC-21: New, older than 48 hours (warning border)
  {
    key: 'RQ-4C-TAP', unit: 'K-4C', tenancy: 'TN-4C', category: 'Plumbing', urgency: 'Normal',
    description: 'Kitchen tap keeps dripping all night even when fully closed.',
    reportedAt: { days: -3, at: '22:15' }, reportedBy: 'tenant link',
    status: 'New', cost: null, photosBefore: [], photosAfter: [],
  },
  // SC-22: New, older than 7 days (danger border), logged by the landlord from a phone call
  {
    key: 'RQ-3A-LOCK', unit: 'K-3A', tenancy: 'TN-3A', category: 'Other', urgency: 'Low',
    description: 'Balcony door lock is stiff and hard to turn.',
    reportedAt: { days: -9, at: '18:20' }, reportedBy: 'phone call',
    status: 'New', cost: null, photosBefore: [], photosAfter: [],
  },
  // SC-23: Assigned
  {
    key: 'RQ-3A-FAN', unit: 'K-3A', tenancy: 'TN-3A', category: 'Electrical', urgency: 'Normal',
    description: 'Bedroom ceiling fan runs very slowly even on full speed.',
    reportedAt: { days: -4, at: '10:05' }, reportedBy: 'tenant link',
    vendor: 'V-ELEC', assignedAt: { days: -3, at: '12:30' },
    status: 'Assigned', cost: null, photosBefore: [], photosAfter: [],
  },
  // SC-24: In progress
  {
    key: 'RQ-2A-SEEPAGE', unit: 'K-2A', tenancy: 'TN-2A', category: 'Structural', urgency: 'Normal',
    description: 'Damp patch on the bathroom wall is spreading towards the bedroom.',
    reportedAt: { days: -12, at: '09:00' }, reportedBy: 'tenant link',
    vendor: 'V-WATER', assignedAt: { days: -11, at: '11:20' }, startedAt: { days: -6, at: '10:00' },
    status: 'In progress', cost: null, photosBefore: ['Damp patch on the bathroom wall near the shower'], photosAfter: [],
  },
  // SC-26: Done with cost, before and after photos
  {
    key: 'RQ-2A-WASHER', unit: 'K-2A', tenancy: 'TN-2A', category: 'Appliance', urgency: 'Normal',
    description: 'Washing machine inlet pipe is leaking onto the utility floor.',
    reportedAt: { days: -20, at: '08:30' }, reportedBy: 'tenant link',
    vendor: 'V-PLUMB', assignedAt: { days: -20, at: '10:00' }, closedAt: { days: -19, at: '15:10' },
    status: 'Done', cost: 850,
    photosBefore: ['Puddle under the washing machine inlet'], photosAfter: ['Replaced inlet hose and tap washer'],
  },
  // SC-27: Done with an explicit "no cost"
  {
    key: 'RQ-1B-BELL', unit: 'K-1B', tenancy: 'TN-1B', category: 'Electrical', urgency: 'Low',
    description: 'Doorbell is not ringing.',
    reportedAt: { days: -35, at: '17:45' }, reportedBy: 'tenant link',
    closedAt: { days: -34, at: '11:00' }, closingNote: 'Loose wire at the switch, tightened during a visit.',
    status: 'Done', cost: 'no cost', photosBefore: [], photosAfter: [],
  },
  // SC-28: Done, tenant liable — cost to be recovered via a payment request (S-02)
  {
    key: 'RQ-4C-GLASS', unit: 'K-4C', tenancy: 'TN-4C', category: 'Structural', urgency: 'Normal',
    description: 'Bedroom window glass is cracked.',
    reportedAt: { days: -40, at: '13:20' }, reportedBy: 'tenant link',
    vendor: 'V-GLASS', assignedAt: { days: -39, at: '10:00' }, closedAt: { days: -37, at: '16:00' },
    status: 'Done', cost: 1200, tenantLiable: true, tenantLiablePaid: false,
    photosBefore: ['Cracked bedroom window pane'], photosAfter: ['New glass pane fitted'],
  },
  // SC-31: repair during the former 2B tenancy, later pulled into the settlement
  {
    key: 'RQ-2B-LATCH', unit: 'K-2B', tenancy: 'TN-2B-OLD', category: 'Structural', urgency: 'Low',
    description: 'Bedroom window latch has broken off.',
    reportedAt: { days: -210, at: '09:40' }, reportedBy: 'tenant link',
    vendor: 'V-GLASS', assignedAt: { days: -209, at: '11:00' }, closedAt: { days: -206, at: '14:30' },
    status: 'Done', cost: 600, photosBefore: ['Broken window latch hanging from the frame'], photosAfter: ['New window latch fitted'],
  },
];

// SC-31: settled move-out of 2B.
export const settlements = [
  {
    tenancy: 'TN-2B-OLD',
    preparedOn: { days: -15 },
    settledOn: { days: -12 },
    deductions: [
      {
        description: 'Repaint bedroom wall',
        reason: 'Marker drawings on the bedroom wall, not present in the move-in photos.',
        amount: 3500,
        photo: 'Bedroom wall with marker drawings',
      },
      {
        description: 'Window latch replacement',
        reason: 'Latch broken during the tenancy; repair recorded on the maintenance board.',
        amount: 600,
        fromRequest: 'RQ-2B-LATCH',
        photo: 'Broken window latch hanging from the frame',
      },
      {
        description: 'Deep cleaning',
        reason: 'Kitchen and bathrooms left greasy; professional cleaning needed before the next tenant.',
        amount: 1500,
        photo: null, // allowed with a warning (L-13 rule)
      },
    ],
  },
];
