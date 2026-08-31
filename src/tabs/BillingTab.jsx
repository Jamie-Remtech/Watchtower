import { useState, useEffect } from 'react';
import { CreditCard, Receipt } from 'lucide-react';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { supabase } from '../lib/supabase';
import { useOrg } from '../hooks/useOrg';
import { useDevices } from '../hooks/useDevices';
import { useTeam } from '../hooks/useTeam';

// Billing runs on real usage; invoices come from the platform (the
// app creator invoices companies at cost). Admins see their own.
const money = (cents, cur) => `${(cents / 100).toFixed(2)} ${cur}`;
const STATUS_STYLE = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  sent: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  paid: 'bg-green-500/15 text-green-300 border-green-500/30',
  void: 'bg-slate-700/40 text-slate-500 border-slate-700',
};

export const BillingTab = () => {
  const { devices } = useDevices();
  const { liveMembers } = useTeam();
  const org = useOrg();
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    supabase.from('invoices').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setInvoices((data ?? []).filter(i => i.status !== 'draft')));
  }, []);

  const due = invoices.filter(i => i.status === 'sent').reduce((a, i) => a + i.amount_cents, 0);

  return (
    <div className="space-y-4">
      <LiveEmptyState
        icon={CreditCard}
        title={`${org.tier ? org.tier.charAt(0).toUpperCase() + org.tier.slice(1) : ''} plan`}
        description="Billing runs on real usage. These figures come straight from your database."
        facts={[
          { label: 'Organization', value: org.name },
          { label: 'Team members', value: liveMembers.length },
          { label: 'Registered devices', value: devices.length },
          { label: 'Outstanding', value: due > 0 ? money(due, 'CAD') : 'nothing due' },
        ]}
        hint="Connected to Supabase · live mode"
      />

      {invoices.length > 0 && (
        <div className="max-w-2xl mx-auto bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-orange-400" />Invoices
          </h3>
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white">{inv.label}</p>
                {inv.notes && <p className="text-[10px] text-slate-500 truncate">{inv.notes}</p>}
              </div>
              {inv.due_at && <span className="text-[10px] text-slate-500">due {inv.due_at}</span>}
              <span className="text-sm text-slate-200 font-mono">{money(inv.amount_cents, inv.currency)}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
            </div>
          ))}
          <p className="text-[10px] text-slate-600">Cost-recovery billing — Watchtower charges companies what it costs to run.</p>
        </div>
      )}
    </div>
  );
};
