"use client";
// L-06 · Maintenance board. Four status columns on desktop (New · Assigned · In progress ·
// Done); under 1024px a single list with a status filter, "because horizontal scrolling boards
// are unusable on a phone". L-07 opens as the detail panel at /maintenance/:requestId.
import { useRouter } from "next/navigation";
import { useMemo, useState, type DragEvent } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button, Dropdown, EmptyState, SegmentedChoice, ToastProvider, useToast } from "@/components/ui";

import { moveRequest } from "../actions";
import { applyFilter, groupByStatus, openCount, type BoardFilter } from "../_lib/board";
import { planMove } from "../_lib/lifecycle";
import { REQUEST_STATUSES, STATUS_LABEL, type RequestStatus } from "../_lib/model";
import type { BoardData, RequestDetail } from "../_server/queries";
import { NewRequestPanel } from "./new-request-panel";
import { CARD_MIME, RequestCard } from "./request-card";
import { RequestPanel, type PanelIntent } from "./request-panel";

const FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "unassigned", label: "Unassigned" },
  { value: "property", label: "This property" },
];

/** E2-03. */
const EMPTY_MESSAGE = "No open requests. Tenants report problems through their unit link.";

export interface BoardProps {
  data: BoardData;
  /** Server time of the render, so ageing and "age in days" match on server and client. */
  now: string;
  /** L-07: the open request; null when the id is not the landlord's; undefined when no panel. */
  detail?: RequestDetail | null;
  intent?: PanelIntent;
}

export function MaintenanceBoard(props: BoardProps) {
  return (
    <ToastProvider>
      <Board {...props} />
    </ToastProvider>
  );
}

function Board({ data, now: nowIso, detail, intent }: BoardProps) {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [propertyId, setPropertyId] = useState(data.properties[0]?.id ?? "");
  const [listStatus, setListStatus] = useState<RequestStatus>("new");
  const [logging, setLogging] = useState(false);
  const [dropTarget, setDropTarget] = useState<RequestStatus | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const severalProperties = data.properties.length > 1;
  const visible = applyFilter(data.cards, filter, severalProperties ? propertyId : null);
  const columns = groupByStatus(visible);
  const hasOpen = openCount(data.cards) > 0;
  const selectedId = detail?.id ?? null;

  const openRequest = (id: string, query = "") => router.push(`/maintenance/${id}${query}`, { scroll: false });

  const drop = async (event: DragEvent<HTMLElement>, to: RequestStatus) => {
    event.preventDefault();
    setDropTarget(null);
    const id = event.dataTransfer.getData(CARD_MIME);
    const card = data.cards.find((c) => c.id === id);
    if (!card) return;
    const plan = planMove(card.status, to, card.vendorId);
    if (plan.kind === "none") return;
    // D-22: a drag to Done opens L-07 with Done chosen and focus on the cost; it commits on save.
    if (plan.kind === "close") {
      openRequest(card.id, "?close=1");
      return;
    }
    setMoveError(null);
    const result = await moveRequest(card.id, to);
    if (!result.ok) {
      setMoveError(result.error);
      return;
    }
    const message = result.reopened
      ? `${card.requestNumber} reopened — back in ${STATUS_LABEL[result.status]}.`
      : `${card.requestNumber} moved to ${STATUS_LABEL[result.status]}.`;
    // L-06 / D-36: a toast offering to notify the tenant; letting it expire writes nothing.
    toast.show({
      message,
      undo: card.hasTenant
        ? { label: "Update the tenant", onUndo: () => openRequest(card.id, "?compose=tenant_update") }
        : undefined,
    });
  };

  return (
    <>
      <PageHeader
        title="Maintenance"
        action={
          <Button icon="plus" onClick={() => setLogging(true)}>
            Log a request
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="max-w-full overflow-x-auto">
              <SegmentedChoice label="Show" hideLabel options={FILTERS} value={filter} onChange={setFilter} size={32} />
            </div>
            {filter === "property" && severalProperties ? (
              <Dropdown
                label="Property"
                value={propertyId}
                onChange={setPropertyId}
                options={data.properties.map((p) => ({ value: p.id, label: p.name }))}
                className="w-56"
              />
            ) : null}
          </div>
        }
      />

      <section className="flex flex-col gap-4 p-4 lg:p-6">
        {!hasOpen ? (
          <EmptyState
            message={EMPTY_MESSAGE}
            // E2-03 "Print door QR codes" — prints from L-08 until P-03 has an all-units route.
            action={{ label: "Print door QR codes", onClick: () => router.push("/units"), variant: "secondary" }}
          />
        ) : null}
        {moveError ? (
          <p role="alert" className="text-small text-danger">
            {moveError}
          </p>
        ) : null}

        {data.cards.length > 0 ? (
          <>
            {/* Desktop: four columns, New always leftmost (L06-COL-NEW). */}
            <div className="hidden overflow-x-auto lg:block">
              <div className="grid min-w-[960px] grid-cols-4 gap-4">
                {REQUEST_STATUSES.map((status) => (
                  <section
                    key={status}
                    aria-labelledby={`col-${status}`}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes(CARD_MIME)) return;
                      event.preventDefault();
                      setDropTarget(status);
                    }}
                    onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
                    onDrop={(event) => drop(event, status)}
                    className={`flex min-h-40 flex-col gap-2 rounded-md p-2 transition-colors ${dropTarget === status ? "bg-primary-soft" : "bg-canvas"}`}
                  >
                    <h2 id={`col-${status}`} className="flex items-center justify-between px-1 text-h2 text-ink">
                      {STATUS_LABEL[status]}
                      <span className="text-small font-normal text-muted">{columns[status].length}</span>
                    </h2>
                    {columns[status].map((card) => (
                      <RequestCard
                        key={card.id}
                        card={card}
                        now={now}
                        showProperty={severalProperties}
                        selected={card.id === selectedId}
                        draggable
                      />
                    ))}
                  </section>
                ))}
              </div>
            </div>

            {/* Mobile and tablet: one list with a status filter. */}
            <div className="flex flex-col gap-3 lg:hidden">
              <div className="max-w-full overflow-x-auto">
                <SegmentedChoice
                  label="Status"
                  hideLabel
                  options={REQUEST_STATUSES.map((status) => ({
                    value: status,
                    label: `${STATUS_LABEL[status]} (${columns[status].length})`,
                  }))}
                  value={listStatus}
                  onChange={setListStatus}
                  size={32}
                />
              </div>
              {columns[listStatus].length === 0 ? (
                <p className="text-small text-muted">Nothing in {STATUS_LABEL[listStatus]}.</p>
              ) : (
                columns[listStatus].map((card) => (
                  <RequestCard
                    key={card.id}
                    card={card}
                    now={now}
                    showProperty={severalProperties}
                    selected={card.id === selectedId}
                  />
                ))
              )}
            </div>
          </>
        ) : null}
      </section>

      <NewRequestPanel
        open={logging}
        units={data.units}
        onClose={() => setLogging(false)}
        onLogged={(requestId, requestNumber, photosFailed) => {
          setLogging(false);
          toast.show({
            message: photosFailed
              ? `Logged as ${requestNumber}. A photo did not upload — add it on the request.`
              : `Logged as ${requestNumber}.`,
          });
          openRequest(requestId);
        }}
      />

      {detail !== undefined ? (
        <RequestPanel
          key={detail?.id ?? "missing"}
          detail={detail}
          intent={intent}
          onClose={() => router.push("/maintenance", { scroll: false })}
        />
      ) : null}
    </>
  );
}
