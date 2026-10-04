import { Component } from 'react';
import { logEvent } from '../lib/eventLog';
import { useI18n } from '../i18n/index.jsx';

// The app-level fallback screen. A function component so it can read the
// language; English stays readable even outside the translation context.
const DefaultFallback = () => {
  const { t } = useI18n();
  const tt = (k, en) => { const v = t(k); return v === k ? en : v; };
  return (
    <div className="fixed inset-0 z-[130] bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-lg font-bold text-white">{tt('shell.x.crashTitle', 'Something went wrong on this screen')}</p>
        <p className="text-sm text-slate-400">{tt('shell.x.crashNote', 'It has been reported. Your data is safe.')}</p>
        <button onClick={() => window.location.reload()}
          className="w-full h-14 rounded-2xl bg-orange-500 text-white text-lg font-bold">{tt('shell.x.reload', 'Reload Watchtower')}</button>
      </div>
    </div>
  );
};

// A crash in one screen must never leave a responder looking at a black,
// dead display. Shows a way out instead, and records what broke.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      logEvent('app.error', {
        where: this.props.name ?? 'app',
        message: String(error?.message ?? error).slice(0, 300),
        stack: String(info?.componentStack ?? '').slice(0, 600),
      });
    } catch { /* logging must never throw */ }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const reset = () => this.setState({ error: null });
    return this.props.fallback
      ? this.props.fallback({ error: this.state.error, reset })
      : <DefaultFallback />;
  }
}
