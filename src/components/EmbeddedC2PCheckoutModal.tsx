import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  Link2,
  MapPin,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getEffectiveListingAvailability, useAlirada } from '../context/AliradaContext';
import { db as firebaseDb, isFirebaseConfigured } from '../lib/firebase';
import { computeListingDemandCount } from '../lib/ledgerMath';
import { getEmbeddableVideoUrl, normalizeMediaImageUrl, sanitizeExternalLink } from '../lib/mediaUtils';
import { decodeWidgetPreviewFromSearch } from '../lib/widgetPreview';
import { Order, TransactionRef } from '../types/alirada';
import { UserAvatar } from './UserAvatar';

interface EmbeddedC2PCheckoutModalProps {
  mode?: 'modal' | 'embed';
}

export const EmbeddedC2PCheckoutModal: React.FC<EmbeddedC2PCheckoutModalProps> = ({
  mode = 'modal',
}) => {
  const {
    activeCheckoutRefCode,
    setActiveCheckoutRefCode,
    clearPendingPayRef,
    exitEmbedMode,
    transactionRefs,
    listings,
    projects,
    orders,
    metricsMap,
    systemConfig,
    redeemTransactionRef,
    isLiveFirestore,
    setAuthModalOpen,
    setInspectedUid,
    currentProfile,
    pushToast,
  } = useAlirada();

  const [fetchedRef, setFetchedRef] = useState<TransactionRef | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [mapLink, setMapLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    order?: Order;
    settledPoints: number;
    triggerType?: string;
    triggerPayload?: string;
    message: string;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const isEmbed = mode === 'embed';
  const normalizedCode = (activeCheckoutRefCode || '').trim().toUpperCase();

  const urlPreview = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const decoded = decodeWidgetPreviewFromSearch(window.location.search);
    if (!decoded) return null;
    if (normalizedCode && decoded.ref_code !== normalizedCode) return null;
    return decoded;
  }, [normalizedCode]);

  const refRecord = useMemo(() => {
    if (!normalizedCode) return undefined;
    return (
      transactionRefs.find((r) => r.ref_code.trim().toUpperCase() === normalizedCode) ||
      (fetchedRef && fetchedRef.ref_code.trim().toUpperCase() === normalizedCode
        ? fetchedRef
        : undefined)
    );
  }, [normalizedCode, transactionRefs, fetchedRef]);

  useEffect(() => {
    setCarouselIdx(0);
    setShowVideo(false);
    setQuantity(1);
    setMapLink('');
    setNotes('');
    setReceipt(null);
    setFetchedRef(null);
  }, [normalizedCode]);

  useEffect(() => {
    if (!normalizedCode) return;
    const localFound = transactionRefs.some(
      (r) => r.ref_code.trim().toUpperCase() === normalizedCode
    );
    if (!localFound && isFirebaseConfigured && firebaseDb && isLiveFirestore) {
      setLoadingRef(true);
      getDoc(doc(firebaseDb, 'transaction_refs', normalizedCode))
        .then((snap) => {
          if (snap.exists()) {
            setFetchedRef({ ...(snap.data() as TransactionRef), id: snap.id });
          }
        })
        .catch(() => {
          // ignore lookup permission issue for unauthenticated/missing ref
        })
        .finally(() => setLoadingRef(false));
    }
  }, [normalizedCode, isLiveFirestore]);

  // Notify external iframe host of widget readiness & dynamic height
  useEffect(() => {
    if (!isEmbed || typeof window === 'undefined' || !normalizedCode) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'ALIRADA_C2P_READY', ref_code: normalizedCode, embed: true },
          '*'
        );
      }
    } catch {
      // non-fatal postMessage
    }

    const el = cardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const emitHeight = () => {
      try {
        const height = Math.ceil(el.getBoundingClientRect().height) + 24;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: 'ALIRADA_C2P_HEIGHT', ref_code: normalizedCode, height },
            '*'
          );
        }
      } catch {
        // ignore resize postMessage errors
      }
    };
    emitHeight();
    const ro = new ResizeObserver(emitHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEmbed, normalizedCode, refRecord, receipt, isLiveFirestore, loadingRef, showVideo]);

  if (!activeCheckoutRefCode) return null;

  const closeCheckout = () => {
    if (isEmbed) {
      exitEmbedMode();
      return;
    }
    setActiveCheckoutRefCode(null);
    clearPendingPayRef();
  };

  const normalizedLinkedListingCode = (
    refRecord?.linked_listing_code ||
    urlPreview?.linked_listing_code ||
    ''
  )
    .trim()
    .toUpperCase();

  const linkedListing = normalizedLinkedListingCode
    ? listings.find((l) => l.listing_code.trim().toUpperCase() === normalizedLinkedListingCode)
    : undefined;

  const linkedProject = linkedListing?.linked_project_id
    ? projects.find((p) => p.id === linkedListing.linked_project_id)
    : undefined;

  const images =
    linkedListing && linkedListing.image_urls.length > 0
      ? linkedListing.image_urls
      : urlPreview?.image_url
        ? [urlPreview.image_url]
        : [];
  const currentImg = images[carouselIdx] ? normalizeMediaImageUrl(images[carouselIdx]) : '';
  const videoEmbed = linkedListing
    ? getEmbeddableVideoUrl(linkedListing.video_url)
    : urlPreview?.video_url
      ? getEmbeddableVideoUrl(urlPreview.video_url)
      : '';
  const listingAvailability = linkedListing ? getEffectiveListingAvailability(linkedListing) : 'Active';
  const listingDemand = linkedListing ? computeListingDemandCount(linkedListing.id, orders) : 0;

  // When visitor is unauthenticated in an external website iframe and hasn't signed in yet,
  // allow displaying the safe URL product snapshot while requiring Sign In for live operations.
  const hasPreviewOnly = !refRecord && Boolean(urlPreview);
  const effectiveIssuerUid = refRecord?.issuer_uid || urlPreview?.issuer_uid || '';
  const effectiveTitle =
    linkedListing?.title ||
    refRecord?.widget_name ||
    urlPreview?.widget_name ||
    `Checkout ${normalizedCode}`;
  const effectiveDescription =
    linkedListing?.description || refRecord?.description || urlPreview?.description || '';
  const effectivePaymentModel =
    linkedListing?.payment_model || refRecord?.payment_model || urlPreview?.payment_model || 'One-Time';
  const effectiveTriggerType =
    refRecord?.trigger_type || urlPreview?.trigger_type || 'None';
  const unitPoints = linkedListing
    ? linkedListing.price_points
    : refRecord?.points_amount ?? urlPreview?.points_amount ?? 0;

  const cleanQty = Math.max(1, Math.round(quantity || 1));
  const totalPoints = Number((unitPoints * cleanQty).toFixed(2));

  const isClosed =
    !hasPreviewOnly &&
    (!refRecord ||
      refRecord.status === 'Deactivated' ||
      refRecord.status === 'Cancelled' ||
      Boolean(refRecord.is_deactivated) ||
      (refRecord.ref_type === 'P2P' && refRecord.status !== 'Pending') ||
      (Boolean(linkedListing) && listingAvailability === 'Deactivated'));

  const isSelfIssuer = Boolean(
    effectiveIssuerUid &&
      effectiveIssuerUid === currentProfile.universal_id &&
      currentProfile.universal_id !== 'GUEST'
  );

  const myBalance = metricsMap[currentProfile.universal_id]?.balance ?? 0;
  const projectedBalance = Number((myBalance - totalPoints).toFixed(2));
  const exceedsFloor =
    isLiveFirestore &&
    currentProfile.universal_id !== 'GUEST' &&
    projectedBalance < systemConfig.negative_points_floor;

  const cleanRedirectUrl =
    receipt?.triggerType === 'Redirect URL' && receipt.triggerPayload
      ? sanitizeExternalLink(receipt.triggerPayload)
      : '';

  const standaloneTabUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?pay_ref=${encodeURIComponent(normalizedCode)}`
      : `https://alirada.com/?pay_ref=${encodeURIComponent(normalizedCode)}`;

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refRecord || submitting) return;
    if (!isLiveFirestore) {
      setAuthModalOpen(true);
      pushToast('warning', 'Please sign in with a verified email account to complete this payment.');
      return;
    }
    if (exceedsFloor) {
      pushToast(
        'error',
        `Payment exceeds negative points floor (${systemConfig.negative_points_floor} pts).`
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await redeemTransactionRef(refRecord.ref_code, cleanQty, {
        google_map_link: mapLink,
        notes,
      });
      if (!res.ok) {
        pushToast('error', res.message);
      } else {
        setReceipt({
          order: res.order,
          settledPoints: res.settledPoints ?? totalPoints,
          triggerType: res.triggerExecuted?.type,
          triggerPayload: res.triggerExecuted?.payload,
          message: res.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cardContent = (
    <div
      ref={cardRef}
      className={`bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl w-full ${
        isEmbed ? 'max-w-xl mx-auto shadow-sm' : 'max-w-xl max-h-[92vh] overflow-y-auto'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
            {effectiveTitle}
          </h2>
          <p className="text-xs font-mono-tabular text-stone-500 dark:text-stone-400">
            Ref: {normalizedCode} · {refRecord?.ref_type || 'C2P'} ·{' '}
            {refRecord?.status || (hasPreviewOnly ? 'External Preview' : 'Lookup')}
            {refRecord && refRecord.ref_type === 'C2P'
              ? ` · ${refRecord.payments_count || 0} paid`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isEmbed && (
            <a
              href={standaloneTabUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              title="Open full checkout in new tab"
              aria-label="Open full checkout in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {!isEmbed && (
            <button
              type="button"
              onClick={closeCheckout}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              aria-label="Close checkout modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {loadingRef ? (
          <p className="text-xs text-stone-500 py-8 text-center">
            Loading live payment reference & product details...
          </p>
        ) : !refRecord && !hasPreviewOnly ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-stone-700 dark:text-stone-300">
              {!isLiveFirestore
                ? `Sign in to load live product & checkout details for ${normalizedCode}.`
                : `Reference ${normalizedCode} was not found or is unavailable.`}
            </p>
            {!isLiveFirestore && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Sign In to Load & Pay
                </button>
                {isEmbed && (
                  <a
                    href={standaloneTabUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 inline-flex items-center gap-1.5"
                  >
                    Open Full Checkout <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Full Marketplace Product / Service Card Content */}
            {linkedListing || urlPreview?.linked_listing_code || images.length > 0 || videoEmbed ? (
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50/50 dark:bg-[#0B0D10]">
                {(images.length > 0 || videoEmbed) && (
                  <div className="relative aspect-[16/10] bg-stone-200 dark:bg-[#0B0D10] overflow-hidden">
                    {showVideo && videoEmbed ? (
                      <iframe
                        src={videoEmbed}
                        title={effectiveTitle}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : currentImg ? (
                      <img
                        src={currentImg}
                        alt={effectiveTitle}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-stone-500">
                        {effectiveTitle}
                      </div>
                    )}

                    {!showVideo && images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setCarouselIdx((i) => (i - 1 + images.length) % images.length)
                          }
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          aria-label="Previous listing image"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarouselIdx((i) => (i + 1) % images.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          aria-label="Next listing image"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {videoEmbed && (
                      <button
                        type="button"
                        onClick={() => setShowVideo((v) => !v)}
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/75 text-white text-xs inline-flex items-center gap-1 hover:bg-black"
                      >
                        <Play className="w-3 h-3" />
                        {showVideo ? 'Photos' : 'Video'}
                      </button>
                    )}
                  </div>
                )}

                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <p className="text-stone-500 dark:text-stone-400">
                      {[
                        linkedListing?.listing_type || urlPreview?.listing_type,
                        linkedListing?.category || urlPreview?.category,
                        linkedListing?.listing_code || urlPreview?.linked_listing_code,
                        linkedListing ? `Demand: ${listingDemand}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <span
                      className={
                        listingAvailability === 'Deactivated'
                          ? 'text-rose-700 dark:text-rose-400 font-medium shrink-0'
                          : 'text-emerald-700 dark:text-emerald-400 font-medium shrink-0'
                      }
                    >
                      {listingAvailability}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 leading-snug">
                    {effectiveTitle}
                  </h3>

                  {(linkedProject || urlPreview?.project_name) && (
                    <p className="text-[11px] text-[#B88B1E] dark:text-[#D4AF37] inline-flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Linked Investment Project:{' '}
                      {linkedProject
                        ? `${linkedProject.name} (${linkedProject.project_code})`
                        : urlPreview?.project_name}
                    </p>
                  )}

                  {effectiveDescription && (
                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {effectiveDescription}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                    {linkedListing ? (
                      <UserAvatar universalId={linkedListing.owner_uid} showName showUid />
                    ) : (
                      <span className="notranslate font-mono-tabular text-xs text-stone-600 dark:text-stone-300">
                        Seller UID: {effectiveIssuerUid || 'Verified Member'}
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-lg font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                        {unitPoints} pts
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        {effectivePaymentModel}
                        {linkedListing?.end_date ? ` · Until ${linkedListing.end_date}` : ''}
                      </p>
                    </div>
                  </div>

                  {(linkedListing?.location ||
                    linkedListing?.google_map_link ||
                    urlPreview?.location ||
                    urlPreview?.google_map_link) && (
                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                      <span>{linkedListing?.location || urlPreview?.location}</span>
                      {(linkedListing?.google_map_link || urlPreview?.google_map_link) && (
                        <a
                          href={linkedListing?.google_map_link || urlPreview?.google_map_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#B88B1E] dark:text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" /> Map Location
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0B0D10] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                    {effectiveTitle}
                  </span>
                  <span className="font-mono-tabular font-bold text-base text-[#B88B1E] dark:text-[#D4AF37]">
                    {unitPoints} pts
                  </span>
                </div>
                {effectiveDescription && (
                  <p className="text-stone-600 dark:text-stone-300">{effectiveDescription}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEmbed) closeCheckout();
                      if (effectiveIssuerUid) setInspectedUid(effectiveIssuerUid);
                    }}
                    className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                  >
                    Issuer: {effectiveIssuerUid || 'Platform Issuer'}
                  </button>
                  <span className="text-stone-500">
                    {effectivePaymentModel} · Trigger: {effectiveTriggerType}
                  </span>
                </div>
              </div>
            )}

            {/* API / Integration Notice */}
            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between gap-2 px-1">
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#B88B1E] dark:text-[#D4AF37]" />
                External Trigger:{' '}
                <strong className="text-stone-800 dark:text-stone-200">
                  {effectiveTriggerType}
                </strong>
              </span>
              <span className="font-mono-tabular">Unit: {unitPoints} pts</span>
            </div>

            {receipt ? (
              <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
                      Payment Confirmed · {receipt.settledPoints} pts
                    </p>
                    <p className="text-emerald-800 dark:text-emerald-200">{receipt.message}</p>
                    <p className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                      Updated Account Balance: {myBalance.toFixed(2)} pts
                    </p>
                    {receipt.order && (
                      <p className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                        Linked Order: {receipt.order.order_number} · Recorded under Buyer (
                        {receipt.order.buyer_uid}) & Seller ({receipt.order.seller_uid})
                      </p>
                    )}
                    <p className="text-emerald-700 dark:text-emerald-300">
                      Platform API Event Dispatched:{' '}
                      <span className="font-mono font-semibold">ALIRADA_C2P_PAID</span>
                      {receipt.triggerType && receipt.triggerType !== 'None'
                        ? ` · ${receipt.triggerType}`
                        : ''}
                      {receipt.triggerType === 'Access Grant' && receipt.triggerPayload
                        ? ` · Grant Key: ${receipt.triggerPayload}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {cleanRedirectUrl && (
                    <a
                      href={cleanRedirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-700"
                    >
                      Continue to External Website <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {isEmbed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReceipt(null);
                        setQuantity(1);
                        setNotes('');
                      }}
                      className="px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> New Payment
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeCheckout}
                      className="px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            ) : isClosed ? (
              <div className="p-3.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-800 dark:text-rose-200">
                This payment reference or connected listing is closed/deactivated for new buyers.
                Existing active orders and period obligations remain active until fulfilled.
              </div>
            ) : (
              <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
                {(linkedListing || normalizedLinkedListingCode) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Delivery Map Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={mapLink}
                        onChange={(e) => setMapLink(e.target.value)}
                        placeholder="https://maps.google.com/?q=..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Checkout Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Order delivery instructions or external website reference..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>

                {/* Live Platform Ledger Calculation & Operations Box */}
                {isLiveFirestore && currentProfile.universal_id !== 'GUEST' && (
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                      <span>
                        Buyer:{' '}
                        <strong className="notranslate font-mono-tabular text-stone-800 dark:text-stone-200">
                          {currentProfile.universal_id}
                        </strong>
                      </span>
                      <span className="font-mono-tabular">
                        Floor: {systemConfig.negative_points_floor} pts
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono-tabular">
                      <div>
                        <span className="text-stone-500 block font-sans">Current Balance</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {myBalance.toFixed(2)} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block font-sans">Checkout Debit</span>
                        <span className="font-semibold text-rose-700 dark:text-rose-400">
                          -{totalPoints.toFixed(2)} pts
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-stone-500 block font-sans">After Payment</span>
                        <span
                          className={`font-semibold ${
                            exceedsFloor
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {projectedBalance.toFixed(2)} pts
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 pt-1 border-t border-stone-200 dark:border-stone-800">
                      {linkedListing
                        ? 'Synced Operation: Creates Marketplace Order under Buyer & Seller UIDs, holds seller credit in escrow until delivery, and allocates linked project dividends on completion.'
                        : 'Synced Operation: Records live C2P settlement under Buyer & Issuer UIDs and updates platform ledger balances.'}
                    </p>
                  </div>
                )}

                {exceedsFloor && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Insufficient point headroom: this transaction would cross the{' '}
                    {systemConfig.negative_points_floor} pts negative floor.
                  </div>
                )}

                {!isLiveFirestore ? (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Sign In with Verified Account to Pay {totalPoints} pts
                    </button>
                    {isEmbed && (
                      <a
                        href={standaloneTabUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 inline-flex items-center justify-center gap-1.5"
                      >
                        Or Open Full Checkout in New Tab <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div>
                      <p className="text-[11px] text-stone-500">Matched Checkout Total</p>
                      <p className="text-lg font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                        {totalPoints} pts
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || isSelfIssuer || exceedsFloor || !refRecord}
                      className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 disabled:opacity-40"
                    >
                      {isSelfIssuer
                        ? 'Cannot Pay Own Ref'
                        : submitting
                          ? 'Processing Payment...'
                          : `Confirm & Pay ${totalPoints} pts`}
                    </button>
                  </div>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (isEmbed) {
    return cardContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      {cardContent}
    </div>
  );
};
