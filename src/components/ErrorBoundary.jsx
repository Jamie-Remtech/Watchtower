import { Component } from 'react';
import { logEvent } from '../lib/eventLog';

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
      : (
        <div className="fixed inset-0 z-[130] bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-4">
            <p className="text-lg font-bold text-white">Something went wrong on this screen</p>
            <p className="text-sm text-slate-400">It has been reported. Your data is safe.</p>
            <button onClick={() => window.location.reload()}
              className="w-full h-14 rounded-2xl bg-orange-500 text-white text-lg font-bold">Reload Watchtower</button>
          </div>
        </div>
      );
  }
}
