-- =============================================================================================
-- D-56 · An uploaded signature on landlord-printed receipts and statements, never on the
-- tenant's copy. Stored like the logo (D-15): a `document` row of type `signature` with no unit,
-- in the private `documents` bucket, pointed to by `landlord.signature_document_id`.
--
-- D-30 does not change: `signature_document_id` is not tenant-readable and src/server/tenant
-- never selects it. RLS needs no change: `landlord_update_own` and `document_landlord_all`
-- already cover the new column and the new document type.
-- =============================================================================================

-- 1 · The new document type.
alter type public.document_type add value if not exists 'signature';

-- 2 · Only the logo and the signature may be stored without a unit (was: logo only).
-- Compared as text: a value added by ALTER TYPE … ADD VALUE cannot be used as an enum literal in
-- the same transaction, and this file runs in one.
alter table public.document drop constraint document_logo_has_no_unit;
alter table public.document
  add constraint document_logo_has_no_unit check (type::text in ('logo', 'signature') or unit_id is not null);

-- 3 · The landlord's current signature (L15-UPL-SIGNATURE †). Same shape as logo_document_id.
alter table public.landlord add column signature_document_id uuid;
alter table public.landlord
  add constraint landlord_signature_document_fk foreign key (signature_document_id)
  references public.document (id) on delete set null;
comment on column public.landlord.signature_document_id is
  'D-56. Prints above the signature line on landlord-printed P-01 and P-02 only. Never tenant-readable (D-30).';
