import React, { useMemo, useState } from 'react';
import { Coins, Copy, Percent, Plus, Save, Send, Trash2 } from 'lucide-react';
import { BatchPayment, BatchRecipient } from '../types/alirada';
import { useAlirada } from '../context/AliradaContext';

export const AdminFeePoolTransferCard: React.FC = () => {
  const {
    systemConfig,
    batchPayments,
    saveBatchPayment,
    sendBatchPayment,
    deleteBatchPayment,
    pushToast,
  } = useAlirada();

  const [editingBatchId, setEditingBatchId] = useState<string | undefined>(undefined);
  const [batchName, setBatchName] = useState('Platform Fee Pool Distribution');
  const [distMode, setDistMode] = useState<'percentage' | 'points'>('percentage');
  const [poolPoints, setPoolPoints] = useState<number>(
    Number(systemConfig.total_micro_fees_collected.toFixed(2)) || 10
  );
  const [recurrence, setRecurrence] = useState<'Once' | 'Weekly' | 'Monthly'>('Once');
  const [notes, setNotes] = useState('');
  const [recipients, setRecipients] = useState<BatchRecipient[]>([
    { uid: 'UID-4', points: 10, percentage: 100, note: 'Mutual aid grant share' },
  ]);

  const savedFeeBatches = useMemo(
    () => batchPayments.filter((b) => b.funding_source === 'PLATFORM_FEES'),
    [batchPayments]
  );

  const totalPct = useMemo(
    () => Number(recipients.reduce((s, r) => s + (Number(r.percentage) || 0), 0).toFixed(2)),
    [recipients]
  );

  const totalComputedPts = useMemo(() => {
    if (distMode === 'percentage') {
      return Number(
        recipients
          .reduce((s, r) => s + ((Number(poolPoints) || 0) * (Number(r.percentage) || 0)) / 100, 0)
          .toFixed(2)
      );
    }
    return Number(recipients.reduce((s, r) => s + (Number(r.points) || 0), 0).toFixed(2));
  }, [distMode, poolPoints, recipients]);

  const splitEquallyPct = () => {
    if (recipients.length === 0) return;
    const base = Math.floor((10000 / recipients.length)) / 100;
    const remainder = Number((100 - base * (recipients.length - 1)).toFixed(2));
    setDistMode('percentage');
    setRecipients((prev) =>
      prev.map((r, idx) => ({
        ...r,
        percentage: idx === 0 ? remainder : base,
      }))
    );
  };

  const buildPayload = () => ({
    id: editingBatchId,
    batch_name: batchName.trim() || 'Platform Fee Pool Transfer',
    recipients: recipients.map((r) => ({
      uid: r.uid.trim().toUpperCase(),
      points:
        distMode === 'percentage'
          ? Number((((Number(poolPoints) || 0) * (Number(r.percentage) || 0)) / 100).toFixed(2))
          : Number((Number(r.points) || 0).toFixed(2)),
      ...(distMode === 'percentage' ? { percentage: Number(r.percentage) || 0 } : {}),
      note: r.note,
    })),
    distribution_mode: distMode,
    pool_points: distMode === 'percentage' ? Number(poolPoints) || 0 : totalComputedPts,
    funding_source: 'PLATFORM_FEES' as const,
    recurrence,
    notes,
  });

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await saveBatchPayment(buildPayload());
    if (saved) {
      setEditingBatchId(undefined);
    }
  };

  const handleSaveAndTransfer = async () => {
    if (totalComputedPts > systemConfig.total_micro_fees_collected + 0.001) {
      pushToast(
        'error',
        `Cannot transfer ${totalComputedPts} pts: collected fee pool has ${systemConfig.total_micro_fees_collected.toFixed(2)} pts.`
      );
      return;
    }
    const saved = await saveBatchPayment(buildPayload());
    if (saved) {
      await sendBatchPayment(saved.id, saved);
      setEditingBatchId(undefined);
    }
  };

  const loadTemplateIntoForm = (b: BatchPayment) => {
    setEditingBatchId(b.obligation_status === 'None' ? b.id : undefined);
    setBatchName(b.batch_name);
    setDistMode(b.distribution_mode || 'points');
    setPoolPoints(b.pool_points || b.recipients.reduce((s, r) => s + r.points, 0));
    setRecurrence(b.recurrence);
    setNotes(b.notes || '');
    setRecipients(
      b.recipients.map((r) => ({
        uid: r.uid,
        points: r.points,
        percentage: r.percentage ?? 0,
        note: r.note || '',
      }))
    );
    pushToast('success', `Loaded fee template "${b.batch_name}" into composer.`);
  };

  return (
    <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <Coins className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
            Collected Platform Fees Batch Transfer
          </h2>
          <p className="text-stone-500 dark:text-stone-400">
            Transfer collected platform micro-fees to a single UID or divide across multiple accounts by percentage or specified points, and save templates for reuse.
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 shrink-0">
          <p className="text-[11px] text-stone-500 dark:text-stone-400">Available Collected Pool</p>
          <p className="text-lg font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
            {systemConfig.total_micro_fees_collected.toFixed(2)} pts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSaveTemplate} className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Batch Transfer Title</label>
              <input
                type="text"
                required
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Distribution Mode</label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-stone-100 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setDistMode('percentage')}
                  className={`py-1.5 px-2 rounded text-xs font-medium inline-flex items-center justify-center gap-1 ${
                    distMode === 'percentage'
                      ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  <Percent className="w-3 h-3" /> By % of Pool
                </button>
                <button
                  type="button"
                  onClick={() => setDistMode('points')}
                  className={`py-1.5 px-2 rounded text-xs font-medium ${
                    distMode === 'points'
                      ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  Specified Pts
                </button>
              </div>
            </div>
          </div>

          {distMode === 'percentage' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end p-3 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800">
              <div>
                <label className="block font-medium mb-1">
                  Added Fee Pool Amount to Divide (pts)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={poolPoints}
                  onChange={(e) => setPoolPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPoolPoints(Number(systemConfig.total_micro_fees_collected.toFixed(2)))
                  }
                  className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Use Full Pool ({systemConfig.total_micro_fees_collected.toFixed(2)} pts)
                </button>
                <button
                  type="button"
                  onClick={splitEquallyPct}
                  className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Split 100% Equally
                </button>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-stone-800 dark:text-stone-200">
                Recipient Account(s) ({recipients.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setRecipients((prev) => [
                    ...prev,
                    { uid: 'UID-2', points: 10, percentage: 0, note: '' },
                  ])
                }
                className="text-[#B88B1E] dark:text-[#D4AF37] inline-flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Account
              </button>
            </div>

            {recipients.map((rec, idx) => {
              const rowPts =
                distMode === 'percentage'
                  ? Number(
                      (((Number(poolPoints) || 0) * (Number(rec.percentage) || 0)) / 100).toFixed(2)
                    )
                  : Number(rec.points) || 0;
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="UID-1"
                    value={rec.uid}
                    onChange={(e) =>
                      setRecipients((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, uid: e.target.value } : r))
                      )
                    }
                    className="col-span-3 px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />

                  {distMode === 'percentage' ? (
                    <div className="col-span-4 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        placeholder="%"
                        value={rec.percentage ?? 0}
                        onChange={(e) =>
                          setRecipients((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, percentage: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-20 px-2 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                      />
                      <span className="font-mono-tabular text-[11px] text-stone-500 whitespace-nowrap">
                        % = {rowPts} pts
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      placeholder="Points"
                      value={rec.points}
                      onChange={(e) =>
                        setRecipients((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, points: Number(e.target.value) } : r
                          )
                        )
                      }
                      className="col-span-4 px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                    />
                  )}

                  <input
                    type="text"
                    placeholder="Note"
                    value={rec.note || ''}
                    onChange={(e) =>
                      setRecipients((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, note: e.target.value } : r))
                      )
                    }
                    className="col-span-4 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />

                  <div className="col-span-1 text-end">
                    {recipients.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setRecipients((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-stone-400 hover:text-rose-600"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as 'Once' | 'Weekly' | 'Monthly')}
              className="px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            >
              <option value="Once">One-Time Template</option>
              <option value="Weekly">Weekly Template</option>
              <option value="Monthly">Monthly Template</option>
            </select>
            <input
              type="text"
              placeholder="Audit / purpose notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />
          </div>

          {/* Summary Validation Line */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono-tabular pt-1">
            <span className="text-stone-600 dark:text-stone-300">
              Total Allocation:{' '}
              <strong className="text-stone-900 dark:text-stone-100">{totalComputedPts} pts</strong>
              {distMode === 'percentage' ? ` (${totalPct}% of ${poolPoints} pts)` : ''}
            </span>
            {totalComputedPts > systemConfig.total_micro_fees_collected + 0.001 && (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                Exceeds available pool ({systemConfig.total_micro_fees_collected.toFixed(2)} pts)
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save for Future Transfer
            </button>
            <button
              type="button"
              onClick={handleSaveAndTransfer}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Save &amp; Transfer Fee Pool Now
            </button>
          </div>
        </form>

        {/* Saved Fee Batches */}
        <div className="lg:col-span-5 space-y-3 border-t lg:border-t-0 lg:border-s border-stone-200 dark:border-stone-800 pt-4 lg:pt-0 lg:ps-5">
          <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
            Saved Fee Distribution Templates ({savedFeeBatches.length})
          </h3>
          {savedFeeBatches.length === 0 ? (
            <p className="text-stone-500">
              No saved Platform Fee Pool templates yet. Save any distribution ratio on the left to reuse it later.
            </p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800/70">
              {savedFeeBatches.map((b) => {
                const sum = b.recipients.reduce((s, r) => s + (Number(r.points) || 0), 0);
                return (
                  <div key={b.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {b.batch_name}
                      </span>
                      <span className="font-mono-tabular text-stone-500">{b.batch_code}</span>
                    </div>
                    <p className="font-mono-tabular text-stone-500 dark:text-stone-400">
                      {b.distribution_mode === 'percentage'
                        ? `% Mode (${b.pool_points || sum} pts pool)`
                        : 'Specified Pts'}{' '}
                      · {sum} pts · {b.recipients.length} account(s) · Sent {b.send_count}×
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => loadTemplateIntoForm(b)}
                        className="px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Load
                      </button>
                      <button
                        type="button"
                        onClick={() => sendBatchPayment(b.id)}
                        className="px-2.5 py-1 rounded bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Transfer
                      </button>
                      {b.obligation_status === 'None' && (
                        <button
                          type="button"
                          onClick={() => deleteBatchPayment(b.id)}
                          className="p-1 text-stone-400 hover:text-rose-600"
                          title="Delete saved fee batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
