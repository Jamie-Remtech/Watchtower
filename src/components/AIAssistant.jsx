import {
  CheckCircle, Zap, XCircle
} from 'lucide-react';


// ============================================
// AI ASSISTANT
// ============================================

export const AIAssistant = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-96 bg-slate-900 sm:border sm:border-slate-700 sm:rounded-xl shadow-2xl z-50 flex flex-col sm:max-h-[500px]">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
          <div><h3 className="font-semibold text-white text-sm">Admin Assistant</h3><p className="text-xs text-green-400">Online</p></div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg"><XCircle className="w-5 h-5 text-slate-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-800 p-4 rounded-lg text-sm text-slate-300">
          <p className="mb-3">I can help you manage streams and analyze detections:</p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5" /><span>Stream optimization</span></li>
            <li className="flex items-start gap-2"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5" /><span>Detection analysis</span></li>
            <li className="flex items-start gap-2"><CheckCircle className="w-3 h-3 text-green-400 mt-0.5" /><span>Coverage recommendations</span></li>
          </ul>
        </div>
      </div>
      <div className="p-4 border-t border-slate-700">
        <input type="text" placeholder="Ask about your streams..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500" />
      </div>
    </div>
  );
};
