import { useState } from 'react';
import { KeyRound, X, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { logEvent } from '../lib/eventLog';

// Viewers (including stood-down members) can knock on the door:
// the request lands in the admins' attention bell and Activity feed.
export const RequestAccess = () => {
  const { profile, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(null); // 'sent' | 'already' | error string

  if (profile?.role !== 'viewer') return null;

  const send = async () => {
    setBusy(true);
    setState(null);
    try {
      const uid = session?.user?.id;
      let orgId = localStorage.getItem('watchtower-org-id');
      if (!orgId) {
        const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', uid).single();
        orgId = prof?.org_id;
        if (orgId) localStorage.setItem('watchtower-org-id', orgId);
      }
      const { error } = await supabase.from('attention_items').insert({
        org_id: orgId,
        dedupe_key: `access:${uid}`,
        severity: 'warning',
        kind: 'admin',
        title: `${profile?.display_name ?? 'A member'} requests access`,
        detail: message.trim() || 'No message given. Restore a role from the Team tab to unblock them.',
        subject: uid,
      });
      if (error) {
        if (/duplicate|unique/i.test(error.message)) setState('already');
        else throw error;
      } else {
        logEvent('access.requested', { message: message.trim() || null });
        setState('sent');
        setMessage('');
      }
    } catch (e) {
      setState(e.message ?? 'Could not send');
    }
    setBusy(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium"
      >
        <KeyRound className="w-3.5 h-3.5" />Request access
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Request access</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-400">
              Your account currently has world-view access only. Send a note to the administrators to request operational access.
            </p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Who you are and why you need access…"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
            />
            {state === 'sent' && <p className="text-xs text-green-400 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" />Sent — an administrator will review it.</p>}
            {state === 'already' && <p className="text-xs text-yellow-400">A request from you is already waiting for review.</p>}
            {state && state !== 'sent' && state !== 'already' && <p className="text-xs text-red-400">{state}</p>}
            <button
              onClick={send}
              disabled={busy}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Send request
            </button>
          </div>
        </div>
      )}
    </>
  );
};
