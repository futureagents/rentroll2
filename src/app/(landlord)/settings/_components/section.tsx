"use client";
// L-15 · one settings section: its own card, its own Save, its own confirmation. One giant Save
// at the bottom of a long page is how changes get lost, so each section saves only its columns.
//
// Save states: idle → saving (spinner in the button only, E3) → saved, or failed with E1-07 inline
// above the section. A save that takes longer than SLOW_MS says so; a save pressed while offline
// waits and runs on reconnect (E1-08).
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button, Icon } from "@/components/ui";
import { SAVE_FAILED, type FieldErrors, type SaveResult } from "@/lib/settings";

/** Long enough that a normal save never shows it; short enough to explain a slow 3G one. */
const SLOW_MS = 5000;

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving"; slow: boolean; note?: string }
  | { kind: "waiting" }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

export function useSectionSave<K extends string>(options: {
  save: () => Promise<SaveResult<K>>;
  /** Runs after the server confirmed the save: the section takes its saved values as the baseline. */
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<K>>({});
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const save = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus({ kind: "waiting" });
      return;
    }
    setStatus({ kind: "saving", slow: false });
    const timer = setTimeout(() => setStatus((s) => (s.kind === "saving" ? { kind: "saving", slow: true } : s)), SLOW_MS);
    try {
      const result = await latest.current.save();
      if (result.ok) {
        setFieldErrors({});
        latest.current.onSaved();
        setStatus({ kind: "saved" });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setStatus({ kind: "failed", message: result.error });
      }
    } catch {
      // The request never came back (connection dropped mid-save, or the server failed).
      setStatus({ kind: "failed", message: SAVE_FAILED });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (status.kind !== "waiting") return;
    const onOnline = () => void save();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status.kind, save]);

  /** Call on every edit: a server error on that field goes, and "Saved" no longer describes the form. */
  const edited = useCallback((field?: K) => {
    if (field) setFieldErrors((errors) => (errors[field] ? { ...errors, [field]: undefined } : errors));
    setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s));
  }, []);

  return { status, fieldErrors, save, edited };
}

export function SettingsSection({
  id,
  title,
  description,
  status,
  dirty,
  savedMessage,
  saveLabel,
  children,
  onSave,
}: {
  id: string;
  title: string;
  description: string;
  status: SaveStatus;
  dirty: boolean;
  /** What the confirmation says once this section is saved, e.g. which days reminders now use. */
  savedMessage: string;
  saveLabel: string;
  children: ReactNode;
  onSave: () => void;
}) {
  const headingId = useId();
  const saving = status.kind === "saving";
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="flex scroll-mt-4 flex-col gap-4 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-h2 text-ink">
          {title}
        </h2>
        <p className="text-small text-muted">{description}</p>
      </header>

      {status.kind === "failed" && (
        <p role="alert" className="rounded-sm border border-danger bg-danger/12 px-3 py-2 text-danger">
          {status.message}
        </p>
      )}

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !saving) onSave();
        }}
      >
        {children}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {dirty ? (
            <Button type="submit" loading={saving}>
              {saveLabel}
            </Button>
          ) : (
            <Button type="submit" disabled disabledReason="Nothing has changed in this section yet.">
              {saveLabel}
            </Button>
          )}
          <SaveLine status={status} dirty={dirty} savedMessage={savedMessage} />
        </div>
      </form>
    </section>
  );
}

function SaveLine({ status, dirty, savedMessage }: { status: SaveStatus; dirty: boolean; savedMessage: string }) {
  let content: ReactNode = null;
  if (status.kind === "saving") {
    content = status.note ? (
      <span className="text-muted">{status.note}</span>
    ) : status.slow ? (
      <span className="text-muted">Still saving — the connection is slow. Your changes stay here until it finishes.</span>
    ) : (
      <span className="text-muted">Saving…</span>
    );
  } else if (status.kind === "waiting") {
    content = <span className="text-warning">You are offline. We will save this when you reconnect.</span>;
  } else if (status.kind === "saved") {
    content = (
      <span className="flex items-center gap-1 text-success">
        <Icon name="check" className="shrink-0" aria-hidden="true" />
        {savedMessage}
      </span>
    );
  } else if (dirty) {
    content = <span className="text-muted">Unsaved changes</span>;
  }
  return (
    <p role="status" aria-live="polite" className="text-small">
      {content}
    </p>
  );
}
