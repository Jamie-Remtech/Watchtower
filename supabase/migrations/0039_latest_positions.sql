-- ============================================================
-- Watchtower migration 0039: latest position per person
-- The tactical map used to read "the newest 300 positions" overall; one
-- active member reporting every 30 s filled all 300 and everyone else
-- (other members, linked companies) disappeared from the map. This returns
-- ONE row per person — their latest fix in the last p_days — with name,
-- callsign and company. SECURITY INVOKER: the caller's own read rules
-- apply (own company; linked companies for coordinator+).
-- ============================================================

create index if not exists positions_profile_at_idx on public.positions (profile_id, at desc);

create or replace function public.latest_positions(p_days integer default 7)
returns table (
  profile_id uuid, org_id uuid, lat double precision, lng double precision, accuracy double precision,
  at timestamptz, net_quality text, net_rtt_ms integer, net_effective text, net_type text,
  display_name text, callsign text, company text
)
language sql stable security invoker set search_path = public as
$$
  select distinct on (p.profile_id)
         p.profile_id, p.org_id, p.lat, p.lng, p.accuracy, p.at, p.net_quality, p.net_rtt_ms, p.net_effective, p.net_type,
         pr.display_name, pr.callsign, o.name
    from public.positions p
    left join public.profiles pr on pr.id = p.profile_id
    left join public.organizations o on o.id = p.org_id
   where p.at > now() - make_interval(days => least(greatest(p_days, 1), 30))
   order by p.profile_id, p.at desc
$$;
grant execute on function public.latest_positions(integer) to authenticated;
