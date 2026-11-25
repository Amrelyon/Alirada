import React, { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';

export const ReportDialog: React.FC = () => {
  const { reportModalTarget, setReportModalTarget, submitUserReport } = useAlirada();
  const [reason, setReason] = useState('');

  if (!reportModalTarget) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitUserReport(reportModalTarget.type, reportModalTarget.id, reason);
    if (ok) {
      setReason('');
      setReportModalTarget(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="font-cinzel text-base font-bold text-stone-900 dark:text-stone-100">
              Submit Safety & Audit Report
            </h3>
          </div>
          <button
            onClick={() => setReportModalTarget(null)}
            className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Close report dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          Target: <span className="font-medium text-stone-800 dark:text-stone-200">{reportModalTarget.type}</span> ·{' '}
          <span className="font-mono-tabular">{reportModalTarget.id}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Reason & Evidence Details
            </label>
            <textarea
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this profile image, service log, order, or listing requires administrator review..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportModalTarget(null)}
              className="px-4 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
