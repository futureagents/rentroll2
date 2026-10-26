"use client";
// L09-TAB-PHOTOS: "Move-in condition photos grouped by tenancy, plus repair photos, plus
// documents". Photos open full size in a new tab from a short-lived signed URL (D-15). The
// current tenancy can take more photos and documents here (D-39).
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

import { DocumentPicker } from "../_components/document-picker";
import { MoveInPhotoAdder } from "../_components/move-in-photo-adder";
import { NO_PHOTOS_CONSEQUENCE } from "../_lib/forms";
import type { PhotoView, UnitView } from "./view";

export function PhotoGrid({ photos }: { photos: (PhotoView & { after?: boolean })[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {photos.map((photo) => (
        <li key={photo.id} className="relative h-24 w-24 overflow-hidden rounded-sm border border-line bg-canvas">
          {photo.src ? (
            <a
              href={photo.src}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs, not static assets */}
              <img src={photo.src} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
            </a>
          ) : (
            <span className="flex h-full w-full items-center justify-center p-1 text-center text-label text-muted">{photo.alt}</span>
          )}
          {photo.after !== undefined && (
            <span className="absolute inset-x-0 bottom-0 bg-ink/60 px-1 text-center text-label text-surface">{photo.after ? "After" : "Reported"}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PhotosTab({ view }: { view: UnitView }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="movein-heading" className="flex flex-col gap-4">
        <h2 id="movein-heading" className="text-h2 text-ink">
          Move-in condition
        </h2>
        {view.moveIn.length === 0 ? (
          <EmptyState message="Move-in photos are added with each new tenant, so a deduction at move-out has evidence behind it." />
        ) : (
          view.moveIn.map((group) => (
            <article key={group.tenancyId} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-1">
              <h3 className="text-body font-medium text-ink">
                {group.tenantName}
                <span className="font-normal text-muted">
                  {" "}
                  · moved in {formatDate(group.movedInOn)}
                  {group.endedOn ? ` · moved out ${formatDate(group.endedOn)}` : ""}
                </span>
              </h3>
              {group.photos.length > 0 ? (
                <PhotoGrid photos={group.photos} />
              ) : (
                <p className="rounded-sm bg-warning/12 px-3 py-2 text-small text-ink">No move-in photos. {NO_PHOTOS_CONSEQUENCE}</p>
              )}
              {group.active && (
                <MoveInPhotoAdder
                  tenancyId={group.tenancyId}
                  unitId={view.id}
                  unitLabel={view.label}
                  tenantName={group.tenantName}
                  existing={group.photos.length}
                />
              )}
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="repair-heading" className="flex flex-col gap-4">
        <h2 id="repair-heading" className="text-h2 text-ink">
          Repairs
        </h2>
        {view.repairs.length === 0 ? (
          <p className="text-body text-muted">Photos sent with reported problems and taken after repairs appear here.</p>
        ) : (
          view.repairs.map((repair) => (
            <article key={repair.requestId} className="flex flex-col gap-2">
              <h3 className="text-body font-medium text-ink">{repair.number}</h3>
              <PhotoGrid photos={repair.photos} />
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="docs-heading" className="flex flex-col gap-4">
        <h2 id="docs-heading" className="text-h2 text-ink">
          Documents
        </h2>
        {view.documents.length === 0 ? (
          <p className="text-body text-muted">Agreements, ID proofs and settlement statements for this unit appear here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface shadow-1">
            {view.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{doc.typeLabel}</span>
                  <span className="block truncate text-small text-muted">
                    {doc.fileName}
                    {doc.tenantName ? ` · ${doc.tenantName}` : ""} · {formatDate(doc.uploadedOn)}
                  </span>
                </span>
                {doc.url ? (
                  <a href={doc.url} className="text-small font-medium text-primary underline-offset-2 hover:underline">
                    Download
                  </a>
                ) : (
                  <span className="text-small text-muted">Unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {view.current && <DocumentPicker tenancyId={view.current.tenancyId} unitId={view.id} />}
      </section>
    </div>
  );
}
