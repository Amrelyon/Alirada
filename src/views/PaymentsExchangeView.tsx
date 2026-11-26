import React, { useEffect, useMemo, useState } from 'react';
import { Check, Code2, Copy, ExternalLink, PauseCircle, Plus, Send, Trash2, X } from 'lucide-react';
import { getEffectiveListingAvailability, useAlirada } from '../context/AliradaContext';
import { BatchRecipient, PaymentModel, TransactionRef, TriggerType } from '../types/alirada';
import { UserAvatar } from '../components/UserAvatar';
import { buildUidUnifiedTransactions } from '../lib/ledgerMath';
import { encodeWidgetPreview } from '../lib/widgetPreview';

export const PaymentsExchangeView: React.FC = () => {
  const {
    currentProfile,
    isAdmin,
    profiles,
    metricsMap,
    listings,
    projects,
    serviceLogs,
    deductionLogs,
    orders,
    investments,
    transactionRefs,
    batchPayments,
    pointExchanges,
    issueTransactionRef,
    redeemTransactionRef,
    deactivateTransactionRef,
    deleteTransactionRef,
    saveBatchPayment,
    sendBatchPayment,
    deleteBatchPayment,
    createPointExchange,
    submitExchangeProof,
    releasePointExchange,
    deactivatePointExchange,
    pushToast,
    setInspectedUid,
    setActiveCheckoutRefCode,
    pendingPayRef,
    clearPendingPayRef,
  } = useAlirada();

  const [subTab, setSubTab] = useState<'refs' | 'batches' | 'exchange' | 'transactions'>('refs');

  // C2P / P2P Issue Form
  const [refType, setRefType] = useState<'C2P' | 'P2P'>('C2P');
  const [pointsAmount, setPointsAmount] = useState(listings[0]?.price_points || 50);
  const [paymentModel, setPaymentModel] = useState<PaymentModel>(
    listings[0]?.payment_model || 'One-Time'
  );
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
  const [txLookupUid, setTxLookupUid] = useState(currentProfile.universal_id || 'UID-1');

  useEffect(() => {
    if (currentProfile.universal_id && currentProfile.universal_id !== 'GUEST') {
      setTxLookupUid(currentProfile.universal_id);
    }
  }, [currentProfile.universal_id]);

  useEffect(() => {
    if (pendingPayRef) {
      setSubTab('refs');
      setRedeemCode(pendingPayRef);
      clearPendingPayRef();
    }
  }, [pendingPayRef, clearPendingPayRef]);

  const selectedLinkedListing = listings.find((l) => l.listing_code === linkedListingCode);

  // Keep C2P payment amount & model matched to the selected Marketplace listing
  useEffect(() => {
    if (refType === 'C2P' && selectedLinkedListing) {
      setPointsAmount(selectedLinkedListing.price_points);
      setPaymentModel(selectedLinkedListing.payment_model);
    }
  }, [refType, selectedLinkedListing]);

  const linkedListingDeactivated = Boolean(
    selectedLinkedListing && getEffectiveListingAvailability(selectedLinkedListing) === 'Deactivated'
  );

  const txLookupMetrics = metricsMap[txLookupUid];

  const unifiedTransactions = useMemo(
    () =>
      buildUidUnifiedTransactions(txLookupUid, {
        serviceLogs,
        deductionLogs,
        orders,
        investments,
        transactionRefs,
        batchPayments,
        pointExchanges,
      }),
    [
      txLookupUid,
      serviceLogs,
      deductionLogs,
      orders,
      investments,
      transactionRefs,
      batchPayments,
      pointExchanges,
    ]
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
      points_amount:
        refType === 'C2P' && selectedLinkedListing
          ? selectedLinkedListing.price_points
          : Number(pointsAmount),
      payment_model:
        refType === 'C2P' && selectedLinkedListing
          ? selectedLinkedListing.payment_model
          : paymentModel,
      end_date: endDate || undefined,
      linked_listing_code: refType === 'C2P' && linkedListingCode ? linkedListingCode : undefined,
      widget_name: refType === 'C2P' ? widgetName : undefined,
      description: refDesc,
      trigger_type: triggerType,
      trigger_payload: triggerPayload,
    });
    if (created) setIssuedRef(created);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = redeemCode.trim().toUpperCase();
    const matched = transactionRefs.find((r) => r.ref_code.toUpperCase() === clean);
    if (matched && matched.ref_type === 'C2P') {
      setActiveCheckoutRefCode(matched.ref_code);
      return;
    }
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
    const linked = ref.linked_listing_code
      ? listings.find(
          (l) => l.listing_code.trim().toUpperCase() === ref.linked_listing_code?.trim().toUpperCase()
        )
      : undefined;
    const linkedProj = linked?.linked_project_id
      ? projects.find((p) => p.id === linked.linked_project_id)
      : undefined;
    const wp = encodeWidgetPreview(ref, linked, linkedProj?.name);
    const wpSuffix = wp ? `&wp=${encodeURIComponent(wp)}` : '';
    const directUrl = `${window.location.origin}/?pay_ref=${encodeURIComponent(ref.ref_code)}${wpSuffix}`;
    const prodUrl = `https://alirada.com/?pay_ref=${encodeURIComponent(ref.ref_code)}`;
    const embedUrl = `https://alirada.com/?pay_ref=${encodeURIComponent(ref.ref_code)}&embed=1${wpSuffix}`;
    const localEmbedUrl = `${window.location.origin}/?pay_ref=${encodeURIComponent(ref.ref_code)}&embed=1${wpSuffix}`;
    const iframeId = `alirada-c2p-${ref.ref_code.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
    const html = `<iframe\n  id="${iframeId}"\n  src="${embedUrl}"\n  title="${(linked?.title || ref.widget_name || 'Alirada C2P Checkout').replace(/"/g, '&quot;')}"\n  width="100%"\n  height="680"\n  style="border:0;max-width:560px;border-radius:12px;overflow:hidden"\n  allow="clipboard-write"\n></iframe>\n<script>\nwindow.addEventListener('message', function (e) {\n  if (!e.data || e.data.ref_code !== '${ref.ref_code}') return;\n  if (e.data.type === 'ALIRADA_C2P_HEIGHT' && e.data.height) {\n    var el = document.getElementById('${iframeId}');\n    if (el) el.style.height = e.data.height + 'px';\n  }\n  if (e.data.type === 'ALIRADA_C2P_PAID' || e.data.type === 'ALIRADA_C2P_PAYMENT_CONFIRMED') {\n    console.log('Alirada C2P Paid:', e.data);\n  }\n});\n</script>`;
    return { directUrl, prodUrl, embedUrl, localEmbedUrl, html };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            Payments, Batches & Point Exchange
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Open C2P checkout widgets & API triggers, P2P transfers, batch payouts, escrowed swaps & UID transaction history
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg self-start flex-wrap">
          {(
            [
              ['refs', `C2P / P2P Refs (${transactionRefs.length})`],
              ['batches', `Batches (${batchPayments.length})`],
              ['exchange', `Point Exchange (${pointExchanges.length})`],
              ['transactions', `All Transactions (UID)`],
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
                <label className="block font-medium mb-1">
                  Amount (pts)
                  {refType === 'C2P' && selectedLinkedListing && (
                    <span className="ms-1 text-[11px] text-[#B88B1E] dark:text-[#D4AF37]">
                      · Synced to {selectedLinkedListing.listing_code}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  readOnly={refType === 'C2P' && Boolean(selectedLinkedListing)}
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] read-only:opacity-75"
                />
              </div>
            </div>

            {refType === 'C2P' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Linked Listing (Optional)</label>
                  <select
                    value={linkedListingCode}
                    onChange={(e) => setLinkedListingCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  >
                    <option value="">Standalone C2P (Custom Amount)</option>
                    {listings.map((l) => (
                      <option key={l.listing_code} value={l.listing_code}>
                        {l.listing_code} — {l.title} ({l.price_points} pts)
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
                  disabled={refType === 'C2P' && Boolean(selectedLinkedListing)}
                  onChange={(e) => setPaymentModel(e.target.value as PaymentModel)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] disabled:opacity-75"
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

            {refType === 'C2P' && linkedListingDeactivated && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Note: {linkedListingCode} is currently deactivated. Existing orders must still be fulfilled, but new checkouts are paused until reactivated.
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
            >
              {refType === 'C2P' ? 'Generate Open C2P Reference' : 'Generate P2P Reference'}
            </button>

            {issuedRef && (
              <div className="p-4 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                    {issuedRef.ref_code} ({issuedRef.status})
                  </span>
                  <div className="flex items-center gap-3">
                    {issuedRef.ref_type === 'C2P' && (
                      <button
                        type="button"
                        onClick={() => setActiveCheckoutRefCode(issuedRef.ref_code)}
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Preview Checkout Card
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText('refcode', issuedRef.ref_code)}
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      {copiedId === 'refcode' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Code
                    </button>
                  </div>
                </div>
                {issuedRef.ref_type === 'C2P' && (
                  <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Code2 className="w-3.5 h-3.5" /> External Website Embed Widget & API Snippet
                      </span>
                      <div className="flex items-center gap-3 flex-wrap">
                        <a
                          href={buildWidgetSnippet(issuedRef).localEmbedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Embed View
                        </a>
                        <button
                          type="button"
                          onClick={() => copyText('payurl', buildWidgetSnippet(issuedRef).prodUrl)}
                          className="text-xs text-stone-600 dark:text-stone-300 hover:underline"
                        >
                          Copy alirada.com Link
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText('snippet', buildWidgetSnippet(issuedRef).html)}
                          className="text-xs text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                        >
                          Copy Embed HTML
                        </button>
                      </div>
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
                {transactionRefs.map((ref) => {
                  const isOwnerOrAdmin = ref.issuer_uid === currentProfile.universal_id || isAdmin;
                  const canPay =
                    (ref.status === 'Open' || ref.status === 'Pending') &&
                    ref.issuer_uid !== currentProfile.universal_id;
                  const canDeactivateOrCancel =
                    isOwnerOrAdmin && (ref.status === 'Open' || ref.status === 'Pending');
                  return (
                    <div key={ref.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                          {ref.ref_code} · {ref.ref_type} · {ref.points_amount} pts
                          {ref.linked_listing_code ? ` · ${ref.linked_listing_code}` : ''}
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
                          · Trigger: {ref.trigger_type} · Status:{' '}
                          <span className="font-semibold text-stone-800 dark:text-stone-200">
                            {ref.status}
                          </span>
                          {ref.ref_type === 'C2P' && ` · Paid ${ref.payments_count || 0}×`}
                        </p>
                        {ref.linked_order_id && (
                          <p className="text-[11px] font-mono-tabular text-stone-500">
                            Connected Order ID: {ref.linked_order_id}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {ref.ref_type === 'C2P' && (ref.status === 'Open' || ref.status === 'Pending') && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveCheckoutRefCode(ref.ref_code)}
                              className="px-2.5 py-1 rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-medium inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {canPay ? 'Pay Checkout' : 'Preview Card'}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyText(`embed_${ref.id}`, buildWidgetSnippet(ref).html)}
                              className="px-2 py-1 rounded-md border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1"
                              title="Copy External Website Embed HTML & API Listener"
                            >
                              {copiedId === `embed_${ref.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Code2 className="w-3 h-3" />
                              )}
                              Embed Code
                            </button>
                          </>
                        )}
                        {ref.ref_type === 'P2P' && canPay && (
                          <button
                            type="button"
                            onClick={() => redeemTransactionRef(ref.ref_code)}
                            className="px-2.5 py-1 rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-medium"
                          >
                            Redeem (+{ref.points_amount} pts)
                          </button>
                        )}
                        {canDeactivateOrCancel && (
                          <>
                            <button
                              type="button"
                              onClick={() => deactivateTransactionRef(ref.id, 'Deactivated')}
                              className="px-2 py-1 rounded-md border border-amber-400/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 inline-flex items-center gap-1"
                              title="Deactivate Reference (Active orders remain fulfillable)"
                            >
                              <PauseCircle className="w-3 h-3" /> Deactivate
                            </button>
                            <button
                              type="button"
                              onClick={() => deactivateTransactionRef(ref.id, 'Cancelled')}
                              className="px-2 py-1 rounded-md border border-rose-400/50 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                              title="Cancel Reference"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {isOwnerOrAdmin && ref.obligation_status === 'None' && (
                          <button
                            type="button"
                            onClick={() => deleteTransactionRef(ref.id)}
                            className="p-1 text-stone-400 hover:text-rose-600"
                            title="Delete Reference"
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
                            onClick={() => deactivatePointExchange(exc.id)}
                            className="px-3 py-1.5 rounded-md border border-amber-400/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 inline-flex items-center gap-1 font-medium"
                          >
                            <X className="w-3.5 h-3.5" />
                            Deactivate Exchange
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
                    {exc.status === 'Proof Submitted' && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Active settlement: cash proof submitted ({exc.payment_proof || 'Attached'}). Must be fulfilled by seller.
                      </p>
                    )}
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

      {subTab === 'transactions' && (
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Unified UID Transaction Ledger ({unifiedTransactions.length})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Every service log, deduction, order, C2P/P2P payment, batch payout, exchange, and investment recorded under both issuer and receiver UID.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={txLookupUid}
                onChange={(e) => setTxLookupUid(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              >
                {profiles.map((p) => (
                  <option key={p.universal_id} value={p.universal_id}>
                    {p.universal_id} — {p.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {txLookupMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 text-xs font-mono-tabular">
              <div>
                <span className="block text-[11px] text-stone-500">Carried Balance</span>
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {txLookupMetrics.carried_balance} pts
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-stone-500">Total Earned</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  +{txLookupMetrics.total_earned} pts
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-stone-500">Total Deductions</span>
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  -{txLookupMetrics.total_deductions} pts
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-stone-500">Net Balance</span>
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {txLookupMetrics.balance} pts
                </span>
              </div>
            </div>
          )}

          {unifiedTransactions.length === 0 ? (
            <p className="text-xs text-stone-500 py-8 text-center">
              No transactions recorded yet for {txLookupUid}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                    <th className="py-2 pe-3 font-medium">Date</th>
                    <th className="py-2 pe-3 font-medium">Ref / Code</th>
                    <th className="py-2 pe-3 font-medium">Type</th>
                    <th className="py-2 pe-3 font-medium">UID Role</th>
                    <th className="py-2 pe-3 font-medium">Counterparty</th>
                    <th className="py-2 pe-3 font-medium">Details</th>
                    <th className="py-2 pe-3 font-medium">Status</th>
                    <th className="py-2 text-end font-medium">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                  {unifiedTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 pe-3 font-mono-tabular text-stone-500 whitespace-nowrap">
                        {tx.created_at.slice(0, 10)}
                      </td>
                      <td className="py-2.5 pe-3 font-mono-tabular font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {tx.code}
                      </td>
                      <td className="py-2.5 pe-3 font-medium">{tx.category}</td>
                      <td className="py-2.5 pe-3 text-stone-600 dark:text-stone-300">{tx.role}</td>
                      <td className="py-2.5 pe-3">
                        <button
                          type="button"
                          onClick={() =>
                            tx.counterpartyUid.startsWith('UID-') && setInspectedUid(tx.counterpartyUid)
                          }
                          className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                        >
                          {tx.counterpartyUid}
                        </button>
                      </td>
                      <td className="py-2.5 pe-3 text-stone-600 dark:text-stone-300 max-w-xs truncate">
                        {tx.summary}
                      </td>
                      <td className="py-2.5 pe-3 text-stone-500 whitespace-nowrap">{tx.status}</td>
                      <td
                        className={`py-2.5 text-end font-mono-tabular font-semibold whitespace-nowrap ${
                          tx.direction === '+'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : tx.direction === '-'
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {tx.direction === 'Escrow' ? `${tx.amount} (Escrow)` : `${tx.direction}${tx.amount}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
