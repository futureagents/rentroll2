"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { MessageComposer } from "@/components/composer";
import { PageHeader } from "@/components/shell/page-header";
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dropdown,
  EmptyState,
  RowActions,
  SegmentedChoice,
  StatCard,
  StatusChip,
  ToastProvider,
  useToast,
  type Column,
} from "@/components/ui";
import { unitLabel } from "@/lib/display/unit-label";
import { formatDate, formatMonth, formatRupees } from "@/lib/format";

import { bulkMarkPaidAction, createRentRowsAction } from "../actions";
import { addMonths, type IsoDate, type MonthKey } from "../_lib/calendar";
import { rentCsv, rentCsvFilename } from "../_lib/export";
import { planBulkPayments } from "../_lib/payments";
import {
  deriveRentState,
  matchesFilter,
  partPaidLine,
  rentChip,
  rowActions,
  summarise,
  type RentFilter,
  type RentState,
} from "../_lib/status";
import type { BoardEntry, RentBoardData, RentEntryDetail } from "../_lib/types";

import { MarkPaidForm } from "./mark-paid-form";
import { usePaymentToast } from "./payment-toast";
import { RentPanel } from "./rent-panel";
import { RowPopover } from "./row-popover";

export interface RentScreenProps {
  board: RentBoardData;
  detail: RentEntryDetail | null;
  today: IsoDate;
  currentMonth: MonthKey;
  missingRows: number;
  initialFilter: RentFilter;
  initialProperty: string;
}

/** L-04 Rent due board with L-05 over it. The toast provider sits outside the board so an Undo survives a month change. */
export function RentScreen(props: RentScreenProps) {
  return (
    <ToastProvider>
      <RentBoard key={props.board.month} {...props} />
    </ToastProvider>
  );
}

interface Row {
  entry: BoardEntry;
  state: RentState;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
] as const;

const ALL_PROPERTIES = "all";

/** L04-BTN-MARKPAID and its inline form (L04-FRM-MARKPAID †). */
function MarkPaidCell({
  row,
  today,
  open,
  onToggle,
}: {
  row: Row;
  today: IsoDate;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  // The data table renders every row twice (table, and the stacked card under 640px) and hides
  // one with CSS. Only the copy whose button was pressed opens, so the form never mounts twice.
  const [pressedHere, setPressedHere] = useState(false);
  return (
    <>
      <Button
        ref={anchor}
        variant="quiet"
        size={32}
        aria-expanded={open && pressedHere}
        onClick={() => {
          setPressedHere(true);
          onToggle(!(open && pressedHere));
        }}
      >
        Mark paid
      </Button>
      {open && pressedHere ? (
        <RowPopover anchor={anchor} label={`Mark ${unitLabel(row.entry)} paid`} onClose={() => onToggle(false)}>
          <MarkPaidForm
            rentEntryId={row.entry.id}
            state={row.state}
            today={today}
            onDone={() => onToggle(false)}
            onCancel={() => onToggle(false)}
          />
        </RowPopover>
      ) : null}
    </>
  );
}

/** A2: a disabled button always carries the reason, shown as its tooltip. */
function disabledWhen(
  disabled: boolean,
  reason: string,
): { disabled: true; disabledReason: string } | { disabled?: false; disabledReason?: undefined } {
  return disabled ? { disabled: true, disabledReason: reason } : {};
}


function RentBoard({ board, detail, today, currentMonth, missingRows, initialFilter, initialProperty }: RentScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const announce = usePaymentToast();
  const [filter, setFilter] = useState<RentFilter>(initialFilter);
  const [property, setProperty] = useState(
    board.properties.some((p) => p.id === initialProperty) ? initialProperty : ALL_PROPERTIES,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markPaidFor, setMarkPaidFor] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [remindFor, setRemindFor] = useState<string | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [rowsPending, startRows] = useTransition();
  const [navPending, startNav] = useTransition();
  const [requested, setRequested] = useState<{ id: string | null } | null>(null);

  const rows: Row[] = useMemo(
    () =>
      board.entries.map((entry) => ({
        entry,
        state: deriveRentState({ amountDue: entry.amountDue, dueOn: entry.dueOn }, entry.payments, today),
      })),
    [board.entries, today],
  );
  const visible = rows.filter(
    (r) => (property === ALL_PROPERTIES || r.entry.propertyId === property) && matchesFilter(r.state, filter),
  );
  const summary = summarise(visible.map((r) => r.state));
  const multipleProperties = board.properties.length > 1;
  const selectable = visible.filter((r) => rowActions(r.state).markPaid);
  const chosen = selectable.filter((r) => selected.has(r.entry.id));
  const bulkPlan = planBulkPayments(chosen.map((r) => ({ id: r.entry.id, state: r.state })));

  // The open panel: what the landlord last asked for while that navigation runs, otherwise what
  // the URL says (so Back and Forward still open and close it).
  const detailId = detail?.id ?? null;
  const panelId = requested && (navPending || requested.id === detailId) ? requested.id : detailId;
  const panelEntry = detail?.id === panelId ? detail : (board.entries.find((e) => e.id === panelId) ?? null);

  const query = (over: { month?: MonthKey; status?: RentFilter; property?: string } = {}) => {
    const params = new URLSearchParams();
    const month = over.month ?? board.month;
    const status = over.status ?? filter;
    const prop = over.property ?? property;
    if (month !== currentMonth) params.set("month", month);
    if (status !== "all") params.set("status", status);
    if (prop !== ALL_PROPERTIES) params.set("property", prop);
    const text = params.toString();
    return text ? `?${text}` : "";
  };

  // L04-SEG-FILTER: no reload, and the URL follows so the view can be shared or bookmarked.
  const replaceUrl = (search: string) => {
    window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  };

  const openEntry = (id: string) => {
    setRequested({ id });
    startNav(() => router.push(`/rent/${id}${query()}`, { scroll: false }));
  };
  const closePanel = () => {
    setRequested({ id: null });
    startNav(() => router.push(`/rent${query()}`, { scroll: false }));
  };

  const exportCsv = () => {
    const name = rentCsvFilename(board.month);
    const csv = rentCsv(
      visible.map((r) => ({
        propertyName: r.entry.propertyName,
        unitNumber: r.entry.unitNumber,
        tenantName: r.entry.tenantName,
        dueOn: r.entry.dueOn,
        isProRata: r.entry.isProRata,
        state: r.state,
      })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    toast.show({ message: `Downloaded ${name}` }); // E1-04
  };

  const createRows = () =>
    startRows(async () => {
      const result = await createRentRowsAction();
      toast.show({
        message: result.ok
          ? `Rent rows created for ${formatMonth(board.month)}.`
          : result.error,
      });
    });

  const recordBulk = () =>
    startBulk(async () => {
      const result = await bulkMarkPaidAction(bulkPlan.payments.map((p) => p.rentEntryId));
      setConfirmBulk(false);
      if (!result.ok) return toast.show({ message: result.error });
      setSelected(new Set());
      announce(result.payments);
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns: Column<Row>[] = [
    {
      id: "select",
      header: "Select",
      key: true,
      width: "3rem",
      cell: (r) =>
        rowActions(r.state).markPaid ? (
          <RowActions>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={selected.has(r.entry.id)}
              onChange={() => toggle(r.entry.id)}
              aria-label={`Select ${unitLabel(r.entry)} for bulk mark paid`}
            />
          </RowActions>
        ) : null,
    },
    {
      id: "unit",
      header: "Unit",
      sortValue: (r) => `${r.entry.propertyName} ${r.entry.unitNumber.padStart(8, "0")}`,
      cell: (r) => (
<span className="text-ink">{unitLabel(r.entry)}</span>
      ),
    },
    { id: "tenant", header: "Tenant", key: true, sortValue: (r) => r.entry.tenantName, cell: (r) => r.entry.tenantName },
    {
      id: "rent",
      header: "Rent",
      key: true,
      align: "right",
      sortValue: (r) => r.state.due,
      cell: (r) => (
        <div className="flex flex-col items-end">
          <span>{formatRupees(r.state.due)}</span>
          {r.entry.isProRata ? <span className="text-small text-muted">pro-rata</span> : null}
        </div>
      ),
    },
    { id: "due", header: "Due date", sortValue: (r) => r.entry.dueOn, cell: (r) => formatDate(r.entry.dueOn) },
    {
      id: "status",
      header: "Status",
      key: true,
      sortValue: (r) => (r.state.status === "paid" ? -1 : r.state.daysLate),
      cell: (r) => {
        const chip = rentChip(r.state);
        const part = partPaidLine(r.state);
        return (
          <div className="flex flex-col items-start gap-1 py-2">
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
            {part ? <span className="text-small text-body">{part}</span> : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      actions: true,
      cell: (r) => {
        const actions = rowActions(r.state);
        const latest = r.entry.payments.filter((p) => p.status === "recorded").at(-1);
        return (
          <RowActions>
            {actions.remind ? (
              <Button variant="quiet" size={32} onClick={() => setRemindFor(r.entry.id)}>
                Remind
              </Button>
            ) : null}
            {actions.markPaid ? (
              <MarkPaidCell
                row={r}
                today={today}
                open={markPaidFor === r.entry.id}
                onToggle={(open) => setMarkPaidFor(open ? r.entry.id : null)}
              />
            ) : null}
            {actions.receipt && latest ? (
              <Button
                variant="icon"
                icon="print"
                label={`Print receipt ${latest.receiptNumber}`}
                onClick={() => window.open(`/print/receipt/${latest.id}`, "_blank", "noopener")}
              />
            ) : null}
          </RowActions>
        );
      },
    },
  ];

  const monthName = formatMonth(board.month).split(" ")[0];
  const allPaid = rows.length > 0 && rows.every((r) => r.state.status === "paid");
  const emptyMessage = !board.hasUnits
    ? null
    : allPaid
      ? `Everything is paid for ${monthName}. Nice.` // E2-02
      : rows.length === 0
        ? missingRows > 0
          ? "Create this month's rent rows to see them here."
          : `No unit had a tenant in ${formatMonth(board.month)}, so no rent is due.`
        : `Nothing is ${filter === "all" ? "listed" : filter} for ${formatMonth(board.month)}.`;

  return (
    <>
      <PageHeader
        title="Rent"
        action={
          <Button variant="secondary" onClick={exportCsv} {...disabledWhen(visible.length === 0, "Nothing to export in this view.")}>
            Export
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-end justify-between gap-3">
            {/* L04-SEL-MONTH */}
            <div className="flex items-center gap-1" role="group" aria-label="Month">
              <Button
                variant="icon"
                icon="arrow-right"
                label="Previous month"
                className="[&_svg]:rotate-180"
                onClick={() => router.push(`/rent${query({ month: addMonths(board.month, -1) })}`)}
              />
              <span className="min-w-36 text-center text-h2 text-ink" aria-live="polite">
                {formatMonth(board.month)}
              </span>
              <Button
                variant="icon"
                icon="arrow-right"
                label="Next month"
                onClick={() => router.push(`/rent${query({ month: addMonths(board.month, 1) })}`)}
                {...disabledWhen(board.month >= currentMonth, "Rent for later months is created on the 1st.")}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {/* L04-SEG-FILTER */}
              <SegmentedChoice
                label="Status"
                hideLabel
                options={FILTER_OPTIONS}
                value={filter}
                size={32}
                onChange={(value) => {
                  setFilter(value);
                  replaceUrl(query({ status: value }));
                }}
              />
              {/* L04-SEL-PROPERTY: hidden with one property. */}
              {multipleProperties ? (
                <Dropdown
                  label="Property"
                  value={property}
                  placeholder="Choose a property"
                  options={[{ value: ALL_PROPERTIES, label: "All properties" }, ...board.properties.map((p) => ({ value: p.id, label: p.name }))]}
                  onChange={(value) => {
                    const next = value || ALL_PROPERTIES;
                    setProperty(next);
                    replaceUrl(query({ property: next }));
                  }}
                />
              ) : null}
            </div>
          </div>
        }
      />

      <section className="flex flex-col gap-4 p-4 lg:p-6">
        {/* L04-BNR-ROWSMISSING (E1-11) */}
        {board.month === currentMonth && missingRows > 0 ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning bg-surface p-4 shadow-1">
            <p className="text-ink">This month&apos;s rent rows have not been created.</p>
            <Button onClick={createRows} loading={rowsPending}>
              Create them now
            </Button>
          </div>
        ) : null}

        {/* L04-STRIP-SUMMARY: follows the filter. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          <StatCard label="Expected" value={formatRupees(summary.expected)} />
          <StatCard label="Collected" value={formatRupees(summary.collected)} tone="success" />
          <StatCard label="Outstanding" value={formatRupees(summary.outstanding)} tone={summary.outstanding > 0 ? "danger" : "ink"} />
        </div>

        {/* Bulk mark-paid */}
        {selectable.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-small text-body">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={chosen.length === selectable.length}
                ref={(input) => {
                  if (input) input.indeterminate = chosen.length > 0 && chosen.length < selectable.length;
                }}
                onChange={() =>
                  setSelected(chosen.length === selectable.length ? new Set() : new Set(selectable.map((r) => r.entry.id)))
                }
              />
              Select all unpaid ({selectable.length})
            </label>
            {chosen.length > 0 ? (
              <>
                <Button variant="secondary" size={32} onClick={() => setConfirmBulk(true)}>
                  {`Mark ${chosen.length} paid`}
                </Button>
                <Button variant="quiet" size={32} onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {!board.hasUnits ? (
          <EmptyState
            message="Add a unit and this month's rent will appear here." // E2-01
            action={{ label: "Add unit", onClick: () => router.push("/units") }}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(r) => r.entry.id}
            caption={`Rent for ${formatMonth(board.month)}`}
            onRowClick={(r) => openEntry(r.entry.id)}
            selectedKey={panelId}
            mobileTitle={(r) => unitLabel(r.entry)}
            empty={emptyMessage ? { message: emptyMessage } : undefined}
          />
        )}
      </section>

      {/* L04-BTN-REMIND → S-01. No level is passed: the composer works it out on the server (D-41). */}
      <MessageComposer
        target={remindFor ? { kind: "rent_reminder", rentEntryId: remindFor } : null}
        onClose={({ recorded }) => {
          setRemindFor(null);
          if (recorded) router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmBulk}
        title={`Mark ${bulkPlan.payments.length} ${bulkPlan.payments.length === 1 ? "month" : "months"} paid?`}
        consequence={`Records ${formatRupees(bulkPlan.total)} received today, the full balance of each, with one receipt per month.`}
        actionLabel={`Record ${bulkPlan.payments.length} ${bulkPlan.payments.length === 1 ? "payment" : "payments"}`}
        loading={bulkPending}
        onCancel={() => setConfirmBulk(false)}
        onConfirm={recordBulk}
      />

      {panelEntry ? (
        <RentPanel
          key={panelEntry.id}
          entry={panelEntry}
          detail={detail?.id === panelEntry.id ? detail : null}
          today={today}
          onClose={closePanel}
        />
      ) : null}
    </>
  );
}
