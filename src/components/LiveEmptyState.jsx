// Honest empty state for live mode: this surface is wired to the real
// database and simply has no data yet. Simulated data only exists in
// demo mode (no Supabase keys), never here.
export const LiveEmptyState = ({ icon: Icon, title, description, facts = [], hint }) => (
  <div className="h-full flex items-center justify-center p-6">
    <div className="max-w-md w-full text-center">
      <div className="w-14 h-14 mx-auto mb-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-center">
        <Icon className="w-7 h-7 text-orange-400" />
      </div>
      <h3 className="text-white font-bold text-lg">{title}</h3>
      <p className="text-slate-400 text-sm mt-2">{description}</p>

      {facts.length > 0 && (
        <div className="mt-5 space-y-1.5 text-left">
          {facts.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-xs text-slate-400">{f.label}</span>
              <span className="text-xs font-semibold text-white">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {hint && (
        <p className="text-slate-500 text-xs mt-5 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block flex-shrink-0" />
          {hint}
        </p>
      )}
    </div>
  </div>
);
