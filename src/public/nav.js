import { useEffect, useState } from 'react';

// Public pages live beside the app on the same origin:
//   /about   homepage (always)
//   /tour    tutorial (always)
//   /signin  sign-in screen (always)
//   /        signed in → the app; signed out → homepage, unless this
//            device chose to skip it (or it runs as the installed app)
const SKIP_KEY = 'wt-skip-home';

export const homeSkipped = () => {
  try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
};
export const setHomeSkipped = (skip) => {
  try { skip ? localStorage.setItem(SKIP_KEY, '1') : localStorage.removeItem(SKIP_KEY); } catch { /* private mode */ }
};

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Links that must reach sign-in directly (invite QR, check-in push, pop-outs)
const hasAppParams = () => {
  const p = new URLSearchParams(window.location.search);
  return ['join', 'checkin', 'pop'].some(k => p.has(k));
};

export const go = (path) => {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('wt-nav'));
  window.scrollTo(0, 0);
};

// Which public view (if any) to show instead of the app.
export const publicView = (signedIn) => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/about') return 'home';
  if (path === '/tour') return 'tour';
  if (path === '/signin') return signedIn ? null : 'signin';
  if (signedIn) return null;
  if (hasAppParams() || homeSkipped() || isStandalone()) return 'signin';
  return 'home';
};

export const usePath = () => {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const on = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', on);
    window.addEventListener('wt-nav', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('wt-nav', on); };
  }, []);
  return path;
};
