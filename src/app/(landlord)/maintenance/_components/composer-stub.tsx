"use client";
// Local stub for opening S-01 from L-07. S-01 is the only send path in the product: only the
// composer hands a message to WhatsApp and only src/server/composer/record.ts writes `message`
// (tests/composer/single-send-path.test.ts, lane/composer). The composer handles
// `rent_reminder` today; the three L-07 kinds are an integration requirement on that lane.
// Until then this stub shows the template draft and sends nothing, records nothing.
//
// PROMOTE: replace with the S-01 opener — `openComposer({ kind: "vendor_dispatch" |
// "tenant_update" | "payment_link", requestId })`, with the server loading recipient and fields.
import { Button } from "@/components/ui";

import { Modal } from "./local-ui";

export type RequestMessageKind = "vendor_dispatch" | "tenant_update" | "payment_link";

export interface ComposerTarget {
  kind: RequestMessageKind;
  /** S01-HDR: "Message to Suresh Khan · Flat 4C". */
  title: string;
  /** The template draft (D-37) S-01 would start from. */
  draft: string;
}

export function ComposerStub({ target, onClose }: { target: ComposerTarget; onClose: () => void }) {
  return (
    <Modal
      open
      title={target.title}
      onClose={onClose}
      footer={
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap rounded-sm border border-line bg-canvas p-3 text-body">{target.draft}</p>
        <p className="text-small text-muted">
          Sending from here arrives with the message composer. Nothing has been sent or recorded.
        </p>
      </div>
    </Modal>
  );
}
