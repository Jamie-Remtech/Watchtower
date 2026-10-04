-- ============================================================
-- Watchtower migration 0036: what the company line can do
-- Field ranks cannot read connectors (coordinator+), but they need to know
-- whether Watchtower can text or call through the company's own number.
-- Returns booleans only — never numbers, settings or keys.
-- ============================================================

create or replace function public.comms_capabilities()
returns jsonb language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'sms', exists (select 1 from public.connectors c where c.org_id = public.current_org_id() and c.enabled and c.kind = 'twilio_sms' and c.secret_set),
    'whatsapp', exists (select 1 from public.connectors c where c.org_id = public.current_org_id() and c.enabled and c.kind = 'twilio_whatsapp' and c.secret_set),
    'voice', exists (select 1 from public.connectors c where c.org_id = public.current_org_id() and c.enabled and c.kind = 'twilio_sms' and c.secret_set)
  )
  where public.current_role_at_least('field')
$$;
grant execute on function public.comms_capabilities() to authenticated;
