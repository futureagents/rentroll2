"use client";
// S-03 demo body for /dev/share (see page.dev.tsx). The stand-in browsers show both modes on any
// device; the "This browser" section is the real thing.
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { ToastProvider } from "@/components/ui";
import {
  browserPlatform,
  CopyAction,
  LINK_UNAVAILABLE,
  ShareAction,
  ShareLink,
  type SharePlatform,
} from "@/components/share";

interface Links {
  short: string;
  long: string;
  door: string;
}

const UPI_ID = "anil.kulkarni@okhdfc";
const RECEIPT = "RR-0847";

export function ShareDemo({ links, embed }: { links: Links | null; embed: boolean }) {
  if (embed) return <Embedded links={links} />;
  return (
    <ToastProvider>
      <Demo links={links} />
    </ToastProvider>
  );
}

function Demo({ links }: { links: Links | null }) {
  const [log, setLog] = useState<string[]>([]);
  const note = useCallback((line: string) => setLog((lines) => [line, ...lines].slice(0, 8)), []);
  const standIns = useStandIns(note);

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-4 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">S-03 · Share and copy</h1>
        <p className="text-small text-muted">
          Share opens the device share sheet where the browser has one and copies everywhere else. A
          copy is confirmed only once the clipboard accepts it; a refusal shows the text to copy by
          hand. Links come from APP_BASE_URL.
        </p>
      </header>

      {!links && <p className="rounded-md border border-warning bg-warning/12 p-4 text-body">{LINK_UNAVAILABLE}</p>}

      <Section title="This browser" note="The real share sheet and clipboard. Open this page on a phone over https to see the share sheet.">
        <Capabilities />
        {links && (
          <>
            <Row label="Short link">
              <ShareLink url={links.short} what="Tenant link" title="Flat 4C, Kulkarni Apartments" text="Your link for Flat 4C: report a problem, see your receipts." onCopied={() => note("Copied the short link")} onShared={() => note("Shared the short link")} className="w-full" />
            </Row>
            <Row label="Very long link, in a 320px row">
              <div className="w-[320px] max-w-full rounded-sm border border-line p-2">
                <ShareLink url={links.long} what="Receipt link" title="Receipt RR-0847" onCopied={() => note("Copied the long link")} onShared={() => note("Shared the long link")} />
              </div>
            </Row>
            <Row label="Very long link, in a table row">
              <div className="flex h-12 w-full min-w-0 items-center gap-3 border-y border-line px-2">
                <span className="shrink-0 text-body text-ink">Flat 4C</span>
                <ShareLink url={links.long} what="Receipt link" size={32} className="flex-1" />
                <span className="shrink-0 text-small text-muted">27 Oct 2026</span>
              </div>
            </Row>
            <Row label="Labelled share (T02-BTN-SAVE shape)">
              <ShareAction url={links.short} what="Your link" title="Report a problem" size={48} onShared={() => note("Shared from the labelled button")}>
                Save this link
              </ShareAction>
            </Row>
          </>
        )}
        <Row label="Values">
          <Value text={UPI_ID}>
            <CopyAction value={UPI_ID} what="UPI ID" onCopied={() => note("Copied the UPI ID")} />
          </Value>
          <Value text={RECEIPT}>
            <CopyAction value={RECEIPT} what="Receipt number" onCopied={() => note("Copied the receipt number")} />
          </Value>
          {links && (
            <Value text="Door code link">
              <CopyAction value={links.door} what="Door code link" onCopied={() => note("Copied the door code link")} />
            </Value>
          )}
        </Row>
        <Row label="Relative link (refused, never completed from this page's address)">
          <ShareLink url="/u/not-absolute" what="Tenant link" />
          <ShareAction url="/u/not-absolute" what="Tenant link" />
        </Row>
      </Section>

      {links && (
        <Section title="Both modes and the refusals" note="Stand-in browsers, so every case shows on every device. The copy in the first two is real.">
          <Row label="Has a share sheet: share opens it, copy sits beside it">
            <ShareLink url={links.short} what="Tenant link" title="Flat 4C" platform={standIns.sheet} className="w-full" />
          </Row>
          <Row label="No share sheet: one copy button, never a dead share icon">
            <ShareLink url={links.short} what="Tenant link" platform={standIns.noSheet} className="w-full" />
            <ShareAction url={links.short} what="Tenant link" platform={standIns.noSheet} />
          </Row>
          <Row label="Clipboard blocked: no toast, the link is offered to copy by hand">
            <ShareLink url={links.long} what="Tenant link" platform={standIns.blocked} className="w-full" />
            <CopyAction value={UPI_ID} what="UPI ID" platform={standIns.blocked} />
          </Row>
          <Row label="Share sheet refused by the page">
            <ShareAction url={links.short} what="Tenant link" platform={standIns.sheetRefused} />
          </Row>
        </Section>
      )}

      {links && (
        <Section title="Clipboard and share sheet blocked for real" note="A frame whose page denies clipboard-write and web-share, as an embedding site can. It has no toast provider, so it also shows the action's own toast.">
          <iframe
            title="Blocked frame"
            src="/dev/share?embed=blocked"
            allow="clipboard-write 'none'; web-share 'none'"
            className="h-40 w-full rounded-sm border border-line"
          />
        </Section>
      )}

      <Section title="Check the clipboard" note="Paste here after a copy. The log lists confirmed copies and shares only.">
        <textarea rows={2} aria-label="Paste here" placeholder="Paste here" className="w-full rounded-sm border border-line p-3 text-small text-ink" />
        <ul className="flex flex-col gap-1 text-small text-body">
          {log.length === 0 ? <li className="text-muted">Nothing yet.</li> : log.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
        </ul>
      </Section>
    </main>
  );
}

function Embedded({ links }: { links: Links | null }) {
  return (
    <main className="flex flex-col gap-3 p-4">
      {links ? (
        <ShareLink url={links.short} what="Tenant link" title="Flat 4C" className="w-full" />
      ) : (
        <p className="text-body">{LINK_UNAVAILABLE}</p>
      )}
      <CopyAction value={UPI_ID} what="UPI ID" />
    </main>
  );
}

function useStandIns(note: (line: string) => void) {
  return useMemo(() => {
    const realCopy = (text: string) => browserPlatform().writeText?.(text) ?? Promise.reject(new Error("no clipboard"));
    const refused = () => Promise.reject(new DOMException("Blocked by the page", "NotAllowedError"));
    const sheet: SharePlatform = {
      share: (data) => {
        note(`Share sheet opened for ${data.url}`);
        return Promise.resolve();
      },
      writeText: realCopy,
    };
    const noSheet: SharePlatform = { writeText: realCopy };
    const blocked: SharePlatform = { writeText: refused, legacyCopy: () => false };
    const sheetRefused: SharePlatform = { share: refused, writeText: realCopy };
    return { sheet, noSheet, blocked, sheetRefused };
  }, [note]);
}

const subscribeNever = () => () => undefined;

function Capabilities() {
  const caps = useSyncExternalStore(
    subscribeNever,
    () => {
      const p = browserPlatform();
      return `${p.share ? "yes" : "no"}|${p.writeText ? "yes" : "no"}|${window.isSecureContext ? "yes" : "no"}`;
    },
    () => "…|…|…",
  );
  const [share, clipboard, secure] = caps.split("|");
  return (
    <dl className="grid grid-cols-3 gap-3 text-small sm:max-w-[480px]">
      <Fact term="Share sheet" value={share} />
      <Fact term="Async clipboard" value={clipboard} />
      <Fact term="Secure context" value={secure} />
    </dl>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-line p-2">
      <dt className="text-label uppercase text-muted">{term}</dt>
      <dd className="text-body text-ink">{value}</dd>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-ink">{title}</h2>
        {note && <p className="text-small text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-label uppercase text-muted">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Value({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-line py-1 pr-1 pl-3 text-body text-ink">
      {text}
      {children}
    </span>
  );
}
