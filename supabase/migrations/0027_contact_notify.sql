-- ============================================================
-- 0027: a new contact request alerts platform staff immediately
-- Insert → trigger → pg_net → contact-notify edge function → push to
-- every owner/staff device. notified_at makes delivery idempotent.
-- Realtime lets the Platform tab badge update live.
-- (The key below is the public anon key — it already ships in the app.)
-- ============================================================

alter table public.contact_requests add column if not exists notified_at timestamptz;
update public.contact_requests set notified_at = now() where notified_at is null and status <> 'new';

do $$ begin
  alter publication supabase_realtime add table public.contact_requests;
exception when duplicate_object then null; end $$;

create or replace function public.notify_contact_request() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/contact-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbWV6YmZrZG56enRwbXdpbW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTcyNzUsImV4cCI6MjEwMTU5MzI3NX0.n79p2rk0w_TQUU2QTLnM5s3sJvpAHExNz4rkPCo6D20'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  return new;
end $$;

drop trigger if exists contact_requests_notify on public.contact_requests;
create trigger contact_requests_notify after insert on public.contact_requests
  for each row execute function public.notify_contact_request();
