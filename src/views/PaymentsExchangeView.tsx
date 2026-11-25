import React, { useEffect, useState } from 'react';
import { Check, Code2, Copy, Plus, Send, Trash2, X } from 'lucide-react';
import { getEffectiveListingAvailability, useAlirada } from '../context/AliradaContext';
import { BatchRecipient, PaymentModel, TransactionRef, TriggerType } from '../types/alirada';
import { UserAvatar } from '../components/UserAvatar';

export const PaymentsExchangeView: React.FC = () => {
  const {
    currentProfile,
    isAdmin,
    listings,
    investments,
    transactionRefs,
    batchPayments,
    pointExchanges,
    issueTransactionRef,
    redeemTransactionRef,
    deleteTransactionRef,
    saveBatchPayment,
    sendBatchPayment,
    deleteBatchPayment,
    createPointExchange,
    submitExchangeProof,
    releasePointExchange,
    cancelPointExchange,
    pushToast,
    setInspectedUid,
    pendingPayRef,
    clearPendingPayRef,
  } = useAlirada();

  const [subTab, setSubTab] = useState<'refs' | 'batches' | 'exchange'>('refs');

  // C2P / P2P Issue Form
  const [refType, setRefType] = useState<'C2P' | 'P2P'>('C2P');
  const [pointsAmount, setPointsAmount] = useState(50);
  const [paymentModel, setPaymentModel] = useState<PaymentModel>('One-Time');
  const [endDate, setEndDate] = useState('');
  const [linkedListingCode, setLinkedListingCode] = useState(listings[0]?.listing_code || '');
  const [widgetName, setWidgetName] = useState('Alirada Direct Checkout');
  const [refDesc, setRefDesc] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('Order Creation');
  const [triggerPayload, setTriggerPayload] = useState('');
  const [issuedRef, setIssuedRef] = useState<TransactionRef | null>(null);

  // Redeem Ref Form
  const [redeemCode, setRedeemCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingPayRef) {
      setSubTab('refs');
      setRedeemCode(pendingPayRef);
      clearPendingPayRef();
    }
  }, [pendingPayRef, clearPendingPayRef]);

  useEffect(() => {
    if (listings.length === 0) {
      if (linkedListingCode) setLinkedListingCode('');
      return;
    }
    if (!listings.some((l) => l.listing_code === linkedListingCode)) {
      setLinkedListingCode(listings[0].listing_code);
    }
  }, [listings, linkedListingCode]);

  const selectedLinkedListing = listings.find((l) => l.listing_code === linkedListingCode);
  const linkedListingInFunding = Boolean(
    selectedLinkedListing && getEffectiveListingAvailability(selectedLinkedListing, investments) === 'Funding'
  );

  // Batch Payments Form
  const [batchName, setBatchName] = useState('');
  const [batchRecurrence, setBatchRecurrence] = useState<'Once' | 'Weekly' | 'Monthly'>('Monthly');
  const [batchSchedule, setBatchSchedule] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [recipients, setRecipients] = useState<BatchRecipient[]>([
    { uid: 'UID-2', points: 25, note: 'Field support' },
  ]);

  // Point Exchange Form
  const [excPoints, setExcPoints] = useState(100);
  const [excCash, setExcCash] = useState(125);
  const [excCurrency, setExcCurrency] = useState('USD');
  const [excNotes, setExcNotes] = useState('');
  const [proofInputMap, setProofInputMap] = useState<Record<string, string>>({});

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    pushToast('success', 'Copied to clipboard.');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleIssueRef = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await issueTransactionRef({
      ref_type: refType,
      points_amount: Number(pointsAmount),
      payment_model: paymentModel,
      end_date: endDate || undefined,
      linked_listing_code: refType === 'C2P' ? linkedListingCode : undefined,
      widget_name: refType === 'C2P' ? widgetName : undefined,
      description: refDesc,
      trigger_type: triggerType,
      trigger_payload: triggerPayload,
    });
    if (created) setIssuedRef(created);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await redeemTransactionRef(redeemCode);
    if (!res.ok) {
      pushToast('error', res.message);
    } else {
      setRedeemCode('');
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRecs = recipients.filter((r) => r.uid.trim() && r.points > 0);
    if (cleanRecs.length === 0) return;
    const ok = await saveBatchPayment({
      batch_name: batchName,
      recipients: cleanRecs,
      scheduled_time: batchSchedule || undefined,
      recurrence: batchRecurrence,
      notes: batchNotes,
    });
    if (ok) {
      setBatchName('');
      setBatchNotes('');
    }
  };

  const handleCreateExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await createPointExchange(Number(excPoints), Number(excCash), excCurrency, excNotes);
    if (ok) setExcNotes('');
  };

  const buildWidgetSnippet = (ref: TransactionRef) => {
    const directUrl = `${window.location.origin}/?pay_ref=${encodeURIComponent(ref.ref_code)}`;
    const html = `<div style="border:1px solid #d4af37;padding:16px;border-radius:10px;max-width:340px;font-family:sans-serif">\n  <strong>${ref.widget_name || 'Alirada C2P Checkout'}</strong>\n  <p style="margin:6px 0;font-size:13px">${ref.points_amount} pts (${ref.payment_model}) · Ref ${ref.ref_code}</p>\n  <a href="${directUrl}" style="display:inline-block;padding:8px 14px;background:#b88b1e;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Pay with Alirada</a>\n</div>`;
    return { directUrl, html };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            Payments, Batches & Point Exchange
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            C2P checkout widgets with triggers, P2P transfers, scheduled batch payouts, & escrowed point swaps
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg self-start">
          {(
            [
              ['refs', `C2P / P2P Refs (${transactionRefs.length})`],
              ['batches', `Batches (${batchPayments.length})`],
              ['exchange', `Point Exchange (${pointExchanges.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSubTab(k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === k
                  ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'refs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Issue C2P / P2P Form */}
          <form
            onSubmit={handleIssueRef}
            className="lg:col-span-6 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Issue P2P / C2P Payment Reference
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Reference Type</label>
                <select
                  value={refType}
                  onChange={(e) => setRefType(e.target.value as 'C2P' | 'P2P')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="C2P">C2P (Customer-to-Platform / Widget)</option>
                  <option value="P2P">P2P (Peer-to-Peer Transfer)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Amount (pts)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
            </div>

            {refType === 'C2P' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Linked Listing</label>
                  <select
                    value={linkedListingCode}
                    onChange={(e) => setLinkedListingCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  >
                    {listings.map((l) => (
                      <option key={l.listing_code} value={l.listing_code}>
                        {l.listing_code} — {l.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Widget Title</label>
                  <input
                    type="text"
                    value={widgetName}
                    onChange={(e) => setWidgetName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Payment Model</label>
                <select
                  value={paymentModel}
                  onChange={(e) => setPaymentModel(e.target.value as PaymentModel)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="One-Time">One-Time</option>
                  <option value="Monthly Installment">Monthly Installment</option>
                  <option value="Monthly Subscription">Monthly Subscription</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Post-Payment Trigger</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="None">None</option>
                  <option value="Redirect URL">Redirect URL</option>
                  <option value="Webhook/Notification">Webhook/Notification</option>
                  <option value="Access Grant">Access Grant</option>
                  <option value="Order Creation">Order Creation</option>
                  <option value="Manual Verification Request">Manual Verification Request</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Trigger Payload / URL</label>
                <input
                  type="text"
                  value={triggerPayload}
                  onChange={(e) => setTriggerPayload(e.target.value)}
                  placeholder="https://... or Course ID"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
            </div>

            <input
              type="text"
              value={refDesc}
              onChange={(e) => setRefDesc(e.target.value)}
              placeholder="Reference description..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />

            {refType === 'C2P' && triggerType === 'Order Creation' && linkedListingInFunding && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Note: {linkedListingCode} is currently in its Investment Funding phase. Buyers cannot redeem this Order Creation reference until the listing is funded or activated.
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
            >
              Generate {refType} Reference
            </button>

            {issuedRef && (
              <div className="p-4 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                    {issuedRef.ref_code}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText('refcode', issuedRef.ref_code)}
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {copiedId === 'refcode' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Code
                  </button>
                </div>
                {issuedRef.ref_type === 'C2P' && (
                  <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Code2 className="w-3.5 h-3.5" /> Embeddable Widget Snippet
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText('snippet', buildWidgetSnippet(issuedRef).html)}
                        className="text-xs text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                      >
                        Copy HTML
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono-tabular p-2 rounded bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 overflow-x-auto">
                      {buildWidgetSnippet(issuedRef).html}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Redeem + Reference Ledger */}
          <div className="lg:col-span-6 space-y-6">
            <form
              onSubmit={handleRedeem}
              className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-3"
            >
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Redeem / Pay Reference Code
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Enter a P2P or C2P code issued by another member (self-redemption is blocked).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="C2P-SOLAR-8841 or P2P-GIFT-3310"
                  className="flex-1 px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 whitespace-nowrap"
                >
                  Confirm & Settle
                </button>
              </div>
            </form>

            <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Reference Registry
              </h2>
              <div className="divide-y divide-stone-100 dark:divide-stone-800/70 max-h-96 overflow-y-auto">
                {transactionRefs.map((ref) => (
                  <div key={ref.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                        {ref.ref_code} · {ref.ref_type} · {ref.points_amount} pts
                      </p>
                      <p className="text-stone-500 dark:text-stone-400">
                        Issuer:{' '}
                        <button
                          type="button"
                          onClick={() => setInspectedUid(ref.issuer_uid)}
                          className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                          title="View Issuer UID Profile"
                        >
                          {ref.issuer_uid}
                        </button>{' '}
                        · Trigger: {ref.trigger_type} · {ref.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ref.status === 'Pending' && ref.issuer_uid !== currentProfile.universal_id && (
                        <button
                          type="button"
                          onClick={() => redeemTransactionRef(ref.ref_code)}
                          className="px-2.5 py-1 rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-medium"
                        >
                          Pay
                        </button>
                      )}
                      {(ref.issuer_uid === currentProfile.universal_id || isAdmin) &&
                        ref.obligation_status === 'None' && (
                          <button
                            type="button"
                            onClick={() => deleteTransactionRef(ref.id)}
                            className="p-1 text-stone-400 hover:text-rose-600"
                            title="Delete Pending Reference"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'batches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveBatch}
            className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Create & Schedule Batch Payment
            </h2>
            <input
              type="text"
              required
              placeholder="Batch Name (e.g. Monthly Workshop Stipend)"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={batchRecurrence}
                onChange={(e) => setBatchRecurrence(e.target.value as 'Once' | 'Weekly' | 'Monthly')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              >
                <option value="Once">Once</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
              <input
                type="datetime-local"
                value={batchSchedule}
                onChange={(e) => setBatchSchedule(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Recipients ({recipients.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    setRecipients((prev) => [...prev, { uid: 'UID-4', points: 15, note: '' }])
                  }
                  className="text-[#B88B1E] dark:text-[#D4AF37] inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>
              {recipients.map((rec, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="UID-2"
                    value={rec.uid}
                    onChange={(e) =>
                      setRecipients((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, uid: e.target.value } : r))
                      )
                    }
                    className="col-span-4 px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={rec.points}
                    onChange={(e) =>
                      setRecipients((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, points: Number(e.target.value) } : r))
                      )
                    }
                    className="col-span-3 px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                  <input
                    type="text"
                    placeholder="Note"
                    value={rec.note || ''}
                    onChange={(e) =>
                      setRecipients((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, note: e.target.value } : r))
                      )
                    }
                    className="col-span-5 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="Batch notes..."
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />

            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
            >
              Save Batch Schedule
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Saved & Disbursed Batches
            </h2>
            <div className="divide-y divide-stone-100 dark:divide-stone-800/70">
              {batchPayments.map((b) => {
                const sum = b.recipients.reduce((acc, r) => acc + r.points, 0);
                return (
                  <div key={b.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                        {b.batch_name}{' '}
                        <span className="font-mono-tabular text-xs font-normal text-stone-500">
                          ({b.batch_code})
                        </span>
                      </p>
                      <p className="text-stone-500 dark:text-stone-400 font-mono-tabular">
                        {b.recipients.length} recipients · {sum} pts/run · {b.recurrence} · Sent {b.send_count}×
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => sendBatchPayment(b.id)}
                        className="px-3 py-1.5 rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold inline-flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {b.send_count > 0 ? 'Re-Send Batch' : 'Send Now'}
                      </button>
                      {b.obligation_status === 'None' && (
                        <button
                          type="button"
                          onClick={() => deleteBatchPayment(b.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'exchange' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateExchange}
            className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Lock Points in Escrow for Currency Swap
            </h2>
            <p className="text-stone-500 dark:text-stone-400">
              Escrow locks your offered points while internal marketplace point prices remain unchanged.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium mb-1">Points</label>
                <input
                  type="number"
                  min={5}
                  required
                  value={excPoints}
                  onChange={(e) => setExcPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Cash Amount</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={excCash}
                  onChange={(e) => setExcCash(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Currency</label>
                <select
                  value={excCurrency}
                  onChange={(e) => setExcCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JOD">JOD</option>
                </select>
              </div>
            </div>
            <input
              type="text"
              placeholder="Settlement method notes (SEPA, Wise, Local Bank)..."
              value={excNotes}
              onChange={(e) => setExcNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
            >
              Lock Escrow Listing
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Active Point Exchange Board
            </h2>
            <div className="divide-y divide-stone-100 dark:divide-stone-800/70">
              {pointExchanges.map((exc) => {
                const isSeller = exc.seller_uid === currentProfile.universal_id;
                return (
                  <div key={exc.id} className="py-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar universalId={exc.seller_uid} showUid />
                        <div>
                          <p className="font-mono-tabular font-semibold text-sm text-stone-900 dark:text-stone-100">
                            {exc.points_requested} pts ↔ {exc.cash_amount} {exc.currency}
                          </p>
                          <p className="text-stone-500">
                            {exc.exchange_code} · Status: {exc.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(isSeller || isAdmin) && exc.status === 'Escrow Locked' && (
                          <button
                            type="button"
                            onClick={() => cancelPointExchange(exc.id)}
                            className="px-3 py-1.5 rounded-md border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 font-medium"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel Escrow
                          </button>
                        )}
                        {isSeller && exc.status === 'Proof Submitted' && (
                          <button
                            type="button"
                            onClick={() => releasePointExchange(exc.id)}
                            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold"
                          >
                            Release Points
                          </button>
                        )}
                      </div>
                    </div>
                    {!isSeller && exc.status === 'Escrow Locked' && (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={proofInputMap[exc.id] || ''}
                          onChange={(e) =>
                            setProofInputMap((prev) => ({ ...prev, [exc.id]: e.target.value }))
                          }
                          placeholder="Paste wire/payment proof reference URL..."
                          className="flex-1 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                        />
                        <button
                          type="button"
                          onClick={() => submitExchangeProof(exc.id, proofInputMap[exc.id] || 'Bank Transfer Verified')}
                          className="px-3 py-1.5 rounded bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold"
                        >
                          Submit Cash Proof
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
