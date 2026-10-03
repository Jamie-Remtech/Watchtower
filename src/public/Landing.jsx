import { useState } from 'react';
import { ArrowRight, PlayCircle, Mail } from 'lucide-react';
import { LogoMark } from '../components/common';
import { useI18n, LANGUAGES } from '../i18n/index.jsx';
import { contentFor } from './content';
import { ContactForm } from './ContactForm';
import { go, homeSkipped, setHomeSkipped } from './nav';

export const PublicHeader = ({ c, signedIn }) => {
  const { lang, setDeviceLang } = useI18n();
  return (
    <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <button onClick={() => go('/about')} className="flex items-center gap-2 shrink-0">
          <LogoMark className="h-8 w-8" />
          <span className="font-bold text-lg hidden sm:inline">
            <span className="text-orange-500">Watch</span><span className="text-slate-100">tower</span>
          </span>
        </button>
        <nav className="flex items-center gap-1 sm:gap-3 ml-auto text-xs sm:text-sm">
          <button onClick={() => go('/tour')} className="px-2 py-1 text-slate-300 hover:text-white">{c.nav.tour}</button>
          <a href="/about#contact" onClick={(e) => { e.preventDefault(); go('/about'); setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 50); }}
            className="px-2 py-1 text-slate-300 hover:text-white hidden sm:inline">{c.nav.contact}</a>
          <select value={lang} onChange={e => setDeviceLang(e.target.value)} aria-label="Language"
            className="bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-xs text-slate-400 focus:outline-none max-w-[92px]">
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <button onClick={() => go(signedIn ? '/' : '/signin')}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-semibold whitespace-nowrap">
            {c.nav.open}
          </button>
        </nav>
      </div>
    </header>
  );
};

const Section = ({ id, title, lead, children }) => (
  <section id={id} className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
    {title && <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>}
    {lead && <p className="text-slate-400 mt-2 max-w-2xl">{lead}</p>}
    <div className="mt-6">{children}</div>
  </section>
);

export const Landing = ({ signedIn }) => {
  const { lang } = useI18n();
  const c = contentFor(lang);
  const [skip, setSkip] = useState(homeSkipped());
  const toggleSkip = (v) => { setSkip(v); setHomeSkipped(v); };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden">
      <PublicHeader c={c} signedIn={signedIn} />

      {/* HERO */}
      <div className="relative border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.18),transparent_60%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <p className="text-orange-400 text-xs sm:text-sm font-semibold uppercase tracking-widest">{c.hero.kicker}</p>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mt-3 max-w-3xl leading-tight">{c.hero.title}</h1>
          <p className="text-slate-300 text-base sm:text-lg mt-5 max-w-2xl">{c.hero.sub}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button onClick={() => go(signedIn ? '/' : '/signin')}
              className="px-5 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90">
              {c.hero.ctaOpen}<ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => go('/tour')}
              className="px-5 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-medium flex items-center justify-center gap-2 hover:border-orange-500/50">
              <PlayCircle className="w-4 h-4 text-orange-400" />{c.hero.ctaTour}
            </button>
            <button onClick={() => scrollTo('contact')}
              className="px-5 py-3 text-slate-300 hover:text-white font-medium flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />{c.hero.ctaContact}
            </button>
          </div>
          {!signedIn && (
            <label className="flex items-start gap-2 mt-6 text-xs text-slate-400 cursor-pointer max-w-md">
              <input type="checkbox" checked={skip} onChange={e => toggleSkip(e.target.checked)} className="mt-0.5 accent-orange-500" />
              {c.skip}
            </label>
          )}
        </div>
      </div>

      {/* WHY */}
      <Section title={c.problem.title} lead={c.problem.lead}>
        <div className="grid md:grid-cols-3 gap-4">
          {c.problem.items.map(([h, p]) => (
            <div key={h} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-semibold">{h}</h3>
              <p className="text-sm text-slate-400 mt-2">{p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FEATURES */}
      <div className="bg-slate-900/40 border-y border-slate-800">
        <Section title={c.features.title}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.features.items.map(([icon, h, p]) => (
              <div key={h} className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
                <div className="text-2xl" aria-hidden="true">{icon}</div>
                <h3 className="text-white font-semibold mt-2">{h}</h3>
                <p className="text-sm text-slate-400 mt-2">{p}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* HOW IT HELPS */}
      <Section title={c.how.title}>
        <ol className="relative border-l-2 border-orange-500/40 ml-2 space-y-6">
          {c.how.steps.map(([time, text], i) => (
            <li key={i} className="pl-6 relative">
              <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 border-4 border-slate-950" />
              <p className="text-xs font-mono text-orange-300">{time}</p>
              <p className="text-slate-200 mt-1">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* SCIENCE + WHO + PRICING */}
      <div className="bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-bold text-white">{c.science.title}</h2>
            <p className="text-sm text-slate-400 mt-2">{c.science.lead}</p>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{c.science.sources}</p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{c.who.title}</h2>
            <ul className="mt-3 space-y-1.5">
              {c.who.items.map(w => <li key={w} className="text-sm text-slate-300 flex gap-2"><span className="text-orange-400">›</span>{w}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{c.pricing.title}</h2>
            <p className="text-sm text-slate-400 mt-2">{c.pricing.body}</p>
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <Section id="contact" title={c.contact.title}>
        <div className="max-w-2xl"><ContactForm c={c} lang={lang} /></div>
      </Section>

      <footer className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-xs text-slate-500">
          <p>{c.footer}</p>
          <div className="flex gap-4">
            <button onClick={() => go('/tour')} className="hover:text-slate-300">{c.nav.tour}</button>
            <button onClick={() => go(signedIn ? '/' : '/signin')} className="hover:text-slate-300">{c.nav.open}</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
