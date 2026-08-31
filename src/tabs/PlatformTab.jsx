import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Loader2, X, Check, ChevronDown, ChevronRight, UserPlus,
  Link2, Receipt, Users, ArrowRightLeft, QrCode, Copy,
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { ROLES, ROLE_LABELS } from '../auth/roles';
import { logEvent } from '../lib/eventLog';

// ============================================
// PLATFORM — the creator's portal, above every company.
// Companies are isolated Watchtower organizations; from here you mint
// them, hand out their first admin invite, move people between them,
// link companies for mutual aid, and invoice them.
// ============================================

const money = (cents, cur) => `${(cents / 100).toFixed(2)} ${cur}`;
const STATUS_STYLE = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  sent: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  paid: 'bg-green-500/15 text-green-300 border-green-500/30',
  void: 'bg-slate-700/40 text-slate-500 border-slate-700',
};

const InviteQRBig = ({ code }) => {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/?join=${encodeURIComponent(code)}`, { width: 200, margin: 1 })
      .then(setDataUrl).catch(() => {});
  }, [code]);
  return dataUrl ? <img src={dataUrl} alt="Join code" className="rounded-lg border-4 border-white w-[160px] h-[160px]" /> : null;
};

export const PlatformTab = () => {
  const { profile } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [people, setPeople] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [links, setLinks] = useState([]);
  const [invites, setInvites] = useState([]);
  const [openOrg, setOpenOrg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [newCompany, setNewCompany] = useState('');
  const [freshInvite, setFreshInvite] = useState(null); // {org, code}
  const [copied, setCopied] = useState(false);
  const [moving, setMoving] = useState(null);           // profile being moved
  const [moveOrg, setMoveOrg] = useState('');
  const [moveRole, setMoveRole] = useState('field');
  const [invoiceDraft, setInvoiceDraft] = useState(null); // {org_id, label, amount, due, notes}
  const [linkDraft, setLinkDraft] = useState(null);       // {a, b, note}

  const refresh = useCallback(async () => {
    const [o, p, inv, l, iv] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at'),
      supabase.from('profiles').select('id, display_name, email, role, org_id, team_id').order('created_at'),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('org_links').select('*').order('created_at', { ascending: false }),
      supabase.from('invitations').select('id, org_id, code, role, status, expires_at').eq('status', 'pending'),
    ]);
    if (o.error) setError(o.error.message);
    setOrgs(o.data ?? []);
    setPeople(p.data ?? []);
    setInvoices(inv.data ?? []);
    setLinks(l.data ?? []);
    setInvites(iv.data ?? []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!profile?.platform_owner) {
    return <p className="text-sm text-slate-500 text-center py-12">Platform portal is reserved for the app creator.</p>;
  }

  const orgName = (id) => orgs.find(o => o.id === id)?.name ?? '?';

  const createCompany = async () => {
    const name = newCompany.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const { data: newId, error: err } = await supabase.rpc('create_company', { company_name: name });
      if (err) throw err;
      logEvent('platform.company_created', { name });
      setNewCompany('');
      await refresh();
      setOpenOrg(newId);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const mintAdminInvite = async (org) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from('invitations')
        .insert({ org_id: org.id, role: 'admin', invited_by: profile.id })
        .select().single();
      if (err) throw err;
      setFreshInvite({ org: org.name, code: data.code });
      await refresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const doMove = async () => {
    if (!moving || !moveOrg) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('assign_member', { target: moving.id, new_org: moveOrg, new_role: moveRole });
      if (err) throw err;
      logEvent('platform.member_moved', { name: moving.display_name, to: orgName(moveOrg), role: moveRole });
      setMoving(null);
      await refresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const saveInvoice = async () => {
    const d = invoiceDraft;
    if (!d?.label?.trim() || !(+d.amount > 0)) { setError('Invoice needs a label and an amount'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('invoices').insert({
        org_id: d.org_id, label: d.label.trim(),
        amount_cents: Math.round(+d.amount * 100),
        due_at: d.due || null, notes: d.notes?.trim() || null, status: 'draft',
      });
      if (err) throw err;
      logEvent('platform.invoice_created', { company: orgName(d.org_id), label: d.label, amount: d.amount });
      setInvoiceDraft(null);
      await refresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const setInvoiceStatus = async (id, status) => {
    const { error: err } = await supabase.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message); else await refresh();
  };

  const saveLink = async () => {
    const d = linkDraft;
    if (!d?.a || !d?.b || d.a === d.b) { setError('Pick two different companies to link'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('org_links').insert({ org_a: d.a, org_b: d.b, note: d.note?.trim() || null });
      if (err) throw err;
      logEvent('platform.link_created', { a: orgName(d.a), b: orgName(d.b) });
      setLinkDraft(null);
      await refresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const toggleLink = async (link) => {
    const status = link.status === 'active' ? 'suspended' : 'active';
    const { error: err } = await supabase.from('org_links').update({ status }).eq('id', link.id);
    if (err) setError(err.message); else await refresh();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-purple-400" />
          Platform
          <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">creator</span>
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={newCompany}
            onChange={e => setNewCompany(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createCompany(); }}
            placeholder="New company name…"
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 w-44"
          />
          <button onClick={createCompany} disabled={busy || !newCompany.trim()}
            className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" />Create
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* COMPANIES */}
      <div className="space-y-2">
        {orgs.map(org => {
          const members = people.filter(p => p.org_id === org.id);
          const orgInvoices = invoices.filter(i => i.org_id === org.id);
          const pendingInv = invites.filter(i => i.org_id === org.id);
          const unpaid = orgInvoices.filter(i => i.status === 'sent').reduce((a, i) => a + i.amount_cents, 0);
          const open = openOrg === org.id;
          return (
            <div key={org.id} className="bg-slate-900/50 border border-slate-800 rounded-xl">
              <button onClick={() => setOpenOrg(open ? null : org.id)} className="w-full flex items-center gap-2.5 px-3 py-3 text-left">
                {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <Building2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white flex-1 truncate">{org.name}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" />{members.length}</span>
                {unpaid > 0 && <span className="text-[10px] text-yellow-300">{money(unpaid, 'CAD')} due</span>}
              </button>

              {open && (
                <div className="px-4 pb-4 space-y-3">
                  {/* members */}
                  <div className="space-y-1">
                    {members.length === 0 && <p className="text-[11px] text-slate-500">No members yet — mint the admin invite below.</p>}
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/50 rounded-lg">
                        <span className="text-xs text-white flex-1 truncate">{m.display_name || m.email}</span>
                        <span className="text-[10px] text-slate-500">{ROLE_LABELS[m.role] ?? m.role}</span>
                        {!m.platform_owner && m.id !== profile.id && (
                          <button
                            onClick={() => { setMoving(m); setMoveOrg(''); setMoveRole(m.role === 'viewer' ? 'field' : m.role); }}
                            className="p-1 text-slate-500 hover:text-purple-300" title="Move to another company">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* first-admin invite */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => mintAdminInvite(org)} disabled={busy}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-slate-200 flex items-center gap-1.5 hover:border-purple-500/40 disabled:opacity-50">
                      <UserPlus className="w-3.5 h-3.5" />Mint admin invite
                    </button>
                    {pendingInv.map(i => (
                      <span key={i.id} className="text-[10px] font-mono px-2 py-1 bg-slate-800 rounded border border-slate-700 text-orange-300">
                        {i.code} · {i.role}
                      </span>
                    ))}
                  </div>

                  {/* invoices */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1"><Receipt className="w-3 h-3" />Invoices</p>
                      <button onClick={() => setInvoiceDraft({ org_id: org.id, label: '', amount: '', due: '', notes: '' })}
                        className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1">
                        <Plus className="w-3 h-3" />New invoice
                      </button>
                    </div>
                    {orgInvoices.map(inv => (
                      <div key={inv.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/50 rounded-lg">
                        <span className="text-xs text-white flex-1 truncate">{inv.label}</span>
                        <span className="text-xs text-slate-300 font-mono">{money(inv.amount_cents, inv.currency)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
                        {inv.status === 'draft' && (
                          <button onClick={() => setInvoiceStatus(inv.id, 'sent')} className="text-[10px] text-yellow-300 hover:underline">send</button>
                        )}
                        {inv.status === 'sent' && (
                          <button onClick={() => setInvoiceStatus(inv.id, 'paid')} className="text-[10px] text-green-300 hover:underline">mark paid</button>
                        )}
                        {inv.status !== 'void' && inv.status !== 'paid' && (
                          <button onClick={() => setInvoiceStatus(inv.id, 'void')} className="text-[10px] text-slate-500 hover:underline">void</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LINKS */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Link2 className="w-4 h-4 text-sky-400" />Company links</h3>
          <button onClick={() => setLinkDraft({ a: '', b: '', note: '' })}
            className="text-[11px] text-sky-300 hover:text-sky-200 flex items-center gap-1"><Plus className="w-3 h-3" />Link companies</button>
        </div>
        <p className="text-[10px] text-slate-600">Mutual-aid registry — mark which companies work together on special cases. (Shared live data across linked companies comes next.)</p>
        {links.length === 0 && <p className="text-[11px] text-slate-500">No links yet.</p>}
        {links.map(l => (
          <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/50 rounded-lg">
            <span className="text-xs text-white flex-1 truncate">{orgName(l.org_a)} ⇄ {orgName(l.org_b)}{l.note ? ` — ${l.note}` : ''}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${l.status === 'active' ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-slate-700/40 text-slate-500 border-slate-700'}`}>{l.status}</span>
            <button onClick={() => toggleLink(l)} className="text-[10px] text-slate-400 hover:underline">
              {l.status === 'active' ? 'suspend' : 'reactivate'}
            </button>
          </div>
        ))}
      </div>

      {/* fresh invite modal */}
      {freshInvite && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={() => setFreshInvite(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-5 space-y-3 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2"><QrCode className="w-4 h-4 text-purple-400" />Admin invite — {freshInvite.org}</h3>
            <div className="flex justify-center"><InviteQRBig code={freshInvite.code} /></div>
            <p className="text-lg font-mono text-orange-300">{freshInvite.code}</p>
            <p className="text-[11px] text-slate-500">Scan or send the code — signing up with it makes them the administrator of {freshInvite.org}, isolated from every other company.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { navigator.clipboard?.writeText(`Join ${freshInvite.org} on Watchtower: ${window.location.origin}/?join=${freshInvite.code}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy link'}
              </button>
              <button onClick={() => setFreshInvite(null)} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-xs">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* move member modal */}
      {moving && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={() => setMoving(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Move {moving.display_name || moving.email}</h3>
              <button onClick={() => setMoving(null)} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <p className="text-[11px] text-slate-500">Their account moves to the new company; their old company's history stays where it happened.</p>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">To company</label>
              <select value={moveOrg} onChange={e => setMoveOrg(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-purple-500">
                <option value="">Choose…</option>
                {orgs.filter(o => o.id !== moving.org_id).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">As role</label>
              <select value={moveRole} onChange={e => setMoveRole(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-purple-500">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <button onClick={doMove} disabled={busy || !moveOrg}
              className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Move member
            </button>
          </div>
        </div>
      )}

      {/* invoice modal */}
      {invoiceDraft && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={() => setInvoiceDraft(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Invoice — {orgName(invoiceDraft.org_id)}</h3>
              <button onClick={() => setInvoiceDraft(null)} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <input value={invoiceDraft.label} onChange={e => setInvoiceDraft(d => ({ ...d, label: e.target.value }))} placeholder="Label — e.g. September 2026"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={invoiceDraft.amount} onChange={e => setInvoiceDraft(d => ({ ...d, amount: e.target.value }))} placeholder="Amount (CAD)"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500" />
              <input type="date" value={invoiceDraft.due} onChange={e => setInvoiceDraft(d => ({ ...d, due: e.target.value }))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-purple-500" />
            </div>
            <textarea value={invoiceDraft.notes} onChange={e => setInvoiceDraft(d => ({ ...d, notes: e.target.value }))} rows={2} placeholder="Notes (what this covers — cost recovery)"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none" />
            <button onClick={saveInvoice} disabled={busy}
              className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create draft invoice
            </button>
          </div>
        </div>
      )}

      {/* link modal */}
      {linkDraft && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={() => setLinkDraft(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Link two companies</h3>
              <button onClick={() => setLinkDraft(null)} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            {['a', 'b'].map(k => (
              <select key={k} value={linkDraft[k]} onChange={e => setLinkDraft(d => ({ ...d, [k]: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-500">
                <option value="">{k === 'a' ? 'First company…' : 'Second company…'}</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ))}
            <input value={linkDraft.note} onChange={e => setLinkDraft(d => ({ ...d, note: e.target.value }))} placeholder="Note — e.g. 2026 fire season mutual aid"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500" />
            <button onClick={saveLink} disabled={busy}
              className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
