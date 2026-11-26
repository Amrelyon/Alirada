import React, { useMemo, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { computeRecognitionIntegrity } from '../lib/ledgerMath';

export const ReportDialog: React.FC = () => {
  const {
    reportModalTarget,
    setReportModalTarget,
    submitUserReport,
    currentProfile,
    profiles,
    listings,
    orders,
    serviceLogs,
    recognitionVotes,
  } = useAlirada();
  const [reason, setReason] = useState('');

  const examined = useMemo(() => {
    if (!reportModalTarget) return { reportedUid: '', snapshot: '' };
    const { type, id } = reportModalTarget;
    if (type === 'User' || type === 'Profile Image') {
      const p = profiles.find((u) => u.universal_id.toUpperCase() === id.toUpperCase());
      return {
        reportedUid: p?.universal_id || id,
        snapshot: p
          ? `${p.universal_id} (${p.full_name}, ${p.entity_type}, Status: ${p.user_status}, Img: ${p.profile_image_url})`
          : `Profile Target: ${id}`,
      };
    }
    if (type === 'Recognition Fraud') {
      const integrity = computeRecognitionIntegrity(id, recognitionVotes);
      const top = integrity.topMatches[0];
      return {
        reportedUid: integrity.targetUid,
        snapshot: `Target ${integrity.targetUid} · Uniqueness: ${integrity.uniquenessPct}% (${integrity.uniqueExclusiveCount}/${integrity.recognizerUids.length} distinct) · Top match: ${
          top
            ? `${top.otherUid} (${top.identicalPct}% identical, shared: ${top.sharedUids.join(', ')})`
            : 'None'
        }`,
      };
    }
    if (type === 'Service Log') {
      const log = serviceLogs.find((l) => l.log_number === id || l.id === id);
      return {
        reportedUid: log?.provider_uid || '',
        snapshot: log
          ? `${log.log_number}: Provider ${log.provider_uid} → Recipient ${log.recipient_uid} · ${log.service_type} (${log.hours}h × H${log.hardship} = +${log.final_score} pts) · Date ${log.logged_date}`
          : `Service Log: ${id}`,
      };
    }
    if (type === 'Listing') {
      const lst = listings.find((l) => l.listing_code === id || l.id === id);
      return {
        reportedUid: lst?.owner_uid || '',
        snapshot: lst
          ? `${lst.listing_code}: "${lst.title}" (${lst.listing_type}, ${lst.price_points} pts ${lst.payment_model}) · Owner ${lst.owner_uid}`
          : `Listing: ${id}`,
      };
    }
    if (type === 'Order') {
      const ord = orders.find((o) => o.order_number === id || o.id === id);
      return {
        reportedUid: ord?.seller_uid || ord?.buyer_uid || '',
        snapshot: ord
          ? `${ord.order_number}: Buyer ${ord.buyer_uid} → Seller ${ord.seller_uid} · ${ord.listing_code} × ${ord.quantity} (${ord.total_points} pts) · ${ord.order_status}/${ord.delivery_status}`
          : `Order: ${id}`,
      };
    }
    return { reportedUid: '', snapshot: `${type}: ${id}` };
  }, [reportModalTarget, profiles, listings, orders, serviceLogs, recognitionVotes]);

  if (!reportModalTarget) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitUserReport(reportModalTarget.type, reportModalTarget.id, reason, {
      reportedUid: examined.reportedUid,
      snapshot: examined.snapshot,
    });
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

        <div className="p-3 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 text-xs space-y-1">
          <p className="text-stone-500 dark:text-stone-400">
            Reporter UID:{' '}
            <span className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              {currentProfile.universal_id}
            </span>{' '}
            · Target:{' '}
            <span className="font-medium text-stone-800 dark:text-stone-200">{reportModalTarget.type}</span>{' '}
            (<span className="font-mono-tabular">{reportModalTarget.id}</span>)
          </p>
          {examined.reportedUid && (
            <p className="text-stone-500 dark:text-stone-400">
              Reported UID:{' '}
              <span className="font-mono-tabular font-semibold text-rose-700 dark:text-rose-400">
                {examined.reportedUid}
              </span>
            </p>
          )}
          <p className="text-stone-700 dark:text-stone-300 pt-1 break-words">
            Examined Info: {examined.snapshot}
          </p>
        </div>

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
              placeholder="Describe why this item requires administrator examination..."
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
