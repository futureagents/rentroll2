"use client";
// A2 gallery. Shows every component in every state so the library can be reviewed in
// isolation (build tracker phase 1: "Every component in A2 exists in isolation with all
// its states"). Dev-only; never imported by product screens.
import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  DateField,
  DetailPanel,
  Dropdown,
  EmptyState,
  formatRupees,
  formatRupeesShort,
  MoneyField,
  PhoneField,
  PhotoUploader,
  RowActions,
  SegmentedChoice,
  Spinner,
  StatCard,
  StatusChip,
  TextArea,
  TextField,
  Timeline,
  ToastProvider,
  ToastView,
  Tooltip,
  useToast,
  type ButtonSize,
  type ButtonVariant,
  type ChipTone,
  type Column,
  type UploaderPhoto,
} from "@/components/ui";

export function Gallery() {
  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-[1100px] flex-col gap-8 p-4 lg:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink">A2 · Component library</h1>
          <p className="text-small text-muted">
            Every component in every state. Tokens from A1 only. Resize under 640px to see stacked
            table cards and the full-screen panel.
          </p>
        </header>
        <Buttons />
        <Fields />
        <StatCards />
        <Chips />
        <Tables />
        <Panels />
        <Timelines />
        <EmptyStates />
        <Toasts />
        <Dialogs />
      </main>
    </ToastProvider>
  );
}

/* ---------- layout helpers ---------- */

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-h`} className="text-h2 text-ink">
          {title}
        </h2>
        {note && <p className="text-small text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label uppercase text-muted">{label}</span>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

/* ---------- buttons ---------- */

const TEXT_VARIANTS: Exclude<ButtonVariant, "icon">[] = ["primary", "secondary", "quiet", "danger"];
const SIZES: ButtonSize[] = [32, 40, 48];

function Buttons() {
  return (
    <Section id="buttons" title="Buttons" note="Five variants, three heights (32 compact, 40 default, 48 tenant), disabled with a tooltip, inline spinner.">
      {SIZES.map((size) => (
        <Row key={size} label={`${size}px`}>
          {TEXT_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size={size}>
              {capitalise(variant)}
            </Button>
          ))}
          <Button variant="icon" icon="call" label="Call tenant" size={size} />
          <Button variant="icon" icon="copy" label="Copy link" size={size} />
          <Button variant="icon" icon="share" label="Share" size={size} />
          <Button variant="icon" icon="print" label="Print receipt" size={size} />
        </Row>
      ))}
      <Row label="With leading icon">
        <Button icon="plus">Add unit</Button>
        <Button variant="secondary" icon="bell">
          Remind
        </Button>
        <Button variant="quiet" icon="note" size={32}>
          Log call
        </Button>
        <Button variant="danger" icon="trash">
          Delete unit
        </Button>
      </Row>
      <Row label="Disabled — hover or focus for the reason">
        {TEXT_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} disabled disabledReason="Choose a tenant first">
            {capitalise(variant)}
          </Button>
        ))}
        <Button variant="icon" icon="print" label="Print receipt" disabled disabledReason="No receipt yet" />
      </Row>
      <Row label="Loading — spinner inside the button, nothing else blocks">
        {TEXT_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} loading>
            Saving
          </Button>
        ))}
        <Button variant="icon" icon="copy" label="Copy link" loading />
        <Button loading size={48}>
          Uploading photo…
        </Button>
      </Row>
      <Row label="Block (tenant screens)">
        <div className="w-full max-w-[360px]">
          <Button size={48} block>
            Report a problem
          </Button>
        </div>
      </Row>
      <Row label="Spinner and tooltip on their own">
        <Spinner />
        <Spinner size={24} className="text-primary" />
        <Tooltip label="Scan the code with your phone instead.">
          <span className="rounded-sm border border-line px-2 py-1 text-small">Hover me</span>
        </Tooltip>
      </Row>
    </Section>
  );
}

/* ---------- fields ---------- */

const LONG_TEXT =
  "The kitchen tap has been dripping for three days and the sound keeps us awake at night. We tried tightening it but the washer looks worn. Water collects under the sink and the wooden board is starting to swell. Please send someone this week if possible, mornings are best because we are at work after ten. Also the bathroom exhaust fan makes a rattling noise when it starts. ".repeat(2);

function Fields() {
  const [text, setText] = useState("");
  const [email, setEmail] = useState("ravi@example");
  const [money, setMoney] = useState<number | null>(186000);
  const [money2, setMoney2] = useState<number | null>(null);
  const [phone, setPhone] = useState("98765432");
  const [phone2, setPhone2] = useState("");
  const [date, setDate] = useState("2026-10-18");
  const [date2, setDate2] = useState("");
  const [choice, setChoice] = useState("");
  const [choice2, setChoice2] = useState("1bhk");
  const [urgency, setUrgency] = useState<"urgent" | "normal" | "low" | null>("normal");
  const [filter, setFilter] = useState<"pending" | "overdue" | "paid" | null>(null);
  const [notes, setNotes] = useState("");
  const [longNotes, setLongNotes] = useState(LONG_TEXT.trim());
  const [photos, setPhotos] = useState<UploaderPhoto[]>(demoPhotos(2));

  const unitOptions = [
    { value: "1bhk", label: "1 BHK" },
    { value: "2bhk", label: "2 BHK" },
    { value: "shop", label: "Shop" },
  ];

  return (
    <Section id="fields" title="Form fields" note="Label above, helper below, error replaces the helper. Validation runs on blur, not on keystroke: type, then tab away.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Tenant name" value={text} onChange={setText} placeholder="Full name" helper="As it should appear on receipts." required />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          helper="Blur to validate"
          validate={(v) => (v && !v.includes("@") ? "Enter an email address with an @." : v && !v.includes(".") ? "That email address looks incomplete." : null)}
        />
        <TextField label="Email (controlled error)" type="email" value="ravi@example" onChange={() => undefined} error="Email or password is incorrect." />
        <TextField label="Property" value="Sunrise Apartments" onChange={() => undefined} disabled helper="Set during first-run setup." />

        <MoneyField label="Monthly rent" value={money} onChange={setMoney} helper="Whole rupees. Indian grouping as you type." required />
        <MoneyField label="Deposit" value={money2} onChange={setMoney2} required helper="Blur while empty to see the required message" />
        <MoneyField label="Deposit (controlled error)" value={4000} onChange={() => undefined} error="Deposit cannot be less than one month's rent." />
        <MoneyField label="Repair cost" value={2500} onChange={() => undefined} disabled />

        <PhoneField label="Mobile" value={phone} onChange={setPhone} helper="10 digits. Spaces and dashes are stripped." />
        <PhoneField label="Mobile (required)" value={phone2} onChange={setPhone2} required />
        <PhoneField label="Mobile (controlled error)" value="9876543210" onChange={() => undefined} error="This number is already on another tenant." />
        <PhoneField label="Landlord mobile" value="9876543210" onChange={() => undefined} disabled />

        <DateField label="Agreement start" value={date} onChange={setDate} helper="Native picker; shown as DD MMM YYYY." />
        <DateField label="Agreement end" value={date2} onChange={setDate2} required />
        <DateField label="Move-in date (controlled error)" value="2026-11-01" onChange={() => undefined} error="Move-in cannot be after the agreement end." />
        <DateField label="Deposit paid on" value="2026-01-05" onChange={() => undefined} disabled />

        <Dropdown label="Unit type" value={choice} onChange={setChoice} options={unitOptions} placeholder="Choose a unit type" helper="Placeholder is never a valid choice." required />
        <Dropdown label="Unit type (chosen)" value={choice2} onChange={setChoice2} options={unitOptions} />
        <Dropdown label="Unit type (controlled error)" value="" onChange={() => undefined} options={unitOptions} error="Choose a unit type to continue." />
        <Dropdown label="Unit type" value="shop" onChange={() => undefined} options={unitOptions} disabled />

        <TextArea label="Describe the problem" value={notes} onChange={setNotes} placeholder="What is wrong, and since when?" helper="Grows to 8 lines, then scrolls." />
        <TextArea label="Message (counter past 400)" value={longNotes} onChange={setLongNotes} maxLength={1000} />
        <TextArea label="Notes (controlled error)" value="" onChange={() => undefined} error="A short description helps the landlord act." />
        <TextArea label="Notes" value="Read only while the request is closed." onChange={() => undefined} disabled minLines={2} />
      </div>

      <Row label="Segmented choice — 2, 3 and 4 options; three heights; disabled; error">
        <SegmentedChoice label="Urgency" options={[{ value: "urgent", label: "Urgent" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} value={urgency} onChange={setUrgency} />
        <SegmentedChoice label="Show" options={[{ value: "pending", label: "Pending" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }]} value={filter} onChange={setFilter} size={32} helper="Nothing chosen yet" />
        <SegmentedChoice label="Tone" options={[{ value: "friendly", label: "Friendly" }, { value: "firm", label: "Firm" }, { value: "final", label: "Final" }, { value: "custom", label: "Custom" }]} value="firm" onChange={() => undefined} size={48} />
        <SegmentedChoice label="Furnished" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} value="yes" onChange={() => undefined} disabled />
        <SegmentedChoice label="Urgency (error)" options={[{ value: "urgent", label: "Urgent" }, { value: "normal", label: "Normal" }]} value={null} onChange={() => undefined} error="Pick how urgent this is." />
      </Row>

      <Row label="Photo uploader (S-04 placeholder) — empty, uploading, error on a thumbnail, at the limit, disabled">
        <div className="grid w-full gap-4 lg:grid-cols-2">
          <PhotoUploader label="Photos" photos={photos} max={3} onAdd={(files) => setPhotos((p) => [...p, ...files.map((f, i) => demoPhoto(`new-${Date.now()}-${i}`, `Photo ${p.length + i + 1}`, 35))])} onRemove={(id) => setPhotos((p) => p.filter((x) => x.id !== id))} helper="Tenant screens: up to 3. Add to see a thumbnail with its progress ring." capture="environment" />
          <PhotoUploader label="Photos (uploading)" photos={[demoPhoto("u1", "Leaking kitchen tap", 100), demoPhoto("u2", "Water under the sink", 62), demoPhoto("u3", "Swollen cabinet board", 10)]} max={10} onAdd={() => undefined} onRemove={() => undefined} />
          <PhotoUploader label="Photos (errors)" photos={[{ ...demoPhoto("e1", "Large photo"), error: "That file is too large" }, { ...demoPhoto("e2", "PDF scan"), error: "That file type is not supported" }]} max={10} onAdd={() => undefined} onRemove={() => undefined} />
          <PhotoUploader label="Photos (at the limit)" photos={demoPhotos(3)} max={3} onAdd={() => undefined} onRemove={() => undefined} />
          <PhotoUploader label="Logo (disabled)" photos={[]} max={1} onAdd={() => undefined} onRemove={() => undefined} disabled helper="Available after setup." />
        </div>
      </Row>
    </Section>
  );
}

function demoPhoto(id: string, alt: string, progress?: number): UploaderPhoto {
  const shade = ["lightsteelblue", "lightslategray", "slategray", "cadetblue"][id.length % 4];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='${shade}'/><circle cx='48' cy='40' r='14' fill='white' fill-opacity='.5'/></svg>`;
  return { id, alt, src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, progress };
}
function demoPhotos(n: number): UploaderPhoto[] {
  return Array.from({ length: n }, (_, i) => demoPhoto(`p${i}`, `Photo ${i + 1} of the problem`));
}

/* ---------- stat cards ---------- */

function StatCards() {
  return (
    <Section id="stat-cards" title="Stat card" note="Uppercase label, display-size number, optional comparison. The whole card is the link when it has a destination. Stat cards may abbreviate money (D-19).">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Collected this month" value={formatRupeesShort(210000)} comparison={`${formatRupeesShort(186000)} last month`} href="/dev/components#stat-cards" />
        <StatCard label="Overdue" value="3" comparison="2 over 10 days" tone="danger" href="/dev/components#stat-cards" />
        <StatCard label="Open requests" value="5" comparison="1 urgent" tone="warning" />
        <StatCard label="Expiring in 90 days" value="2" />
        <StatCard label="Deposits held" value={formatRupees(360000)} />
        <StatCard label="Vacant units" value="0" tone="success" comparison="All 12 occupied" />
        <StatCard label="Loading" value="" loading />
        <StatCard label="Loading" value="" loading />
      </div>
    </Section>
  );
}

/* ---------- chips ---------- */

const CHIPS: { tone: ChipTone; words: string[] }[] = [
  { tone: "success", words: ["Paid", "Occupied", "Done"] },
  { tone: "warning", words: ["4 days late", "Notice period", "Expires in 45 days"] },
  { tone: "danger", words: ["14 days late", "Urgent", "Expires in 12 days"] },
  { tone: "neutral", words: ["Due", "Vacant", "Normal", "Expires in 75 days"] },
  { tone: "muted", words: ["Low"] },
  { tone: "primary", words: ["Received", "In progress"] },
];

function Chips() {
  return (
    <Section id="chips" title="Status chip" note="12% tint, full-colour text, always a word. Six tones; muted is the L-06 Low urgency chip.">
      {CHIPS.map(({ tone, words }) => (
        <Row key={tone} label={tone}>
          {words.map((word) => (
            <StatusChip key={word} tone={tone}>
              {word}
            </StatusChip>
          ))}
        </Row>
      ))}
    </Section>
  );
}

/* ---------- tables ---------- */

interface RentRow {
  id: string;
  unit: string;
  tenant: string;
  due: number;
  daysLate: number;
  status: "paid" | "due" | "late";
}

const RENT_ROWS: RentRow[] = [
  { id: "r1", unit: "A-101", tenant: "Ravi Kumar", due: 18000, daysLate: 0, status: "paid" },
  { id: "r2", unit: "A-102", tenant: "Meena Iyer", due: 22000, daysLate: 4, status: "late" },
  { id: "r3", unit: "B-201", tenant: "Arjun Shah", due: 186000, daysLate: 14, status: "late" },
  { id: "r4", unit: "B-202", tenant: "Priya Nair", due: 15000, daysLate: 0, status: "due" },
  { id: "r5", unit: "Shop 1", tenant: "Sharma Traders", due: 45000, daysLate: 0, status: "paid" },
];

function rentChip(row: RentRow) {
  if (row.status === "paid") return <StatusChip tone="success">Paid</StatusChip>;
  if (row.status === "due") return <StatusChip tone="neutral">Due</StatusChip>;
  return <StatusChip tone={row.daysLate >= 10 ? "danger" : "warning"}>{row.daysLate} days late</StatusChip>;
}

function Tables() {
  const [selected, setSelected] = useState<string | null>("r2");
  const [lastAction, setLastAction] = useState("Click a row to select it; row buttons do not select.");
  const columns: Column<RentRow>[] = [
    { id: "unit", header: "Unit", cell: (r) => <span className="text-ink">{r.unit}</span>, sortValue: (r) => r.unit, key: true },
    { id: "tenant", header: "Tenant", cell: (r) => r.tenant, sortValue: (r) => r.tenant },
    { id: "due", header: "Amount due", cell: (r) => formatRupees(r.due), sortValue: (r) => r.due, align: "right", key: true },
    { id: "status", header: "Status", cell: rentChip, sortValue: (r) => (r.status === "paid" ? 0 : r.status === "due" ? 1 : 1 + r.daysLate), key: true },
    {
      id: "actions",
      header: "",
      actions: true,
      cell: (r) => (
        <RowActions>
          <Button variant="quiet" size={32} onClick={() => setLastAction(`Remind ${r.tenant}`)}>
            Remind
          </Button>
          <Button variant="icon" icon="call" label={`Call ${r.tenant}`} onClick={() => setLastAction(`Call ${r.tenant}`)} />
        </RowActions>
      ),
    },
  ];
  return (
    <Section id="tables" title="Data table" note="Sticky header, sortable columns with an arrow, hover fill, 48px rows, selected row, row actions that do not open the row. Under 640px it becomes stacked cards with the key fields only.">
      <p className="text-small text-muted" aria-live="polite">
        {lastAction}
      </p>
      <DataTable columns={columns} rows={RENT_ROWS} rowKey={(r) => r.id} caption="Rent due this month" selectedKey={selected} onRowClick={(r) => { setSelected(r.id); setLastAction(`Opened ${r.unit}`); }} mobileTitle={(r) => `${r.unit} · ${r.tenant}`} />
      <Row label="Loading">
        <div className="w-full">
          <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} caption="Loading rent" loading />
        </div>
      </Row>
      <Row label="Empty (E2-01)">
        <div className="w-full">
          <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} caption="Rent, no units" empty={{ message: "Add a unit and this month's rent will appear here.", action: { label: "Add unit", onClick: () => setLastAction("Add unit") } }} />
        </div>
      </Row>
    </Section>
  );
}

/* ---------- panels ---------- */

function Panels() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const dirty = draft !== "";
  return (
    <Section id="panels" title="Detail panel" note="Slides in from the right, 480px on desktop, full screen under 640px. Escape, backdrop and the close button all close it; it asks first when a field has unsaved edits.">
      <Row label="Open">
        <Button variant="secondary" onClick={() => { setLoading(false); setOpen(true); }}>
          Open panel
        </Button>
        <Button variant="secondary" onClick={() => { setLoading(true); setOpen(true); }}>
          Open loading panel
        </Button>
      </Row>
      <DetailPanel
        open={open}
        onClose={() => { setOpen(false); setDraft(""); }}
        title="A-102 · October 2026"
        subtitle="Meena Iyer · due 5 Oct 2026"
        dirty={dirty}
        loading={loading}
        footer={
          <>
            <Button variant="quiet" onClick={() => { setOpen(false); setDraft(""); }}>
              Cancel
            </Button>
            <Button onClick={() => { setOpen(false); setDraft(""); }}>Save note</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StatusChip tone="warning">4 days late</StatusChip>
            <span className="text-body text-ink">{formatRupees(22000)}</span>
          </div>
          <TextArea label="Note" value={draft} onChange={setDraft} helper="Type here, then press Escape to see the unsaved-edits warning." />
          <Timeline events={DEMO_EVENTS.slice(0, 2)} />
        </div>
      </DetailPanel>
    </Section>
  );
}

/* ---------- timeline ---------- */

const DEMO_EVENTS = [
  { id: "t1", icon: "bell" as const, text: "Reminder sent · Firm tone", at: "2026-10-16T09:30:00", tone: "warning" as const },
  { id: "t2", icon: "call" as const, text: "Call logged · Tenant will pay by Friday", at: "2026-10-12T18:05:00", tone: "primary" as const },
  { id: "t3", icon: "bell" as const, text: "Reminder sent · Friendly tone", at: "2026-10-08T09:00:00" },
  { id: "t4", icon: "rupee" as const, text: "Rent row created for October", at: "2026-10-01T00:00:00", tone: "success" as const },
];

function Timelines() {
  return (
    <Section id="timeline" title="Timeline" note="Newest first, each with an icon, one line and a timestamp.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Timeline events={DEMO_EVENTS} />
        <Timeline events={[]} loading />
        <Timeline events={[]} empty="No reminders have been sent for this month." />
      </div>
    </Section>
  );
}

/* ---------- empty states ---------- */

function EmptyStates() {
  const toast = useToast();
  return (
    <Section id="empty" title="Empty state" note="One line and the button that creates the first one; no button when E2 says None.">
      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState message="Your properties and units live here." action={{ label: "Add your first unit", onClick: () => toast.show({ message: "Add unit pressed." }) }} />
        <EmptyState message="Everything is paid for February. Nice." />
        <EmptyState message="No open requests. Tenants report problems through their unit link." action={{ label: "Print door QR codes", variant: "secondary", onClick: () => toast.show({ message: "Print pressed." }) }} />
        <EmptyState message="Receipts appear here once your landlord records a payment." />
      </div>
    </Section>
  );
}

/* ---------- toasts ---------- */

function Toasts() {
  const toast = useToast();
  return (
    <Section id="toasts" title="Toast" note="Bottom-centre, one line, 4 seconds, optional Undo. Live buttons show the real one; the static views below show both shapes.">
      <Row label="Live">
        <Button variant="secondary" onClick={() => toast.show({ message: "Reminder recorded on the tenant's history." })}>
          Show toast (4s)
        </Button>
        <Button variant="secondary" onClick={() => toast.show({ message: "Payment recorded. Receipt RR-0847 created.", duration: 10000, undo: { onUndo: () => toast.show({ message: "Payment undone." }) } })}>
          Show Undo toast (10s, D-11)
        </Button>
        <Button variant="secondary" onClick={() => toast.show({ message: "Copied.", duration: 2000 })}>
          Show Copied (2s, E1-03)
        </Button>
      </Row>
      <Row label="Static">
        <ToastView message="Downloaded rent-2026-02.csv" />
        <ToastView message="Payment recorded. Receipt RR-0847 created." undo={{ onUndo: () => undefined }} />
      </Row>
    </Section>
  );
}

/* ---------- dialogs ---------- */

function Dialogs() {
  const toast = useToast();
  const [which, setWhich] = useState<"none" | "plain" | "danger" | "loading">("none");
  // The loading dialog cannot be dismissed while its spinner runs, so the demo resolves itself.
  useEffect(() => {
    if (which !== "loading") return;
    const timer = window.setTimeout(() => setWhich("none"), 3000);
    return () => window.clearTimeout(timer);
  }, [which]);
  return (
    <Section id="dialogs" title="Confirm dialog" note="Title as a question, one line of consequence, Cancel plus an action button that names the action. Never OK. Danger buttons always sit behind one.">
      <Row label="Open">
        <Button variant="secondary" onClick={() => setWhich("plain")}>
          Mark as paid…
        </Button>
        <Button variant="danger" onClick={() => setWhich("danger")}>
          Delete unit…
        </Button>
        <Button variant="secondary" onClick={() => setWhich("loading")}>
          Loading state…
        </Button>
      </Row>
      <ConfirmDialog
        open={which === "plain"}
        title="Record this payment?"
        consequence="A receipt will be numbered and listed for the tenant."
        actionLabel="Record payment"
        onCancel={() => setWhich("none")}
        onConfirm={() => { setWhich("none"); toast.show({ message: "Payment recorded. Receipt RR-0847 created.", undo: { onUndo: () => undefined }, duration: 10000 }); }}
      />
      <ConfirmDialog
        open={which === "danger"}
        title="Delete unit A-101?"
        consequence="Its tenants, rent history and documents will be removed. This cannot be undone."
        actionLabel="Delete unit"
        destructive
        onCancel={() => setWhich("none")}
        onConfirm={() => { setWhich("none"); toast.show({ message: "Unit deleted." }); }}
      />
      <ConfirmDialog
        open={which === "loading"}
        title="End this tenancy?"
        consequence="The tenant's link stops working and the deposit moves to settlement."
        actionLabel="End tenancy"
        destructive
        loading
        onCancel={() => setWhich("none")}
        onConfirm={() => setWhich("none")}
      />
      <p className="text-small text-muted">The loading dialog cannot be dismissed while the spinner runs; the demo resolves after 3 seconds.</p>
    </Section>
  );
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
