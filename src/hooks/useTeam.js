import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ROLE_LABELS } from '../auth/roles';

// Maps a Supabase profile row into the full member shape the Team UI expects.
// Fields we don't track yet get benign placeholders; they gain real data as
// the platform grows (positions, devices, shifts...).
const profileToMember = (p) => ({
  id: p.id,
  name: p.display_name || p.email || 'Unnamed',
  initials: (p.display_name || p.email || '?')
    .split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join(''),
  role: p.role,
  title: ROLE_LABELS[p.role] ?? p.role,
  department: '—',
  email: p.email ?? '—',
  phone: p.phone ?? '—',
  mobile: p.phone ?? '—',
  emergencyPhone: '—',
  radioCallsign: p.callsign ?? '—',
  radioFrequency: '—',
  badge: '—',
  status: 'online',
  location: { lat: '—', lng: '—', lastUpdate: 'no locator yet', accuracy: '—' },
  locatorEnabled: false,
  locatorType: 'mobile_app',
  devices: [],
  permissions: {
    liveStreams: { view: true, control: p.role !== 'viewer', acknowledge: p.role !== 'viewer' },
    drones: { view: true, control: ['operator', 'coordinator', 'admin'].includes(p.role), emergency: ['coordinator', 'admin'].includes(p.role), assign: p.role === 'admin' },
    tacticalMap: { view: true, edit: p.role !== 'viewer', markers: p.role !== 'viewer', geofences: ['coordinator', 'admin'].includes(p.role) },
    library: { view: true, export: p.role !== 'viewer', delete: p.role === 'admin' },
    team: { view: true, edit: p.role === 'admin', invite: ['coordinator', 'admin'].includes(p.role), remove: p.role === 'admin' },
    billing: { view: p.role === 'admin', edit: p.role === 'admin' },
    settings: { view: ['coordinator', 'admin'].includes(p.role), edit: p.role === 'admin' },
  },
  certifications: [],
  trainingCompleted: [],
  alertsHandled: 0,
  avgResponseTime: '—',
  lastActive: '—',
  joinedDate: p.created_at?.slice(0, 10) ?? '—',
  notes: '',
  emergencyContacts: [],
  shifts: { current: '—', schedule: '—' },
});

export const useTeam = () => {
  const isLive = isSupabaseConfigured;
  const [liveMembers, setLiveMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    setError(null);
    const [profilesRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('invitations').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    if (profilesRes.error) setError(profilesRes.error.message);
    setLiveMembers((profilesRes.data ?? []).map(profileToMember));
    // invitations read is coordinator+ only; a viewer just gets an empty list
    setInvitations(invitesRes.data ?? []);
    setLoading(false);
  }, [isLive]);

  useEffect(() => { refresh(); }, [refresh]);

  const createInvitation = useCallback(async ({ role, email }) => {
    const me = (await supabase.auth.getUser()).data?.user;
    const { data: myProfile } = await supabase.from('profiles').select('org_id').eq('id', me.id).single();
    const { data, error } = await supabase
      .from('invitations')
      .insert({ org_id: myProfile.org_id, role, email: email || null, invited_by: me.id })
      .select()
      .single();
    if (error) throw error;
    await supabase.from('events').insert({
      org_id: myProfile.org_id, actor_id: me.id, actor_kind: 'user',
      type: 'invitation.created', payload: { role, email: email || null },
    });
    await refresh();
    return data; // includes the generated code
  }, [refresh]);

  const revokeInvitation = useCallback(async (id) => {
    const { error } = await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { isLive, liveMembers, invitations, loading, error, refresh, createInvitation, revokeInvitation };
};
