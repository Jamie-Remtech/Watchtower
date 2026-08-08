import { useState } from 'react';
import { Mail, KeyRound, Ticket, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LogoMark } from '../components/common';

// Three onboarding paths: password sign-in, magic link, invitation-code signup.
const MODES = [
  { id: 'password', label: 'Sign in' },
  { id: 'magic', label: 'Magic link' },
  { id: 'invite', label: 'Join with invite' },
];

export const LoginScreen = () => {
  const { signInWithPassword, signInWithMagicLink, signUpWithInvite } = useAuth();
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'password') {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
      } else if (mode === 'magic') {
        const { error } = await signInWithMagicLink(email);
        if (error) throw error;
        setNotice('Check your email — your sign-in link is on its way.');
      } else {
        const { error } = await signUpWithInvite(email, password, inviteCode.trim(), displayName.trim());
        if (error) throw error;
        setNotice('Account created. Check your email to confirm, then sign in.');
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <LogoMark className="h-10 w-10" />
          <span className="font-bold text-2xl">
            <span className="text-orange-500">Watch</span>
            <span className="text-slate-100">tower</span>
          </span>
        </div>
        <p className="text-center text-slate-500 text-xs mb-6">Tactical coordination hub</p>

        <div className="flex gap-1 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setError(null); setNotice(null); }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === m.id ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
          {mode === 'invite' && (
            <>
              <div className="relative">
                <Ticket className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input className={`${input} pl-9`} placeholder="Invitation code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
              </div>
              <input className={input} placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input className={`${input} pl-9`} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {mode !== 'magic' && (
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input className={`${input} pl-9`} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {notice && <p className="text-green-400 text-xs">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'password' ? 'Sign in' : mode === 'magic' ? 'Send magic link' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-4">
          Access is provisioned by your organization&apos;s administrator.
        </p>
      </div>
    </div>
  );
};
