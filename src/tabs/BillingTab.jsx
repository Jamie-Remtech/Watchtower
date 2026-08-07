import { billingData } from '../data/billing';
import { orgData } from '../data/org';


export const BillingTab = () => (
  <div className="space-y-6">
    <h2 className="text-xl font-bold text-white">Billing & Usage</h2>
    <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30 rounded-xl p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">{orgData.tier} Plan</h3>
          <p className="text-sm text-slate-400">Contract ends: {orgData.contractEnd}</p>
        </div>
        <button className="px-4 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg text-sm font-medium text-orange-400">Upgrade</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">Channels Used</p>
          <p className="text-2xl font-bold text-white">{billingData.channelsUsed}/{billingData.channelsAllocated}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">Drone Boxes</p>
          <p className="text-2xl font-bold text-white">{billingData.dronesAllocated}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">Monthly Total</p>
          <p className="text-2xl font-bold text-orange-400">€{billingData.monthlyTotal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  </div>
);
