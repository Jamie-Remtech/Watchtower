-- ============================================================
-- Watchtower migration 0032: patient records (identity + medical)
-- The patients row stays the light, org-visible triage marker. Who
-- the patient is and their medical facts live here — personal health
-- information, readable only by field rank and up in the same company
-- (never viewers, never linked companies, never platform staff).
-- Every change keeps the previous version; every view/print/share is
-- logged. ID photos go to the private 'patient-files' bucket under
-- <org_id>/<patient_id>/…
-- ============================================================

create table if not exists public.patient_records (
  patient_id          uuid primary key references public.patients (id) on delete cascade,
  org_id              uuid not null references public.organizations (id) on delete cascade,
  last_name           text,
  first_name          text,
  dob                 date,
  age_est             integer,            -- when DOB unknown: estimated age
  sex                 text,               -- female | male | other | unknown
  language            text,
  phone               text,
  address             text,
  id_type             text,               -- driver licence, passport, provincial ID…
  id_number           text,
  id_issuer           text,
  health_card         text,
  health_card_issuer  text,
  health_card_expiry  text,
  emergency_name      text,
  emergency_relation  text,
  emergency_phone     text,
  blood_type          text,               -- A+ A- B+ B- AB+ AB- O+ O- unknown
  allergies           text,
  no_known_allergies  boolean not null default false,
  medications         text,
  conditions          text,
  weight_kg           numeric,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.profiles (id) on delete set null
);

create index if not exists patient_records_org_idx on public.patient_records (org_id);

-- Same-company field rank and up; the patient must belong to the company.
create or replace function public.can_see_patient_record(p_org uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select p_org = public.current_org_id() and public.current_role_at_least('field') $$;
grant execute on function public.can_see_patient_record(uuid) to authenticated;

alter table public.patient_records enable row level security;
drop policy if exists patient_records_read on public.patient_records;
create policy patient_records_read on public.patient_records
  for select using (public.can_see_patient_record(org_id));
drop policy if exists patient_records_insert on public.patient_records;
create policy patient_records_insert on public.patient_records
  for insert with check (
    public.can_see_patient_record(org_id)
    and exists (select 1 from public.patients p where p.id = patient_records.patient_id and p.org_id = patient_records.org_id)
  );
drop policy if exists patient_records_update on public.patient_records;
create policy patient_records_update on public.patient_records
  for update using (public.can_see_patient_record(org_id))
  with check (public.can_see_patient_record(org_id));

-- Revision history: the previous version of every changed field.
create table if not exists public.patient_record_revisions (
  id          bigint generated always as identity primary key,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  org_id      uuid not null,
  by_id       uuid references public.profiles (id) on delete set null,
  at          timestamptz not null default now(),
  changed     text[] not null,
  old_values  jsonb not null
);
create index if not exists patient_record_revisions_idx on public.patient_record_revisions (patient_id, at);
alter table public.patient_record_revisions enable row level security;
drop policy if exists patient_record_revisions_read on public.patient_record_revisions;
create policy patient_record_revisions_read on public.patient_record_revisions
  for select using (public.can_see_patient_record(org_id));

create or replace function public.patient_record_audit()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
  changed text[] := '{}';
  olds jsonb := '{}';
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.org_id := old.org_id;          -- a record never changes company
  new.patient_id := old.patient_id;
  for k in select jsonb_object_keys(n) loop
    if k in ('updated_at', 'updated_by', 'created_at') then continue; end if;
    if (o -> k) is distinct from (n -> k) then
      changed := changed || k;
      olds := olds || jsonb_build_object(k, o -> k);
    end if;
  end loop;
  if array_length(changed, 1) > 0 then
    insert into public.patient_record_revisions (patient_id, org_id, by_id, changed, old_values)
    values (old.patient_id, old.org_id, auth.uid(), changed, olds);
  end if;
  return new;
end
$$;
drop trigger if exists patient_record_audit on public.patient_records;
create trigger patient_record_audit before update on public.patient_records
  for each row execute function public.patient_record_audit();

-- Access log: who opened, printed, shared or copied a patient file.
create table if not exists public.patient_record_access (
  id          bigint generated always as identity primary key,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  org_id      uuid not null,
  by_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  at          timestamptz not null default now(),
  action      text not null check (action in ('view', 'edit', 'photo', 'scan', 'print', 'share', 'copy'))
);
create index if not exists patient_record_access_idx on public.patient_record_access (patient_id, at desc);
alter table public.patient_record_access enable row level security;
drop policy if exists patient_record_access_insert on public.patient_record_access;
create policy patient_record_access_insert on public.patient_record_access
  for insert with check (by_id = auth.uid() and public.can_see_patient_record(org_id));
drop policy if exists patient_record_access_read on public.patient_record_access;
create policy patient_record_access_read on public.patient_record_access
  for select using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- Photos attached to the patient file (ID front/back, health card, other).
create table if not exists public.patient_files (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  kind        text not null default 'id' check (kind in ('id', 'id_back', 'health_card', 'other')),
  path        text not null unique,
  extracted   jsonb,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists patient_files_idx on public.patient_files (patient_id, created_at);
alter table public.patient_files enable row level security;
drop policy if exists patient_files_read on public.patient_files;
create policy patient_files_read on public.patient_files
  for select using (public.can_see_patient_record(org_id));
drop policy if exists patient_files_insert on public.patient_files;
create policy patient_files_insert on public.patient_files
  for insert with check (
    public.can_see_patient_record(org_id)
    and created_by = auth.uid()
    and path like org_id::text || '/' || patient_id::text || '/%'
    and exists (select 1 from public.patients p where p.id = patient_files.patient_id and p.org_id = patient_files.org_id)
  );
drop policy if exists patient_files_update on public.patient_files;
create policy patient_files_update on public.patient_files
  for update using (public.can_see_patient_record(org_id));
drop policy if exists patient_files_delete on public.patient_files;
create policy patient_files_delete on public.patient_files
  for delete using (
    public.can_see_patient_record(org_id)
    and (created_by = auth.uid() or public.current_role_at_least('coordinator'))
  );

-- Private bucket; JPEG/PNG/WebP up to 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-files', 'patient-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists patient_files_obj_read on storage.objects;
create policy patient_files_obj_read on storage.objects
  for select to authenticated using (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role_at_least('field')
  );
drop policy if exists patient_files_obj_insert on storage.objects;
create policy patient_files_obj_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role_at_least('field')
  );
drop policy if exists patient_files_obj_delete on storage.objects;
create policy patient_files_obj_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (owner_id = auth.uid()::text or public.current_role_at_least('coordinator'))
  );

do $$ begin
  alter publication supabase_realtime add table public.patient_records;
exception when duplicate_object then null;
end $$;
