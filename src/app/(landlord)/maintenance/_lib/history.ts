// L07-TML-HISTORY · D-14: "the request's audit events plus its confirmed messages (D-17)".
// Also the audit_event shapes the maintenance lane writes, so writers and the reader agree.
//
// Shapes (entity_type = 'request'):
//   created          new_value { reported_via }
//   status_change    old_value { status } new_value { status, reopened? }   ← the only kind tenant
//                    code reads (D-30); on a reopen it carries `reopened: true` so T-03 can show
//                    "Reopened" (D-30)
//   reopened         old_value { status } new_value { status }               (D-32) written beside
//                    that status_change; not shown separately here, the status_change line says it
//   category_change  old_value { category } new_value { category }          (D-21)
//   urgency_change   old_value { urgency }  new_value { urgency }           (D-21)
//   vendor_set       new_value { vendor_id, name } (name null when cleared)  (D-14)
//   cost_recorded    new_value { cost, no_cost }                             (D-14, D-22)
//   tenant_liable    new_value { tenant_liable }                             (D-35)
//   after_photo_added new_value { document_id }                              (D-14, D-22)
//   note             note "<text>"                                           (D-14 L07-BTN-ADDNOTE †)
import type { IconName, TimelineEvent } from "@/components/ui";
import { formatRupees } from "@/lib/format";

import {
  CATEGORY_LABEL,
  REPORTED_VIA_LABEL,
  STATUS_LABEL,
  URGENCY_LABEL,
  isCategory,
  isStatus,
  isUrgency,
  type ReportedVia,
} from "./model";

export interface AuditRow {
  id: string;
  kind: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  kind: string;
  channel: string;
  confirmed_at: string;
  vendor_name: string | null;
}

const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", copy: "copied", email: "email" };

export function requestHistory(
  request: { created_at: string; reported_via: ReportedVia },
  audits: readonly AuditRow[],
  messages: readonly MessageRow[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (!audits.some((audit) => audit.kind === "created")) {
    events.push(reported("reported", request.reported_via, request.created_at));
  }
  for (const audit of audits) {
    const event = auditEvent(audit);
    if (event) events.push(event);
  }
  for (const message of messages) {
    const event = messageEvent(message);
    if (event) events.push(event);
  }
  return events;
}

function reported(id: string, via: ReportedVia, at: string): TimelineEvent {
  const text = via === "tenant_link" ? "Reported by the tenant" : `Logged — ${REPORTED_VIA_LABEL[via].toLowerCase()}`;
  return { id, icon: "plus", text, at };
}

function auditEvent(audit: AuditRow): TimelineEvent | null {
  const next = audit.new_value ?? {};
  const prev = audit.old_value ?? {};
  const base = { id: audit.id, at: audit.created_at };
  switch (audit.kind) {
    case "created": {
      const via = typeof next.reported_via === "string" ? (next.reported_via as ReportedVia) : "landlord";
      return reported(audit.id, via in REPORTED_VIA_LABEL ? via : "landlord", audit.created_at);
    }
    case "status_change": {
      if (!isStatus(next.status)) return null;
      if (next.reopened === true) {
        return { ...base, icon: "arrow-up", tone: "warning", text: `Reopened — back to ${STATUS_LABEL[next.status]}` };
      }
      const done = next.status === "done";
      return {
        ...base,
        icon: done ? "check" : "arrow-right",
        tone: done ? "success" : "body",
        text: `Moved to ${STATUS_LABEL[next.status]}`,
      };
    }
    case "category_change":
      if (!isCategory(next.category)) return null;
      return {
        ...base,
        icon: "note",
        text: isCategory(prev.category)
          ? `Category changed from ${CATEGORY_LABEL[prev.category]} to ${CATEGORY_LABEL[next.category]}`
          : `Category set to ${CATEGORY_LABEL[next.category]}`,
      };
    case "urgency_change":
      if (!isUrgency(next.urgency)) return null;
      return {
        ...base,
        icon: "warning",
        text: isUrgency(prev.urgency)
          ? `Urgency changed from ${URGENCY_LABEL[prev.urgency]} to ${URGENCY_LABEL[next.urgency]}`
          : `Urgency set to ${URGENCY_LABEL[next.urgency]}`,
      };
    case "vendor_set":
      return {
        ...base,
        icon: "call",
        text: typeof next.name === "string" && next.name ? `Vendor set: ${next.name}` : "Vendor removed",
      };
    case "cost_recorded":
      if (next.no_cost === true) return { ...base, icon: "rupee", text: "Recorded as no cost" };
      if (typeof next.cost === "number") return { ...base, icon: "rupee", text: `Cost recorded: ${formatRupees(next.cost)}` };
      return { ...base, icon: "rupee", text: "Cost cleared" };
    case "tenant_liable":
      return {
        ...base,
        icon: "rupee",
        text: next.tenant_liable === true ? "Marked as the tenant's cost" : "No longer the tenant's cost",
      };
    case "after_photo_added":
      return { ...base, icon: "photo", text: "After photo added" };
    case "note":
      return audit.note ? { ...base, icon: "note", text: `Note: ${audit.note}` } : null;
    default:
      return null;
  }
}

const MESSAGE_TEXT: Record<string, { icon: IconName; text: (m: MessageRow) => string }> = {
  vendor_dispatch: { icon: "share", text: (m) => `Job sent to ${m.vendor_name ?? "the vendor"}` },
  tenant_update: { icon: "share", text: () => "Tenant updated" },
  payment_link: { icon: "rupee", text: () => "Payment request sent to the tenant" },
};

function messageEvent(message: MessageRow): TimelineEvent | null {
  const shape = MESSAGE_TEXT[message.kind];
  if (!shape) return null;
  const channel = CHANNEL_LABEL[message.channel];
  return {
    id: message.id,
    icon: shape.icon,
    tone: "primary",
    text: channel ? `${shape.text(message)} (${channel})` : shape.text(message),
    at: message.confirmed_at,
  };
}
