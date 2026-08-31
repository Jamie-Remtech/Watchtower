import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
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
  teamId: p.team_id ?? null,
  platformOwner: p.platform_owner === true,
  title: ROLE_LABELS[p.role] ?? p.role,
  department: '—',
  email: p.email ?? '—',
  phone: p.phone ?? '—',
  mobile: p.mobile ?? '—',
  emergencyPhone: p.emergency_phone ?? '—',
  emergencyContact: p.emergency_contact ?? '—',
  radioCallsign: p.callsign ?? '—',
  radioFrequency: p.frequency ?? '—',
  badge: '—',
  status: 'offline', // real presence overrides this where it's shown
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
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    setError(null);
    const [profilesRes, invitesRes, teamsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('invitations').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('teams').select('*').order('created_at'),
    ]);
    if (profilesRes.error) setError(profilesRes.error.message);
    setLiveMembers((profilesRes.data ?? []).map(profileToMember));
    // invitations read is coordinator+ only; a viewer just gets an empty list
    setInvitations(invitesRes.data ?? []);
    setTeams(teamsRes.data ?? []); // absent table (pre-0018) → empty
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

  // Stand a member down to viewer (world map only). Rank rules are
  // enforced server-side in drop_member.
  const dropMember = useCallback(async (id) => {
    const m = liveMembers.find(x => x.id === id);
    const { error } = await supabase.rpc('drop_member', { target: id });
    if (error) throw error;
    logEvent('member.dropped', { name: m?.name, was: m?.role }, id);
    await refresh();
  }, [liveMembers, refresh]);

  // Teams inside the company — parallel operations, micro-managed.
  const createTeam = useCallback(async (name) => {
    let orgId = localStorage.getItem('watchtower-org-id');
    if (!orgId) {
      const me = (await supabase.auth.getUser()).data?.user;
      const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', me?.id).single();
      orgId = prof?.org_id;
    }
    const { error } = await supabase.from('teams').insert({ org_id: orgId, name });
    if (error) throw error;
    logEvent('team.created', { name });
    await refresh();
  }, [refresh]);

  const removeTeam = useCallback(async (id) => {
    const t = teams.find(x => x.id === id);
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) throw error;
    logEvent('team.removed', { name: t?.name });
    await refresh();
  }, [teams, refresh]);

  const setMemberTeam = useCallback(async (memberId, teamId) => {
    const m = liveMembers.find(x => x.id === memberId);
    const t = teams.find(x => x.id === teamId);
    const { error } = await supabase.rpc('set_member_team', { target: memberId, new_team: teamId || null });
    if (error) throw error;
    logEvent('member.team_changed', { name: m?.name, team: t?.name ?? 'unassigned' }, memberId);
    await refresh();
  }, [liveMembers, teams, refresh]);

  // Save contact/radio fields (self, or any member when admin — RLS
  // enforces it; the profiles_guard trigger keeps role/org locked).
  const updateContact = useCallback(async (id, patch) => {
    const m = liveMembers.find(x => x.id === id);
    const { error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    logEvent('member.updated', { name: patch.display_name || m?.name }, id);
    await refresh();
  }, [liveMembers, refresh]);

  // Admin-only: set any member's role (used to restore dropped users).
  const setMemberRole = useCallback(async (id, role) => {
    const m = liveMembers.find(x => x.id === id);
    const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    logEvent('member.role_changed', { name: m?.name, from: m?.role, to: role }, id);
    await refresh();
  }, [liveMembers, refresh]);

  return { isLive, liveMembers, invitations, teams, loading, error, refresh, createInvitation, revokeInvitation, dropMember, setMemberRole, updateContact, createTeam, removeTeam, setMemberTeam };
};
