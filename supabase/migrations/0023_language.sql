-- ============================================================
-- 0023: language — every member reads Watchtower in their own
-- language; the system translates everything people write.
--
-- profiles.language: the member's language (BCP-47 base: 'en', 'fr',
--   'es', …). NULL = follow the device.
-- messages.lang: the language a message was written in (the author's
--   setting at send time) so readers in the same language skip
--   translation entirely.
-- translations: per-company cache of machine translations, keyed by
--   a hash of the source text — the same sentence is translated once
--   per language, then served from here.
-- ============================================================

alter table public.profiles add column if not exists language text;
alter table public.messages add column if not exists lang text;

create table if not exists public.translations (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  src_hash   text not null,
  lang       text not null,
  text       text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, src_hash, lang)
);

alter table public.translations enable row level security;

create policy translations_read on public.translations
  for select using (org_id = public.current_org_id());
create policy translations_insert on public.translations
  for insert with check (org_id = public.current_org_id());
