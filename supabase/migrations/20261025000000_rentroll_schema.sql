-- RentRoll v1 schema. Source: spec/product.md §15 (ERD) corrected by spec/decisions.md §8.
-- The seven mandatory corrections (★):
--   ★1 two tokens          unit.door_token, tenancy.tenant_token        D-01, D-02
--   ★2 payment child       payment is a child of rent_entry             D-10, D-11, D-12
--   ★3 agreement entity    agreement rows belong to a tenancy           D-08
--   ★4 rent_due_day        lives on the agreement                       D-09
--   ★5 notice on tenancy   tenancy.notice_given_on / notice_vacate_on   D-13
--   ★6 audit_event         its own entity                               D-14
--   ★7 document.is_protected                                            D-15
-- Every table carries landlord_id (D-04). Money is integer whole rupees (D-19). Row-level
-- security is enabled on every table in this same migration (section 9); landlords reach only
-- their own rows, anon has no access at all (tenant routes go through src/server/tenant with the
-- service role, D-04). Cross-landlord rows are simply absent, so the app renders "Not found".

-- ---------------------------------------------------------------------------------------------
-- 0 · Extensions and the private helper schema
-- ---------------------------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;   -- gen_random_bytes for tokens
create extension if not exists btree_gist with schema extensions; -- uuid in exclusion constraints
create extension if not exists citext with schema extensions;     -- case-insensitive email

-- `app` holds helper functions and the per-landlord counters. It is not exposed through the
-- API and no client role may read it; triggers reach it as security definer.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 1 · Enums (D-05, D-10, D-11, D-14, D-15, D-17, D-21, D-29, D-32, D-33)
-- ---------------------------------------------------------------------------------------------
create type public.tenancy_status as enum ('active', 'ended', 'settled');                    -- D-05
create type public.payment_status as enum ('recorded', 'voided');                            -- D-11
create type public.request_status as enum ('new', 'assigned', 'in_progress', 'done');        -- D-32
create type public.request_category as enum
  ('plumbing', 'electrical', 'appliance', 'structural', 'pest', 'cleaning', 'other');       -- D-33
create type public.urgency as enum ('low', 'normal', 'urgent');                              -- T-01
create type public.reported_via as enum ('tenant_link', 'phone', 'in_person', 'landlord');   -- D-29
create type public.message_kind as enum
  ('rent_reminder', 'call', 'vendor_dispatch', 'tenant_update', 'renewal_notice',
   'settlement_summary', 'payment_link');                                                    -- D-17
create type public.message_channel as enum ('whatsapp', 'copy', 'email', 'call');            -- D-17
create type public.document_type as enum
  ('agreement', 'id_proof', 'move_in_photo', 'move_out_photo', 'request_before_photo',
   'request_after_photo', 'deduction_photo', 'statement', 'logo');                           -- D-15
create type public.uploaded_by as enum ('landlord', 'tenant');                               -- D-15
create type public.audit_actor as enum ('landlord', 'tenant', 'system');                     -- D-14
create type public.settlement_status as enum ('draft', 'settled');                           -- D-18

-- ---------------------------------------------------------------------------------------------
-- 2 · Helper functions
-- ---------------------------------------------------------------------------------------------

-- Opaque bearer token: 20 random bytes as 40 hex characters = 160 bits (D-01 asks for ≥128).
create function app.new_token() returns text
  language sql volatile
  set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(20), 'hex');
$$;

-- True for the service role and database owners; false for anon and authenticated (API) roles.
-- Used by guard triggers so the landlord-facing API cannot do what the server may (D-11, D-15).
create function app.is_privileged() returns boolean
  language sql stable
  set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated');
$$;

create function app.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Copies landlord_id from the parent row when the insert leaves it null, so child inserts never
-- have to repeat it and can never name a landlord other than the parent's. Composite foreign keys
-- below make a mismatching landlord_id impossible even when it is supplied.
--   usage: trigger ... execute function app.derive_landlord_id('<parent table>', '<fk column>')
create function app.derive_landlord_id() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  parent_table text := tg_argv[0];
  fk_column    text := tg_argv[1];
  parent_id    uuid;
  parent_landlord uuid;
begin
  if new.landlord_id is not null then
    return new;
  end if;
  execute format('select ($1).%I', fk_column) into parent_id using new;
  if parent_id is null then
    return new; -- the not-null constraint on landlord_id reports the problem
  end if;
  execute format('select landlord_id from public.%I where id = $1', parent_table)
    into parent_landlord using parent_id;
  new.landlord_id := parent_landlord;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3 · Core entities
-- ---------------------------------------------------------------------------------------------

-- LANDLORD (D-20). One row per auth user, created by trigger at sign-up (section 7).
create table public.landlord (
  id                      uuid primary key default gen_random_uuid(),
  auth_user_id            uuid not null unique references auth.users (id) on delete cascade,
  name                    text not null,
  phone                   text check (phone is null or phone ~ '^\+91[0-9]{10}$'),
  email                   extensions.citext not null,
  upi_id                  text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$'), -- name@handle (L-02)
  receipt_name            text,
  logo_document_id        uuid,              -- FK added after `document` exists
  escalation_default_pct  numeric(5, 2) check (escalation_default_pct between 0 and 100),
  ladder_days             smallint[] not null default '{3,10,20}',                            -- L15-TBL-LADDER
  accountant_email        extensions.citext,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- D-20: three ladder days, ascending, 1–60.
  constraint landlord_ladder_days_check check (
    cardinality(ladder_days) = 3
    and ladder_days[1] between 1 and 60
    and ladder_days[3] between 1 and 60
    and ladder_days[1] < ladder_days[2]
    and ladder_days[2] < ladder_days[3]
  )
);
comment on table public.landlord is 'D-20. The signed-in account. receipt_name is printed on receipts and statements.';

-- The signed-in landlord. Null when signed out or when the auth user has no landlord row.
create function app.current_landlord_id() returns uuid
  language sql stable security definer
  set search_path = ''
as $$
  select l.id from public.landlord l where l.auth_user_id = auth.uid();
$$;
revoke all on function app.current_landlord_id() from public;
grant execute on function app.current_landlord_id() to authenticated, service_role;

-- Per-landlord gapless counters for receipt and request numbers (D-12). Private: only triggers
-- (security definer) touch this table, so a landlord cannot move their own sequence.
create table app.sequence (
  landlord_id   uuid primary key references public.landlord (id) on delete cascade,
  next_receipt  integer not null default 1 check (next_receipt >= 1),
  next_request  integer not null default 1 check (next_request >= 1)
);
revoke all on app.sequence from public, anon, authenticated;

-- PROPERTY (D-39).
create table public.property (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlord (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  address     text not null check (length(trim(address)) > 0),                               -- L02-FLD-PROPADDR, D-34
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, landlord_id)
);

-- UNIT (D-01 ★1, D-23, D-39).
create table public.unit (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid not null references public.landlord (id) on delete cascade,
  property_id    uuid not null,
  unit_number    text not null check (length(trim(unit_number)) > 0),
  type           text,                                                                       -- free text with suggestions (D-39)
  rent           integer not null check (rent >= 0),                                         -- asking rent, default for a new tenancy (D-23)
  deposit_amount integer not null default 0 check (deposit_amount >= 0),                     -- asking deposit (D-23)
  door_token     text not null unique default app.new_token(),                               -- ★1 D-01: printed on P-03, reaches T-01/T-02 only (D-02)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, landlord_id),
  unique (property_id, unit_number),                                                          -- D-39: unique within a property
  foreign key (property_id, landlord_id) references public.property (id, landlord_id) on delete cascade
);
comment on column public.unit.door_token is '★1 D-01. Opaque, never expires on its own, regenerated by the landlord (L09-BTN-QR). Reaches T-01/T-02 only (D-02).';

-- TENANCY (D-05, D-07, D-13 ★5, D-01 ★1). The ERD''s TENANT: one person in one unit for one period.
create table public.tenancy (
  id                   uuid primary key default gen_random_uuid(),
  landlord_id          uuid not null references public.landlord (id) on delete cascade,
  unit_id              uuid not null,
  name                 text not null check (length(trim(name)) > 0),
  phone                text not null check (phone ~ '^\+91[0-9]{10}$'),
  email                extensions.citext,
  moved_in_on          date not null,
  ended_on             date,
  status               public.tenancy_status not null default 'active',
  deposit_paid         integer not null default 0 check (deposit_paid >= 0),                 -- D-23
  deposit_received_on  date,
  notice_given_on      date,                                                                 -- ★5 D-13
  notice_vacate_on     date,                                                                 -- ★5 D-13
  tenant_token         text not null unique default app.new_token(),                         -- ★1 D-01: the tenant''s link; revoked when status leaves active (D-05)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, landlord_id),
  unique (id, unit_id),
  foreign key (unit_id, landlord_id) references public.unit (id, landlord_id) on delete cascade,
  -- D-05: active ⇔ not yet ended.
  constraint tenancy_ended_matches_status check (
    (status = 'active' and ended_on is null) or (status <> 'active' and ended_on is not null)
  ),
  constraint tenancy_dates_check check (ended_on is null or ended_on >= moved_in_on),
  constraint tenancy_notice_check check (
    (notice_given_on is null and notice_vacate_on is null)
    or (notice_given_on is not null and notice_vacate_on is not null and notice_vacate_on >= notice_given_on)
  )
);
-- D-05: a unit has at most one active tenancy.
create unique index tenancy_one_active_per_unit on public.tenancy (unit_id) where status = 'active';
create index tenancy_unit_idx on public.tenancy (unit_id);
comment on column public.tenancy.tenant_token is '★1 D-01. The tenant''s own link (L09-BTN-COPYLINK). Valid only while status = active (D-05, E4-2).';

-- AGREEMENT ★3 (D-08) with rent_due_day ★4 (D-09).
create table public.agreement (
  id                      uuid primary key default gen_random_uuid(),
  landlord_id             uuid not null references public.landlord (id) on delete cascade,
  tenancy_id              uuid not null,
  starts_on               date not null,
  ends_on                 date not null,
  rent                    integer not null check (rent >= 0),                                -- the figure rent rows use (D-23)
  rent_due_day            smallint not null check (rent_due_day between 1 and 31),           -- ★4 D-09
  escalation_pct_applied  numeric(5, 2) check (escalation_pct_applied between 0 and 100),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (id, landlord_id),
  unique (id, tenancy_id),
  foreign key (tenancy_id, landlord_id) references public.tenancy (id, landlord_id) on delete cascade,
  constraint agreement_dates_check check (ends_on >= starts_on),
  -- D-08: a tenancy''s agreements never overlap.
  constraint agreement_no_overlap exclude using gist (
    tenancy_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
);
create index agreement_tenancy_idx on public.agreement (tenancy_id, starts_on);

-- RENT ENTRY (D-10, D-24). One row per tenancy per month.
create table public.rent_entry (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references public.landlord (id) on delete cascade,
  tenancy_id    uuid not null,
  unit_id       uuid not null,
  agreement_id  uuid not null,
  month         date not null check (month = date_trunc('month', month)::date),              -- first of the month
  amount_due    integer not null check (amount_due >= 0),
  due_on        date not null,                                                               -- D-09
  is_pro_rata   boolean not null default false,                                              -- D-24
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, landlord_id),
  unique (id, tenancy_id),
  unique (tenancy_id, month),                                                                -- D-24: idempotent creation
  foreign key (tenancy_id, landlord_id) references public.tenancy (id, landlord_id) on delete cascade,
  foreign key (tenancy_id, unit_id) references public.tenancy (id, unit_id),
  foreign key (agreement_id, tenancy_id) references public.agreement (id, tenancy_id),
  constraint rent_entry_due_in_month check (due_on >= month and due_on < (month + interval '1 month')::date)
);
create index rent_entry_month_idx on public.rent_entry (landlord_id, month);
create index rent_entry_unit_idx on public.rent_entry (unit_id, month);

-- PAYMENT ★2 (D-10, D-11, D-12). One row per amount received.
create table public.payment (
  id              uuid primary key default gen_random_uuid(),
  landlord_id     uuid not null references public.landlord (id) on delete cascade,
  rent_entry_id   uuid not null,
  tenancy_id      uuid not null,                                                             -- copied from the rent entry by trigger so tenant reads (T-05) never touch rent_entry
  amount          integer not null check (amount > 0),
  received_on     date not null,
  reference       text,                                                                      -- optional UPI/bank reference
  receipt_number  text not null,                                                             -- D-12: RR-0001…, allocated by trigger
  status          public.payment_status not null default 'recorded',
  voided_at       timestamptz,                                                               -- D-11
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (landlord_id, receipt_number),
  foreign key (rent_entry_id, landlord_id) references public.rent_entry (id, landlord_id) on delete cascade,
  foreign key (rent_entry_id, tenancy_id) references public.rent_entry (id, tenancy_id),
  constraint payment_voided_matches_status check (
    (status = 'recorded' and voided_at is null) or (status = 'voided' and voided_at is not null)
  )
);
create index payment_rent_entry_idx on public.payment (rent_entry_id);
create index payment_tenancy_idx on public.payment (tenancy_id, status);
comment on table public.payment is '★2 D-10. Receipts are rendered from these rows on demand (P-01); voided rows keep their number (D-11).';

-- VENDOR (D-16).
create table public.vendor (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlord (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  phone       text not null check (phone ~ '^\+91[0-9]{10}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, landlord_id)
);

-- REQUEST (D-21, D-22, D-29, D-32, D-35).
create table public.request (
  id                    uuid primary key default gen_random_uuid(),
  landlord_id           uuid not null references public.landlord (id) on delete cascade,
  unit_id               uuid not null,
  tenancy_id            uuid,                                                                -- null for a request against a vacant unit (D-29)
  request_number        text not null,                                                       -- D-12: R-0001…, allocated by trigger
  reported_via          public.reported_via not null,                                        -- D-29
  reporter_name         text,                                                                -- T01-FLD-NAME as typed (blank under a door token, D-02)
  reporter_phone        text check (reporter_phone is null or reporter_phone ~ '^\+91[0-9]{10}$'), -- T01-FLD-PHONE as typed
  description           text not null check (length(trim(description)) > 0),
  reported_category     public.request_category not null,                                    -- D-21: the tenant''s choice, immutable
  reported_urgency      public.urgency not null,
  suggested_category    public.request_category,                                             -- D-21: assistant, nullable
  suggested_urgency     public.urgency,
  category              public.request_category not null,                                    -- D-21: effective
  urgency               public.urgency not null,                                             -- D-21: effective, never lower than reported
  status                public.request_status not null default 'new',                        -- D-32
  vendor_id             uuid,                                                                -- D-16
  cost                  integer check (cost >= 0),                                           -- D-22
  no_cost               boolean not null default false,                                      -- D-22
  tenant_liable         boolean not null default false,                                      -- D-35
  payment_requested_at  timestamptz,                                                         -- D-35
  done_at               timestamptz,                                                         -- D-32
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, landlord_id),
  unique (landlord_id, request_number),
  foreign key (unit_id, landlord_id) references public.unit (id, landlord_id) on delete cascade,
  foreign key (tenancy_id, unit_id) references public.tenancy (id, unit_id) on delete set null (tenancy_id),
  foreign key (vendor_id, landlord_id) references public.vendor (id, landlord_id) on delete set null (vendor_id),
  -- D-22: cost and "no cost" are exclusive; Done needs one of them.
  constraint request_cost_exclusive check (not (cost is not null and no_cost)),
  constraint request_done_has_cost check (status <> 'done' or cost is not null or no_cost),
  constraint request_done_at_matches_status check (
    (status = 'done' and done_at is not null) or (status <> 'done' and done_at is null)
  )
);
create index request_board_idx on public.request (landlord_id, status, urgency, created_at);
create index request_unit_idx on public.request (unit_id, created_at);
create index request_tenancy_idx on public.request (tenancy_id, created_at);

-- MESSAGE (D-17). Generalises the ERD''s REMINDER. Written only on "Did you send it? → Yes".
create table public.message (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid not null references public.landlord (id) on delete cascade,
  kind           public.message_kind not null,
  channel        public.message_channel not null,
  rent_entry_id  uuid,
  request_id     uuid,
  agreement_id   uuid,
  settlement_id  uuid,                                                                       -- FK added after `settlement` exists
  tenancy_id     uuid,
  vendor_id      uuid,
  level          smallint check (level between 1 and 3),                                     -- rent reminders only (D-38)
  body           text,                                                                       -- composer text at the moment of "Yes"; null for calls
  call_outcome   text,                                                                       -- calls only (L05-FRM-LOGCALL)
  call_note      text,
  confirmed_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  foreign key (rent_entry_id, landlord_id) references public.rent_entry (id, landlord_id) on delete cascade,
  foreign key (request_id, landlord_id) references public.request (id, landlord_id) on delete cascade,
  foreign key (agreement_id, landlord_id) references public.agreement (id, landlord_id) on delete cascade,
  foreign key (tenancy_id, landlord_id) references public.tenancy (id, landlord_id) on delete cascade,
  foreign key (vendor_id, landlord_id) references public.vendor (id, landlord_id) on delete set null (vendor_id),
  constraint message_level_rent_only check (level is null or kind = 'rent_reminder'),
  constraint message_call_shape check (
    (kind = 'call' and channel = 'call' and body is null)
    or (kind <> 'call' and channel <> 'call' and body is not null and call_outcome is null and call_note is null)
  ),
  -- D-17: parent by kind.
  constraint message_parent_by_kind check (
    case kind
      when 'rent_reminder'      then rent_entry_id is not null
      when 'call'               then rent_entry_id is not null
      when 'vendor_dispatch'    then request_id is not null and vendor_id is not null
      when 'tenant_update'      then request_id is not null
      when 'renewal_notice'     then agreement_id is not null
      when 'settlement_summary' then settlement_id is not null
      when 'payment_link'       then rent_entry_id is not null or request_id is not null
    end
  )
);
create index message_rent_entry_idx on public.message (rent_entry_id, confirmed_at);
create index message_request_idx on public.message (request_id, kind, confirmed_at);

-- SETTLEMENT and DEDUCTION (D-18). document FKs added after `document` exists.
create table public.settlement (
  id                        uuid primary key default gen_random_uuid(),
  landlord_id               uuid not null references public.landlord (id) on delete cascade,
  tenancy_id                uuid not null,
  deposit_held              integer not null check (deposit_held >= 0),
  deposit_received_on       date,
  statement_text            text,                                                            -- L13-FLD-STATEMENT
  status                    public.settlement_status not null default 'draft',
  settled_at                timestamptz,
  supersedes_settlement_id  uuid references public.settlement (id),                          -- L13-BTN-CORRECT
  document_id               uuid,                                                            -- the filed, protected statement (D-15)
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (id, landlord_id),
  foreign key (tenancy_id, landlord_id) references public.tenancy (id, landlord_id) on delete cascade,
  constraint settlement_settled_matches_status check (
    (status = 'draft' and settled_at is null) or (status = 'settled' and settled_at is not null)
  )
);
create index settlement_tenancy_idx on public.settlement (tenancy_id);

create table public.deduction (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid not null references public.landlord (id) on delete cascade,
  settlement_id  uuid not null,
  description    text,
  reason         text not null check (length(trim(reason)) > 0),
  amount         integer not null check (amount >= 0),
  request_id     uuid,                                                                       -- when pulled from repair history (D-35)
  document_id    uuid,                                                                       -- photo
  position       smallint not null default 0,                                                -- row order on L-13 / P-02
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, landlord_id),
  foreign key (settlement_id, landlord_id) references public.settlement (id, landlord_id) on delete cascade,
  foreign key (request_id, landlord_id) references public.request (id, landlord_id) on delete set null (request_id)
);
create index deduction_settlement_idx on public.deduction (settlement_id, position);

-- DOCUMENT ★7 (D-15). Files live in the private `documents` bucket; tenant pages never fetch them.
create table public.document (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid not null references public.landlord (id) on delete cascade,
  unit_id        uuid,                                                                       -- null only for the logo
  tenancy_id     uuid,
  request_id     uuid,
  settlement_id  uuid,
  deduction_id   uuid,
  type           public.document_type not null,
  storage_path   text not null unique,                                                       -- <landlord_id>/<document_id> in bucket `documents`
  file_name      text not null,
  mime           text not null,
  size_bytes     integer not null check (size_bytes >= 0),
  alt_text       text,                                                                       -- E5: meaningful alternative text, not the file name
  is_protected   boolean not null default false,                                             -- ★7 D-15: set on the settled statement
  uploaded_at    timestamptz not null default now(),
  uploaded_by    public.uploaded_by not null,
  updated_at     timestamptz not null default now(),
  unique (id, landlord_id),
  foreign key (unit_id, landlord_id) references public.unit (id, landlord_id) on delete cascade,
  foreign key (tenancy_id, landlord_id) references public.tenancy (id, landlord_id) on delete cascade,
  foreign key (request_id, landlord_id) references public.request (id, landlord_id) on delete cascade,
  foreign key (settlement_id, landlord_id) references public.settlement (id, landlord_id) on delete cascade,
  foreign key (deduction_id, landlord_id) references public.deduction (id, landlord_id) on delete cascade,
  constraint document_logo_has_no_unit check (type = 'logo' or unit_id is not null)
);
create index document_unit_idx on public.document (unit_id, type);
create index document_request_idx on public.document (request_id);
create index document_landlord_idx on public.document (landlord_id, uploaded_at);
comment on column public.document.is_protected is '★7 D-15. True for the settled settlement statement. Delete refused in the API and by trigger.';

alter table public.landlord
  add constraint landlord_logo_document_fk foreign key (logo_document_id) references public.document (id) on delete set null;
alter table public.settlement
  add constraint settlement_document_fk foreign key (document_id, landlord_id) references public.document (id, landlord_id) on delete set null (document_id);
alter table public.deduction
  add constraint deduction_document_fk foreign key (document_id, landlord_id) references public.document (id, landlord_id) on delete set null (document_id);
alter table public.message
  add constraint message_settlement_fk foreign key (settlement_id, landlord_id) references public.settlement (id, landlord_id) on delete cascade;

-- AUDIT EVENT ★6 (D-14). Append-only.
create table public.audit_event (
  id           uuid primary key default gen_random_uuid(),
  landlord_id  uuid not null references public.landlord (id) on delete cascade,
  actor        public.audit_actor not null,
  entity_type  text not null,                                                                -- 'request', 'rent_entry', 'payment', 'tenancy', 'settlement', 'document', 'unit'
  entity_id    uuid not null,
  kind         text not null,                                                                -- e.g. 'status_change' (the only kind tenant code reads, D-30), 'amount_edit', 'note'
  old_value    jsonb,
  new_value    jsonb,
  note         text,
  created_at   timestamptz not null default now()
);
create index audit_event_entity_idx on public.audit_event (entity_type, entity_id, created_at);
create index audit_event_landlord_idx on public.audit_event (landlord_id, created_at);

-- SIGN-IN THROTTLE (L-01: "After five failed attempts, add a 30-second delay and say so plainly").
-- Pre-authentication, so no landlord_id. Service role only: RLS on, no policies (section 9).
create table public.signin_throttle (
  email           extensions.citext primary key,
  failed_count    integer not null default 0 check (failed_count >= 0),
  last_failed_at  timestamptz,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- 4 · updated_at and landlord_id derivation triggers
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'landlord', 'property', 'unit', 'tenancy', 'agreement', 'rent_entry', 'payment', 'vendor',
    'request', 'settlement', 'deduction', 'document', 'signin_throttle'
  ] loop
    execute format(
      'create trigger t90_set_updated_at before update on public.%I for each row execute function app.set_updated_at()', t);
  end loop;
end $$;

-- Trigger names are prefixed so they fire in order (Postgres fires same-event triggers alphabetically):
-- t10 derive landlord_id → t20 allocate numbers → constraints.
create trigger t10_derive_landlord before insert on public.unit
  for each row execute function app.derive_landlord_id('property', 'property_id');
create trigger t10_derive_landlord before insert on public.tenancy
  for each row execute function app.derive_landlord_id('unit', 'unit_id');
create trigger t10_derive_landlord before insert on public.agreement
  for each row execute function app.derive_landlord_id('tenancy', 'tenancy_id');
create trigger t10_derive_landlord before insert on public.rent_entry
  for each row execute function app.derive_landlord_id('tenancy', 'tenancy_id');
create trigger t10_derive_landlord before insert on public.request
  for each row execute function app.derive_landlord_id('unit', 'unit_id');
create trigger t10_derive_landlord before insert on public.deduction
  for each row execute function app.derive_landlord_id('settlement', 'settlement_id');
create trigger t10_derive_landlord before insert on public.settlement
  for each row execute function app.derive_landlord_id('tenancy', 'tenancy_id');

-- ---------------------------------------------------------------------------------------------
-- 5 · Payment: landlord/tenancy from the rent entry, receipt number allocation, guards (D-10…D-12)
-- ---------------------------------------------------------------------------------------------
create function app.payment_before_insert() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
declare
  re  public.rent_entry%rowtype;
  n   integer;
begin
  select * into re from public.rent_entry where id = new.rent_entry_id;
  if not found then
    raise exception 'rent entry % does not exist', new.rent_entry_id using errcode = 'foreign_key_violation';
  end if;
  new.landlord_id := coalesce(new.landlord_id, re.landlord_id);
  new.tenancy_id  := re.tenancy_id;

  -- D-12: per-landlord, gapless at allocation, never reused. The API role can never choose a number;
  -- the service role may supply one (the demo seed loads numbered history).
  if new.receipt_number is null or not app.is_privileged() then
    insert into app.sequence (landlord_id) values (new.landlord_id) on conflict do nothing;
    update app.sequence set next_receipt = next_receipt + 1
      where landlord_id = new.landlord_id
      returning next_receipt - 1 into n;
    new.receipt_number := 'RR-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;
create trigger t20_payment_before_insert before insert on public.payment
  for each row execute function app.payment_before_insert();

-- D-11: a payment is never deleted or renumbered through the API; it is voided. Service role excepted.
create function app.payment_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if app.is_privileged() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'payments are voided, never deleted (D-11)' using errcode = 'P0001';
  end if;
  if new.receipt_number <> old.receipt_number or new.rent_entry_id <> old.rent_entry_id
     or new.landlord_id <> old.landlord_id or new.amount <> old.amount or new.received_on <> old.received_on then
    raise exception 'a recorded payment cannot be edited; void it and record again (D-11)' using errcode = 'P0001';
  end if;
  if old.status = 'voided' and new.status <> 'voided' then
    raise exception 'a voided payment stays voided (D-11)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger t30_payment_guard before update or delete on public.payment
  for each row execute function app.payment_guard();

-- ---------------------------------------------------------------------------------------------
-- 6 · Request number allocation (D-12); document protection (D-15); audit immutability (D-14)
-- ---------------------------------------------------------------------------------------------
create function app.request_before_insert() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
declare n integer;
begin
  if new.request_number is null or not app.is_privileged() then
    insert into app.sequence (landlord_id) values (new.landlord_id) on conflict do nothing;
    update app.sequence set next_request = next_request + 1
      where landlord_id = new.landlord_id
      returning next_request - 1 into n;
    new.request_number := 'R-' || lpad(n::text, 4, '0');
  end if;
  -- D-21: effective values start equal to the reported ones.
  new.category := coalesce(new.category, new.reported_category);
  new.urgency  := coalesce(new.urgency, new.reported_urgency);
  return new;
end;
$$;
create trigger t20_request_before_insert before insert on public.request
  for each row execute function app.request_before_insert();

-- D-21: reported_* are immutable; the effective urgency is never lower than the tenant reported.
create function app.request_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.reported_category <> old.reported_category or new.reported_urgency <> old.reported_urgency
     or new.request_number <> old.request_number then
    raise exception 'the tenant''s reported category, urgency and the request number are immutable (D-21, D-12)'
      using errcode = 'P0001';
  end if;
  if new.urgency < new.reported_urgency then
    raise exception 'urgency may be raised above the reported value but never lowered below it (D-21)'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger t30_request_guard before update on public.request
  for each row execute function app.request_guard();

create function app.document_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_protected and not app.is_privileged() then
      raise exception 'Settled statements cannot be deleted (D-15)' using errcode = 'P0001';
    end if;
    return old;
  end if;
  -- Once protected, stays protected through the API.
  if old.is_protected and not new.is_protected and not app.is_privileged() then
    raise exception 'a protected document cannot be unprotected (D-15)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger t30_document_guard before update or delete on public.document
  for each row execute function app.document_guard();

create function app.audit_event_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if app.is_privileged() then
    return coalesce(new, old);
  end if;
  raise exception 'audit events are append-only (D-14)' using errcode = 'P0001';
end;
$$;
create trigger t30_audit_event_guard before update or delete on public.audit_event
  for each row execute function app.audit_event_guard();

-- ---------------------------------------------------------------------------------------------
-- 7 · Sign-up creates the landlord row (D-20: sign-up collects name, email, password)
-- ---------------------------------------------------------------------------------------------
create function app.handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
declare display_name text;
begin
  display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  insert into public.landlord (auth_user_id, name, email)
  values (new.id, coalesce(display_name, split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- Keep landlord.email in step with the auth email (change confirmed through Supabase Auth).
create function app.handle_user_email_change() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.landlord set email = new.email where auth_user_id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function app.handle_user_email_change();

create function app.landlord_after_insert() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
begin
  insert into app.sequence (landlord_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger t50_landlord_after_insert after insert on public.landlord
  for each row execute function app.landlord_after_insert();

-- The API role never changes which auth user owns a landlord row.
create function app.landlord_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if not app.is_privileged() and new.auth_user_id <> old.auth_user_id then
    raise exception 'auth_user_id is immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger t30_landlord_guard before update on public.landlord
  for each row execute function app.landlord_guard();

-- ---------------------------------------------------------------------------------------------
-- 8 · Storage: one private bucket, served by short-lived signed URLs from the server only (D-15)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false,
  10485760,                                                                                  -- 10 MB before compression (decisions §9)
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;
-- No storage.objects policies: neither anon nor authenticated reads or writes files directly.

-- ---------------------------------------------------------------------------------------------
-- 9 · Row-level security on every table, from this migration (D-04, E4-5, E4-7)
--
-- Shape: the authenticated landlord sees and changes rows where landlord_id is theirs; nothing
-- else exists from their point of view, so a cross-landlord request returns zero rows and the app
-- says "Not found", never "Forbidden". anon has no policy on any table and its default table
-- grants are revoked: public tenant routes never touch a table directly (they go through
-- src/server/tenant with the service role, D-04). The service role bypasses RLS by design.
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'landlord', 'property', 'unit', 'tenancy', 'agreement', 'rent_entry', 'payment', 'vendor',
    'request', 'message', 'settlement', 'deduction', 'document', 'audit_event', 'signin_throttle'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- landlord: own row only; created by trigger, never deleted through the API.
create policy landlord_select_own on public.landlord for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy landlord_update_own on public.landlord for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- Full ownership (select / insert / update / delete) on the ordinary entities.
do $$
declare t text;
begin
  foreach t in array array[
    'property', 'unit', 'tenancy', 'agreement', 'rent_entry', 'vendor', 'request', 'message',
    'settlement', 'deduction', 'document'
  ] loop
    execute format($p$
      create policy %1$I on public.%2$I for all to authenticated
        using (landlord_id = (select app.current_landlord_id()))
        with check (landlord_id = (select app.current_landlord_id()))
    $p$, t || '_landlord_all', t);
  end loop;
end $$;

-- payment: read, record, void. No delete (D-11; the trigger refuses it as well).
create policy payment_landlord_select on public.payment for select to authenticated
  using (landlord_id = (select app.current_landlord_id()));
create policy payment_landlord_insert on public.payment for insert to authenticated
  with check (landlord_id = (select app.current_landlord_id()));
create policy payment_landlord_update on public.payment for update to authenticated
  using (landlord_id = (select app.current_landlord_id()))
  with check (landlord_id = (select app.current_landlord_id()));

-- audit_event: read and append. No update or delete (D-14; the trigger refuses them as well).
create policy audit_event_landlord_select on public.audit_event for select to authenticated
  using (landlord_id = (select app.current_landlord_id()));
create policy audit_event_landlord_insert on public.audit_event for insert to authenticated
  with check (landlord_id = (select app.current_landlord_id()));

-- signin_throttle: no policies at all. Only the service role (server-side sign-in action) reaches it.
revoke all on table public.signin_throttle from authenticated;

-- Future tables created by migrations in this schema get no anon grant by default.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
