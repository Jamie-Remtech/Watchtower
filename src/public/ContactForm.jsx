import { useState } from 'react';
import { Loader2, Send, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Lands in the Platform tab (contact_requests) — no personal email on a public page.
export const ContactForm = ({ c, lang, initialTopic = 'access' }) => {
  const [f, setF] = useState({ name: '', email: '', organization: '', topic: initialTopic, message: '', website: '' });
  const [state, setState] = useState('idle'); // idle | busy | sent | fail
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (f.website) { setState('sent'); return; } // honeypot: bots fill hidden fields
    setState('busy');
    const { error } = await supabase.from('contact_requests').insert({
      name: f.name.trim().slice(0, 120),
      email: f.email.trim().slice(0, 200),
      organization: f.organization.trim().slice(0, 200) || null,
      topic: f.topic,
      message: f.message.trim().slice(0, 4000) || null,
      language: lang,
    });
    setState(error ? 'fail' : 'sent');
  };

  const input = 'w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';

  if (state === 'sent') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 text-sm text-green-200 flex gap-3">
        <Check className="w-5 h-5 shrink-0 text-green-400" />{c.contact.sent}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={input} placeholder={c.contact.name} value={f.name} onChange={set('name')} required maxLength={120} />
        <input className={input} type="email" placeholder={c.contact.email} value={f.email} onChange={set('email')} required maxLength={200} />
      </div>
      <input className={input} placeholder={c.contact.org} value={f.organization} onChange={set('organization')} maxLength={200} />
      <label className="block">
        <span className="text-[11px] text-slate-500 uppercase tracking-wide">{c.contact.topic}</span>
        <select className={`${input} mt-1`} value={f.topic} onChange={set('topic')}>
          {Object.entries(c.contact.topics).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <textarea className={`${input} resize-none`} rows={4} placeholder={c.contact.message} value={f.message} onChange={set('message')} maxLength={4000} />
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off"
        className="hidden" aria-hidden="true" />
      {state === 'fail' && <p className="text-xs text-red-400">{c.contact.fail}</p>}
      <button type="submit" disabled={state === 'busy'}
        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
        {state === 'busy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{c.contact.send}
      </button>
    </form>
  );
};
