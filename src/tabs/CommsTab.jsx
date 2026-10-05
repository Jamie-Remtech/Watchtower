import { useState, useEffect } from 'react';
import { Radio, Siren, Settings2, Plus, X, Check, Archive, MessagesSquare, Contact2, Megaphone, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { usePresence } from '../hooks/usePresence';
import { allowedTabs, hasAtLeast, ROLES } from '../auth/roles';
import { CheckInBoard } from '../components/CheckInBoard';
import { useCheckinsShared } from '../hooks/useCheckins';
import { useChannels, useContacts, useBroadcasts } from '../hooks/useComms';
import { useConversations } from '../hooks/useConversations';
import { ContactsPanel } from '../components/ContactsPanel';
import { BroadcastComposer, BroadcastList } from '../components/Broadcasts';
import { ConversationList } from '../components/comms/ConversationList';
import { Thread } from '../components/comms/Thread';
import { useI18n } from '../i18n/index.jsx';

// ============================================
// COMMS — conversations, outside contacts, emergency broadcasts.
// Conversations are split the way people think about them:
//   Groups   — All hands, company channels (by rank), private groups
//   Direct   — one-to-one with a teammate (private to the two of them)
//   Outside  — SMS / WhatsApp threads with outside contacts
// A list on the left, the open conversation on the right (one at a time
// on a phone). Coordinators manage company channels with the gear.
// ============================================

const COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#38bdf8', '#a855f7', '#ec4899', '#94a3b8'];

const ChannelManager = ({ channels, save, archive, onClose }) => {
  const { t } = useI18n();
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';
  const submit = async () => {
    try { await save(edit); setEdit(null); setErr(null); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2 flex-shrink-0">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-white">{t('cx.ch.manage')}</p>
        <button onClick={onClose} className="text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      {channels.map(c => (
        <div key={c.id} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
          <span className="text-white flex-1 min-w-0 truncate"># {c.name}</span>
          <span className="text-[10px] text-slate-500">{t('cx.ch.minRole', { r: t(`role.${c.min_role}`) })}</span>
          <button onClick={() => setEdit({ ...c })} className="text-[11px] text-slate-400 hover:text-white">{t('cx.ch.edit')}</button>
          <button onClick={() => archive(c.id).catch(e => setErr(e.message))} className="p-1 text-slate-500 hover:text-red-400" title={t('cx.ch.archive')}><Archive className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      {edit ? (
        <div className="space-y-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <input className={input} value={edit.name} onChange={e => setEdit(v => ({ ...v, name: e.target.value }))} placeholder={t('cx.ch.namePh')} maxLength={60} autoFocus />
          <input className={input} value={edit.description ?? ''} onChange={e => setEdit(v => ({ ...v, description: e.target.value }))} placeholder={t('cx.ch.descPh')} />
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLORS.map(c => <button key={c} onClick={() => setEdit(v => ({ ...v, color: c }))} className={`w-6 h-6 rounded-full border-2 ${edit.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />)}
          </div>
          <select className={input} value={edit.min_role} onChange={e => setEdit(v => ({ ...v, min_role: e.target.value }))}>
            {ROLES.filter(r => r !== 'viewer').map(r => <option key={r} value={r}>{t('cx.ch.whoCanSee', { r: t(`role.${r}`) })}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={!edit.name?.trim()} onClick={submit} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('veh.save')}</button>
            <button onClick={() => setEdit(null)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">{t('log.cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEdit({ name: '', color: COLORS[channels.length % COLORS.length], min_role: 'field', sort: channels.length })} className="text-[11px] text-orange-300 flex items-center gap-1"><Plus className="w-3 h-3" />{t('cx.ch.add')}</button>
      )}
      <p className="text-[10px] text-slate-500">{t('cx.ch.help')}</p>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
};

export const CommsTab = () => {
  const { profile, session } = useAuth();
  const { liveMembers, teams } = useTeam();
  const onlineIds = usePresence();
  const checkinsShared = useCheckinsShared();
  const { t } = useI18n();
  const { channels, save: saveChannel, archive: archiveChannel } = useChannels();
  const { contacts, groups } = useContacts();
  const { broadcasts, acks } = useBroadcasts();
  const myId = session?.user?.id;
  const isCoord = hasAtLeast(profile?.role, 'coordinator');
  const nameOf = Object.fromEntries(liveMembers.map(m => [m.id, m.name]));
  const { sections, totalUnread, markRead, refresh, loaded } = useConversations({ myId, nameOf, contacts });
  const [view, setView] = useState('messages'); // messages | contacts | broadcasts
  const [activeKey, setActiveKey] = useState(() => { try { return localStorage.getItem('wt-comms-conv') || 'ch:all'; } catch { return 'ch:all'; } });
  const [mobileOpen, setMobileOpen] = useState(false);   // phone: list ↔ thread
  const [manage, setManage] = useState(false);
  const [composing, setComposing] = useState(false);

  const all = [...sections.group, ...sections.direct, ...sections.external];
  const active = all.find(c => c.key === activeKey) ?? null;
  // a conversation that was archived, left or isn't visible any more → All hands
  useEffect(() => { if (loaded && !active && activeKey !== 'ch:all') setActiveKey('ch:all'); }, [loaded, active, activeKey]);
  useEffect(() => { try { localStorage.setItem('wt-comms-conv', activeKey); } catch { /* storage unavailable */ } }, [activeKey]);

  const titleOf = (c) => (c.type === 'channel' ? (c.channelId ? `# ${c.name}` : t('cx.allHands')) : c.name);
  const open = (key) => { setActiveKey(key); setMobileOpen(true); };

  const onlineCount = liveMembers.filter(m => onlineIds.has(m.id)).length;
  const openBroadcasts = broadcasts.filter(b => b.status === 'active' && b.require_ack && !acks.some(a => a.broadcast_id === b.id && a.profile_id === myId)).length;
  const tabBtn = (v, Icon, label, badge, tone = 'bg-red-600') => (
    <button onClick={() => setView(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${view === v ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40' : 'text-slate-400 border border-transparent hover:text-white'}`}>
      <Icon className="w-3.5 h-3.5" />{label}{badge ? <span className={`px-1.5 rounded-full ${tone} text-white text-[10px]`}>{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col gap-2">
      <div className="flex items-center justify-between flex-shrink-0 gap-2 flex-wrap">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-orange-400" />
          {t('comms.title')}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {liveMembers.slice(0, 8).map(m => (
            <span key={m.id} className="flex items-center gap-1 text-[10px] text-slate-400" title={m.name}>
              <span className={`w-2 h-2 rounded-full inline-block ${onlineIds.has(m.id) ? 'bg-green-400' : 'bg-slate-600'}`} />
              {m.name.split(' ')[0]}
            </span>
          ))}
          <span className="text-[10px] text-slate-600">{t('comms.online', { n: onlineCount })}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
        {tabBtn('messages', MessagesSquare, t('cx.v.messages'), totalUnread, 'bg-orange-500')}
        {tabBtn('contacts', Contact2, t('cx.v.contacts'))}
        {tabBtn('broadcasts', Megaphone, t('cx.v.broadcasts'), openBroadcasts)}
        <div className="flex-1" />
        {isCoord && view === 'messages' && <button onClick={() => setManage(v => !v)} className="p-1.5 text-slate-500 hover:text-white" title={t('cx.ch.manage')}><Settings2 className="w-4 h-4" /></button>}
        {isCoord && (
          <button onClick={() => setComposing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold">
            <Siren className="w-3.5 h-3.5" />{t('cx.bc.button')}
          </button>
        )}
      </div>

      {checkinsShared && !allowedTabs(profile?.role).includes('team') && view === 'messages' && (
        <div className="flex-shrink-0">
          <CheckInBoard members={liveMembers} teams={teams} checkins={checkinsShared.checkins} responses={checkinsShared.responses}
            requestCheckin={checkinsShared.requestCheckin} closeCheckin={checkinsShared.closeCheckin} />
        </div>
      )}

      {view === 'messages' && manage && <ChannelManager channels={channels} save={saveChannel} archive={archiveChannel} onClose={() => setManage(false)} />}

      {view === 'messages' && (
        <div className="flex-1 min-h-[420px] flex bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className={`${mobileOpen ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-72 md:flex-shrink-0 md:border-r border-slate-800 min-h-0`}>
            <ConversationList sections={sections} activeKey={activeKey} onOpen={open} titleOf={titleOf} nameOf={nameOf} myId={myId}
              members={liveMembers} onlineIds={onlineIds} onCreated={async (key) => { await refresh(); open(key); }} />
          </div>
          <div className={`${mobileOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 min-h-0`}>
            {active
              ? <Thread conv={{ ...active, lastSource: active.last?.source }} convTitle={titleOf(active)} myId={myId} profile={profile}
                  members={liveMembers} nameOf={nameOf} isCoord={isCoord} onRead={markRead}
                  onBack={(left) => { setMobileOpen(false); if (left) { setActiveKey('ch:all'); refresh(); } }} />
              : <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>}
          </div>
        </div>
      )}

      {view === 'contacts' && <div className="flex-1 min-h-0 overflow-y-auto"><ContactsPanel canManage={isCoord} /></div>}
      {view === 'broadcasts' && <div className="flex-1 min-h-0 overflow-y-auto"><BroadcastList members={liveMembers} contacts={contacts} canManage={isCoord} /></div>}

      {composing && <BroadcastComposer channels={channels} groups={groups} onClose={(sent) => { setComposing(false); if (sent) setView('broadcasts'); }} />}
    </div>
  );
};
