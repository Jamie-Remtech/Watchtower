import { useState } from 'react';
import {
  ClipboardList, Play, Plus, Sparkles, X, Check, Loader2, ChevronDown, ChevronRight,
  Flame, Activity, CloudRain, Stethoscope, Wrench, Square, CheckSquare, Trash2, Pencil, FileText,
} from 'lucide-react';
import { useProtocols } from '../hooks/useProtocols';
import { useAuth } from '../auth/AuthContext';
import { hasAtLeast } from '../auth/roles';

// ============================================
// PROTOCOLS — playbooks executed together, patterns recorded.
// Library of response checklists (AI can draft them) + live runs the
// whole team checks off in realtime; completed runs get an AI debrief.
// ============================================

const KIND_META = {
  wildfire: { icon: Flame, label: 'Wildfire', color: 'text-orange-400' },
  seismic: { icon: Activity, label: 'Seismic', color: 'text-red-400' },
  weather: { icon: CloudRain, label: 'Weather', color: 'text-sky-400' },
  medical: { icon: Stethoscope, label: 'Medical', color: 'text-green-400' },
  custom: { icon: Wrench, label: 'Custom', color: 'text-slate-400' },
};
const kindMeta = (k) => KIND_META[k] ?? KIND_META.custom;

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

// ---------- editor (create / edit, with AI draft) ----------
const ProtocolEditor = ({ initial, onSave, onClose, draftWithAI }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState(initial?.trigger_kind ?? 'custom');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [steps, setSteps] = useState(initial?.steps?.map(s => s.text) ?? ['']);
  const [situation, setSituation] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const draft = async () => {
    if (!situation.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const d = await draftWithAI(situation.trim());
      setName(d.name ?? name);
      setKind(KIND_META[d.trigger_kind] ? d.trigger_kind : 'custom');
      setDescription(d.description ?? '');
      setSteps((d.steps ?? []).map(String));
    } catch (e) {
      setError(e.message ?? 'Draft failed');
    }
    setDrafting(false);
  };

  const save = async () => {
    const clean = steps.map(s => s.trim()).filter(Boolean);
    if (!name.trim() || clean.length === 0) { setError('Name and at least one step are required'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), trigger_kind: kind, description: description.trim(), steps: clean });
      onClose();
    } catch (e) {
      setError(e.message ?? 'Could not save');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-orange-400" />
            {initial ? 'Edit protocol' : 'New protocol'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* AI draft */}
          {!initial && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-2">
              <p className="text-[11px] text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />Describe the situation — the AI drafts the checklist, you edit it.
              </p>
              <div className="flex gap-2">
                <input
                  value={situation}
                  onChange={e => setSituation(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') draft(); }}
                  placeholder="e.g. crew cut off by rising river during storm"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={draft}
                  disabled={drafting || !situation.trim()}
                  className="px-3 py-2 bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                >
                  {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Draft
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Trigger</label>
              <select value={kind} onChange={e => setKind(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500">
                {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">When to run it</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="One sentence"
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500" />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Steps (in order)</label>
            <div className="space-y-1.5 mt-1">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-600 w-5 text-right flex-shrink-0">{i + 1}.</span>
                  <input
                    value={s}
                    onChange={e => setSteps(arr => arr.map((x, j) => (j === i ? e.target.value : x)))}
                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                  <button onClick={() => setSteps(arr => arr.filter((_, j) => j !== i))} className="p-1.5 text-slate-500 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setSteps(arr => [...arr, ''])}
              className="mt-2 flex items-center gap-1 text-xs text-orange-300 hover:text-orange-200">
              <Plus className="w-3.5 h-3.5" />Add step
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-3 border-t border-slate-700">
          <span className="text-xs text-red-400">{error}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">Cancel</button>
            <button onClick={save} disabled={busy}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save protocol
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- a live run card ----------
const RunCard = ({ run, onToggle, onEnd, canEnd }) => {
  const done = run.steps.filter(s => s.done).length;
  const total = run.steps.length;
  const [confirmAbort, setConfirmAbort] = useState(false);
  return (
    <div className="bg-slate-900/70 border border-orange-500/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse inline-block" />
          <h4 className="text-sm font-bold text-white">{run.name}</h4>
          <span className="text-[10px] text-slate-500">started {timeAgo(run.started_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-orange-300 font-mono">{done}/{total}</span>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {run.context?.attention?.title && (
        <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1.5">
          Triggered by alert: {run.context.attention.title}
        </p>
      )}

      <div className="space-y-1">
        {run.steps.map(s => (
          <button
            key={s.id}
            onClick={() => onToggle(run.id, s.id)}
            className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
              s.done ? 'bg-green-500/10' : 'bg-slate-800/50 hover:bg-slate-800'
            }`}
          >
            {s.done
              ? <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              : <Square className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />}
            <span className="min-w-0 flex-1">
              <span className={`block text-xs ${s.done ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{s.text}</span>
              {s.done && <span className="text-[10px] text-green-500">{s.by_name ?? 'someone'} · {timeAgo(s.at)}</span>}
            </span>
          </button>
        ))}
      </div>

      {canEnd && (
        <div className="flex items-center justify-end gap-2 pt-1">
          {confirmAbort ? (
            <button onClick={() => onEnd(run.id, 'aborted')} className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg text-xs font-bold">
              Confirm abort
            </button>
          ) : (
            <button onClick={() => { setConfirmAbort(true); setTimeout(() => setConfirmAbort(false), 3000); }}
              className="px-3 py-1.5 text-slate-500 hover:text-red-400 text-xs">
              Abort
            </button>
          )}
          <button onClick={() => onEnd(run.id, 'completed')}
            className="px-3 py-1.5 bg-green-500/20 border border-green-500/40 text-green-300 rounded-lg text-xs font-medium flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />Complete & debrief
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- main tab ----------
export const ProtocolsTab = () => {
  const { protocols, runs, loading, error, createProtocol, updateProtocol, deleteProtocol, seedStarters, startRun, toggleStep, endRun, draftWithAI } = useProtocols();
  const { profile } = useAuth();
  const canManage = hasAtLeast(profile?.role, 'coordinator');
  const canRun = hasAtLeast(profile?.role, 'field');
  const [editing, setEditing] = useState(null);      // null | 'new' | protocol
  const [starting, setStarting] = useState(null);    // protocol id being started
  const [seeding, setSeeding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openHistory, setOpenHistory] = useState(null);
  const [actionError, setActionError] = useState(null);

  const activeRuns = runs.filter(r => r.status === 'active');
  const pastRuns = runs.filter(r => r.status !== 'active');

  const begin = async (p) => {
    setStarting(p.id);
    setActionError(null);
    try { await startRun(p); } catch (e) { setActionError(e.message); }
    setStarting(null);
  };

  const doEnd = async (runId, status) => {
    setActionError(null);
    try { await endRun(runId, status); } catch (e) { setActionError(e.message); }
  };

  const doToggle = async (runId, stepId) => {
    setActionError(null);
    try { await toggleStep(runId, stepId, profile?.display_name ?? 'crew'); } catch (e) { setActionError(e.message); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-orange-400" />
          Protocols
        </h2>
        {canManage && (
          <button onClick={() => setEditing('new')}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-xs font-medium flex items-center gap-1.5 text-white">
            <Plus className="w-3.5 h-3.5" />New protocol
          </button>
        )}
      </div>
      {(error || actionError) && <p className="text-xs text-red-400">{error ?? actionError}</p>}

      {/* ACTIVE RUNS — the live checklists, top priority */}
      {activeRuns.length > 0 && (
        <div className="space-y-3">
          {activeRuns.map(r => (
            <RunCard key={r.id} run={r} onToggle={doToggle} onEnd={doEnd} canEnd={canRun} />
          ))}
        </div>
      )}

      {/* LIBRARY */}
      <div className="space-y-2">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">Playbook library</p>
        {loading && <p className="text-xs text-slate-500">Loading…</p>}
        {!loading && protocols.length === 0 && (
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center space-y-3">
            <p className="text-sm text-slate-400">No protocols yet. This is where the organization's playbooks live — checklists the whole team executes together when something happens.</p>
            {canManage && (
              <button
                onClick={async () => { setSeeding(true); try { await seedStarters(); } catch (e) { setActionError(e.message); } setSeeding(false); }}
                disabled={seeding}
                className="px-4 py-2 bg-orange-500/20 border border-orange-500/40 text-orange-300 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Add the three starter playbooks (wildfire · earthquake · severe weather)
              </button>
            )}
          </div>
        )}
        {protocols.map(p => {
          const meta = kindMeta(p.trigger_kind);
          const Icon = meta.icon;
          return (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl">
              <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{p.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{p.description ?? meta.label} · {(p.steps ?? []).length} steps</p>
              </div>
              {canManage && (
                <>
                  <button onClick={() => setEditing(p)} className="p-1.5 text-slate-500 hover:text-white" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {confirmDelete === p.id ? (
                    <button onClick={() => { deleteProtocol(p.id).catch(e => setActionError(e.message)); setConfirmDelete(null); }}
                      className="px-2 py-1 text-[10px] font-bold text-red-400">sure?</button>
                  ) : (
                    <button onClick={() => { setConfirmDelete(p.id); setTimeout(() => setConfirmDelete(c => (c === p.id ? null : c)), 2500); }}
                      className="p-1.5 text-slate-600 hover:text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
              {canRun && (
                <button
                  onClick={() => begin(p)}
                  disabled={starting === p.id}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                  title="Start a live run — the whole team sees the checklist and gets a push"
                >
                  {starting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Run
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* HISTORY — recorded patterns */}
      {pastRuns.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Past runs — the record the org learns from</p>
          {pastRuns.map(r => {
            const done = r.steps.filter(s => s.done).length;
            const open = openHistory === r.id;
            return (
              <div key={r.id} className="bg-slate-900/40 border border-slate-800 rounded-xl">
                <button onClick={() => setOpenHistory(open ? null : r.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                  {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    r.status === 'completed' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>{r.status}</span>
                  <span className="text-xs text-white font-medium flex-1 truncate">{r.name}</span>
                  <span className="text-[10px] text-slate-500">{done}/{r.steps.length} · {timeAgo(r.ended_at ?? r.started_at)}</span>
                </button>
                {open && (
                  <div className="px-4 pb-3 space-y-2">
                    {r.debrief && (
                      <div className="p-3 bg-slate-800/60 rounded-lg">
                        <p className="text-[10px] text-purple-300 uppercase tracking-wide flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" />AI after-action debrief
                        </p>
                        <p className="text-xs text-slate-200 whitespace-pre-wrap">{r.debrief}</p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {r.steps.map(s => (
                        <p key={s.id} className="text-[11px] flex items-start gap-1.5">
                          {s.done ? <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" /> : <X className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />}
                          <span className={s.done ? 'text-slate-300' : 'text-slate-600'}>
                            {s.text}{s.done && s.by_name ? ` — ${s.by_name}` : ''}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ProtocolEditor
          initial={editing === 'new' ? null : editing}
          draftWithAI={draftWithAI}
          onClose={() => setEditing(null)}
          onSave={(data) => (editing === 'new' ? createProtocol(data) : updateProtocol(editing.id, data))}
        />
      )}
    </div>
  );
};
