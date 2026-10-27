"use client";
// S-02 · Payment sheet. A landlord component (D-27), opened from L05-BTN-PAYLINK (rent balance,
// D-10) and L07-CHK-TENANTLIABLE → "Send payment request" (repair cost). It builds a plain UPI
// intent link; there is no hosted payment page, so no tenant-facing screen shows the figure (G-2).
// The amount reaches a tenant only inside a message the landlord sends through S-01 (G-1, D-27).
//
// S-02 rule: "The sheet never claims payment has been received. Marking paid is always a
// separate, deliberate act by the landlord." Nothing here writes to the database.
//
// S02-BTN-PAY by device (D-27; iOS is a QA note there, not a spec change):
// - ios: QR first ("Scan this with your payment app"), then one button per app (GPay, PhonePe,
//   Paytm). `upi://` alone often does nothing on an iPhone, with no error at all.
// - android: "Open payment app" (`upi://`, the system chooser) first, the QR always visible below.
// - desktop: QR and copyable UPI ID; "Open payment app" disabled with the S-02 tooltip.
// Every launch is watched: if the page is still in front 2.5s later, the sheet says so beside
// that button instead of leaving a button that seemed to do nothing.
import Link from "next/link";
import { useContext, useEffect, useId, useRef, useState } from "react";

import { Button, CopyButton, Modal, MoneyField, TextField } from "@/components/ui";
import { copyText, COPIED_MESSAGE, COPIED_MS } from "@/components/ui/share";
import { ToastContext } from "@/components/ui/toast";
import { formatRupees } from "@/lib/format";
import { UPI_NOTE_MAX } from "@/lib/upi";

import {
  IOS_PAYMENT_APPS,
  appPaymentLink,
  capPaymentNote,
  paymentLink,
  type PaymentPayee,
  type PaymentRequest,
} from "./links";
import { usePaymentPlatform, type PaymentPlatform } from "./platform";
import { PaymentQr, downloadQrPng, qrMatrix } from "./qr";

/** S02-BTN-PAY's desktop tooltip (S-02, E1 "messages stated on individual screens"). */
export const DESKTOP_PAY_REASON = "Scan the code with your phone instead.";
const NO_AMOUNT_REASON = "Enter an amount first.";
/** L-15's route (D-39). */
const SETTINGS_HREF = "/settings";
/** How long a launched app has to take the page out of view before the sheet says it did not open. */
const LAUNCH_WAIT_MS = 2500;
/** E3: past this, a skeleton says it is still working rather than looking stuck. */
const SLOW_LOAD_MS = 5000;

/**
 * The payee as the opener has it. Openers that load on the server pass `ready`; one that fetches
 * after opening passes `loading`, then `ready` or `failed`.
 */
export type PayeeState =
  | { status: "loading" }
  | { status: "failed"; onRetry: () => void }
  /** `payee` is null when no UPI ID is saved (S-02 rule: a prompt to L-15, never a broken QR). */
  | { status: "ready"; payee: PaymentPayee | null };

export interface PaymentSheetProps {
  /** One line naming what is being asked for, e.g. "Rent Feb 2026 · Flat 2A, Kulkarni Apartments". */
  context: string;
  /** S02-FLD-AMOUNT pre-fill: the balance (D-10) or the repair cost (L-07). */
  amount: number | null;
  /** S02-FLD-NOTE pre-fill: `rentPaymentNote()` or the D-27 repair note. */
  note: string;
  payee: PayeeState;
  /**
   * S02-BTN-SENDLINK: "Opens S-01 with the payment link already embedded". The opener opens S-01;
   * this sheet never sends anything itself (G-1).
   */
  onSendLink: (request: PaymentRequest, link: string) => void;
  onClose: () => void;
  /** Forces a platform; only for the /dev/payment preview. */
  platform?: PaymentPlatform;
}

export function PaymentSheet({ context, amount, note, payee, onSendLink, onClose, platform }: PaymentSheetProps) {
  const titleId = useId();
  return (
    <Modal open labelledBy={titleId} onDismiss={onClose}>
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} tabIndex={-1} autoFocus className="text-h1 text-ink focus:outline-none">
              Payment request
            </h2>
            <p className="text-small break-words text-muted">{context}</p>
          </div>
          <Button variant="icon" icon="close" label="Close" onClick={onClose} />
        </div>

        {payee.status === "loading" ? (
          <LoadingBody />
        ) : payee.status === "failed" ? (
          <FailedBody onRetry={payee.onRetry} onClose={onClose} />
        ) : payee.payee === null ? (
          <NoUpiBody onClose={onClose} />
        ) : (
          <ReadyBody
            payee={payee.payee}
            initialAmount={amount}
            initialNote={note}
            onSendLink={onSendLink}
            platform={platform}
          />
        )}
      </div>
    </Modal>
  );
}

function ReadyBody({
  payee,
  initialAmount,
  initialNote,
  onSendLink,
  platform: override,
}: {
  payee: PaymentPayee;
  initialAmount: number | null;
  initialNote: string;
  onSendLink: PaymentSheetProps["onSendLink"];
  platform?: PaymentPlatform;
}) {
  const platform = usePaymentPlatform(override);
  const toast = useContext(ToastContext);
  const [amount, setAmount] = useState<number | null>(initialAmount);
  // S02-FLD-NOTE. WARNING: convenience only. Payment apps cut the note at ~50 characters, and
  // many drop or let the payer rewrite it. Nothing may match, reconcile or mark paid from it;
  // the landlord marks paid by hand (S-02 rule).
  const [note, setNote] = useState(() => capPaymentNote(initialNote));
  const [copyFailed, setCopyFailed] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const launch = useLaunchWatch();

  const request: PaymentRequest | null = amount !== null && amount > 0 ? { payee, amount, note } : null;
  // S02-IMG-QR "Regenerates whenever the amount changes": derived on every render, never stored.
  const link = request ? paymentLink(request) : null;
  const matrix = link ? qrMatrix(link) : null;
  const ready = request && link && matrix ? { request, link, matrix } : null;

  const copyLink = () => {
    if (!link) return;
    // Straight from the click, never after an await (S-03).
    if (!copyText(link)) return setCopyFailed(true);
    setCopyFailed(false);
    toast?.show({ message: COPIED_MESSAGE, duration: COPIED_MS }); // E1-03
  };

  const downloadQr = () => {
    if (!ready) return;
    downloadQrPng(ready.matrix, qrFilename(note)).then((ok) => setDownloadFailed(!ok));
  };

  const qr = (
    <QrBlock
      matrix={ready?.matrix ?? null}
      amount={request?.amount ?? null}
      payee={payee}
      lead={platform === "ios"}
      tooLong={request !== null && matrix === null}
    />
  );

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
        {/* S02-FLD-AMOUNT */}
        <MoneyField label="Amount" value={amount} onChange={setAmount} required />
        {/* S02-FLD-NOTE */}
        <TextField
          label="Note"
          value={note}
          onChange={setNote}
          maxLength={UPI_NOTE_MAX}
          helper="Shown in the payment app if the app keeps it. Some apps drop it."
        />

        {platform === "ios" && (
          <>
            {qr}
            <div className="flex flex-col gap-2">
              <p className="text-small text-muted">Or open an app on this phone:</p>
              {IOS_PAYMENT_APPS.map((app) => (
                <LaunchButton
                  key={app.id}
                  label={`Open ${app.label}`}
                  href={link ? appPaymentLink(app, link) : null}
                  missed={launch.missed === app.id}
                  missedText={`${app.label} did not open on this phone. If it is not installed, scan the code instead.`}
                  onLaunch={(href) => launch.start(app.id, href)}
                />
              ))}
            </div>
          </>
        )}

        {platform === "android" && (
          <>
            {/* S02-BTN-PAY */}
            <LaunchButton
              primary
              label="Open payment app"
              href={link}
              missed={launch.missed === "upi"}
              missedText="No payment app opened. Scan the code with any UPI app instead."
              onLaunch={(href) => launch.start("upi", href)}
            />
            {qr}
          </>
        )}

        {platform === "desktop" && (
          <>
            {qr}
            {/* S02-BTN-PAY: disabled on desktop, as written (S-02, D-27). */}
            <Button block disabled disabledReason={DESKTOP_PAY_REASON}>
              Open payment app
            </Button>
          </>
        )}

        <UpiIdRow payee={payee} />

        {copyFailed && link && (
          <p role="alert" className="text-small break-all text-body">
            Could not copy on this browser. Select the link and copy it yourself: {link}
          </p>
        )}
        {downloadFailed && (
          <p role="alert" className="text-small text-body">
            Could not save the image on this browser. Take a screenshot of the code instead.
          </p>
        )}

        <p className="text-small text-muted">
          This only asks for the money. When it arrives, mark it paid yourself.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
        {ready ? (
          <>
            {/* S02-BTN-DOWNLOADQR */}
            <Button variant="quiet" onClick={downloadQr}>
              Download QR
            </Button>
            {/* S02-BTN-COPYLINK */}
            <Button variant="secondary" icon="copy" onClick={copyLink}>
              Copy link
            </Button>
            {/* S02-BTN-SENDLINK */}
            <Button variant="secondary" icon="share" onClick={() => onSendLink(ready.request, ready.link)}>
              Send link
            </Button>
          </>
        ) : (
          <>
            <Button variant="quiet" disabled disabledReason={NO_AMOUNT_REASON}>
              Download QR
            </Button>
            <Button variant="secondary" icon="copy" disabled disabledReason={NO_AMOUNT_REASON}>
              Copy link
            </Button>
            <Button variant="secondary" icon="share" disabled disabledReason={NO_AMOUNT_REASON}>
              Send link
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** S02-IMG-QR with the amount and payee it carries, so whoever scans can check them first. */
function QrBlock({
  matrix,
  amount,
  payee,
  lead,
  tooLong,
}: {
  matrix: ReturnType<typeof qrMatrix>;
  amount: number | null;
  payee: PaymentPayee;
  /** iOS: the QR is the main way to pay, so it is larger and says what to do with it. */
  lead: boolean;
  tooLong: boolean;
}) {
  // "Large enough to scan from a laptop screen": 256px at desktop, up to 320px on a phone.
  const size = lead ? "max-w-80" : "max-w-64";
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-surface p-4">
      {lead && <p className="text-h2 text-center text-ink">Scan this with your payment app</p>}
      {amount !== null && (
        <p className="text-h1 text-center tabular-nums text-ink">{formatRupees(amount)}</p>
      )}
      <div className={`w-full ${size}`}>
        {matrix ? (
          <PaymentQr matrix={matrix} label={`UPI payment code for ${amount === null ? "" : formatRupees(amount)} to ${payee.name}`} />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-sm border border-dashed border-line bg-canvas p-4 text-center text-small text-muted">
            {tooLong ? "Shorten the note to make the payment code." : "Enter an amount to make the payment code."}
          </div>
        )}
      </div>
      <p className="w-full text-center text-small break-words text-muted">To {payee.name}</p>
    </div>
  );
}

/** The UPI ID, copyable on every device (desktop's only way to pay without scanning). */
function UpiIdRow({ payee }: { payee: PaymentPayee }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-line px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-label uppercase text-muted">UPI ID</span>
        <span className="break-all text-ink">{payee.upiId}</span>
      </div>
      {/* S-03 copy: tick for 2 seconds and the E1-03 "Copied." toast. */}
      <CopyButton text={payee.upiId} label="Copy UPI ID" />
    </div>
  );
}

function LaunchButton({
  label,
  href,
  primary = false,
  missed,
  missedText,
  onLaunch,
}: {
  label: string;
  href: string | null;
  primary?: boolean;
  missed: boolean;
  missedText: string;
  onLaunch: (href: string) => void;
}) {
  const variant = primary ? "primary" : "secondary";
  return (
    <div className="flex flex-col gap-1">
      {href ? (
        <Button variant={variant} size={48} block onClick={() => onLaunch(href)}>
          {label}
        </Button>
      ) : (
        <Button variant={variant} size={48} block disabled disabledReason={NO_AMOUNT_REASON}>
          {label}
        </Button>
      )}
      {missed && (
        <p role="status" className="text-small text-body">
          {missedText}
        </p>
      )}
    </div>
  );
}

/**
 * Opens a payment app and notices when nothing happened. A launched app takes the page out of
 * view (visibilitychange / pagehide); if the page is still in front after LAUNCH_WAIT_MS, the app
 * did not open — not installed, or the link was refused — and `missed` names which button.
 */
function useLaunchWatch() {
  const [missed, setMissed] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const left = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      setMissed(null);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") left();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", left);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", left);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const start = (key: string, href: string) => {
    setMissed(null);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (document.visibilityState === "visible") setMissed(key);
    }, LAUNCH_WAIT_MS);
    window.location.assign(href);
  };

  return { missed, start };
}

function LoadingBody() {
  // E3 page load: skeleton shapes matching the real layout, never a centred spinner.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your payment details.
      </span>
      <span className="h-10 w-full animate-pulse rounded-sm bg-line" />
      <span className="h-10 w-full animate-pulse rounded-sm bg-line" />
      <span className="mx-auto aspect-square w-full max-w-64 animate-pulse rounded-md bg-line" />
      <span className="h-12 w-full animate-pulse rounded-sm bg-line" />
      {slow && (
        <p className="text-small text-muted" role="status">
          Still loading. A slow connection can take a few more seconds.
        </p>
      )}
    </div>
  );
}

function FailedBody({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4 sm:px-6">
        <p role="alert" className="text-body">
          Could not load your payment details. Check your connection and try again.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </>
  );
}

/** S-02 rule: "If no UPI ID is saved, the sheet shows a prompt with a link to L-15 rather than a broken QR." */
function NoUpiBody({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4 sm:px-6">
        <p className="text-body">Add your UPI ID in Settings to make a payment code and link.</p>
        <Link href={SETTINGS_HREF} className="text-primary underline underline-offset-2">
          Go to settings
        </Link>
      </div>
      <div className="flex justify-end border-t border-line px-4 py-4 sm:px-6">
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}

/** "upi-rent-feb-2026-flat-2a.png" from the note; "upi-payment.png" when the note is empty. */
function qrFilename(note: string): string {
  const slug = note
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `upi-${slug || "payment"}.png`;
}
