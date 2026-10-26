"use client";
// Adds an agreement or an ID proof to a tenancy: L09-TAB-PHOTOS † and L11-SEC-DOCS † (D-15,
// D-39). Picks one file (PDF or photo), uploads it to the landlord's folder, then attaches it.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, useToast } from "@/components/ui";

import { attachDocumentsAction } from "../actions";
import { DOCUMENT_MIME, type TenancyDocumentType } from "../_lib/files";
import { uploadFile } from "./use-uploads";

const CHOICES: { type: Extract<TenancyDocumentType, "agreement" | "id_proof">; label: string; done: string }[] = [
  { type: "agreement", label: "Add agreement", done: "Agreement added." },
  { type: "id_proof", label: "Add ID proof", done: "ID proof added." },
];

export function DocumentPicker({ tenancyId, unitId }: { tenancyId: string; unitId: string }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState<(typeof CHOICES)[number] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (c: (typeof CHOICES)[number]) => {
    setChoice(c);
    setError(null);
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !choice) return;
    setBusy(choice.type);
    const uploaded = await uploadFile(file, choice.type, () => undefined);
    if (!uploaded.ok) {
      setBusy(null);
      setError(uploaded.error);
      return;
    }
    const result = await attachDocumentsAction({
      tenancyId,
      unitId,
      type: choice.type,
      files: [{ documentId: uploaded.documentId, fileName: file.name, alt: null }],
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.show({ message: choice.done });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((c) =>
          busy && busy !== c.type ? (
            <Button key={c.type} variant="secondary" size={32} disabled disabledReason="Another file is uploading">
              {c.label}
            </Button>
          ) : (
            <Button key={c.type} variant="secondary" size={32} icon="plus" loading={busy === c.type} onClick={() => pick(c)}>
              {c.label}
            </Button>
          ),
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={DOCUMENT_MIME.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      <p className="text-small text-muted">PDF or photo, up to 10 MB.</p>
    </div>
  );
}
