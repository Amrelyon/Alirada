import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  Link2,
  MapPin,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getEffectiveListingAvailability, useAlirada } from '../context/AliradaContext';
import { db as firebaseDb, isFirebaseConfigured } from '../lib/firebase';
import { computeListingDemandCount } from '../lib/ledgerMath';
import { getEmbeddableVideoUrl, normalizeMediaImageUrl, sanitizeExternalLink } from '../lib/mediaUtils';
import { Order, TransactionRef } from '../types/alirada';
import { UserAvatar } from './UserAvatar';

export const EmbeddedC2PCheckoutModal: React.FC = () => {
  const {
    activeCheckoutRefCode,
    setActiveCheckoutRefCode,
    clearPendingPayRef,
    transactionRefs,
    listings,
    projects,
    orders,
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

  const normalizedCode = (activeCheckoutRefCode || '').trim().toUpperCase();

  const refRecord = useMemo(() => {
    if (!normalizedCode) return undefined;
    return (
      transactionRefs.find((r) => r.ref_code.toUpperCase() === normalizedCode) ||
      (fetchedRef && fetchedRef.ref_code.toUpperCase() === normalizedCode ? fetchedRef : undefined)
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

    if (!normalizedCode) return;
    const localFound = transactionRefs.some((r) => r.ref_code.toUpperCase() === normalizedCode);
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

  if (!activeCheckoutRefCode) return null;

  const closeCheckout = () => {
    setActiveCheckoutRefCode(null);
    clearPendingPayRef();
  };

  const linkedListing = refRecord?.linked_listing_code
    ? listings.find((l) => l.listing_code === refRecord.linked_listing_code)
    : undefined;
  const linkedProject = linkedListing?.linked_project_id
    ? projects.find((p) => p.id === linkedListing.linked_project_id)
    : undefined;

  const images = linkedListing && linkedListing.image_urls.length > 0 ? linkedListing.image_urls : [];
  const currentImg = images[carouselIdx] ? normalizeMediaImageUrl(images[carouselIdx]) : '';
  const videoEmbed = linkedListing ? getEmbeddableVideoUrl(linkedListing.video_url) : '';
  const listingAvailability = linkedListing ? getEffectiveListingAvailability(linkedListing) : 'Active';
  const listingDemand = linkedListing ? computeListingDemandCount(linkedListing.id, orders) : 0;

  const isClosed =
    !refRecord ||
    refRecord.status === 'Deactivated' ||
    refRecord.status === 'Cancelled' ||
    Boolean(refRecord.is_deactivated) ||
    (refRecord.ref_type === 'P2P' && refRecord.status !== 'Pending') ||
    (Boolean(linkedListing) && listingAvailability === 'Deactivated');

  const isSelfIssuer = Boolean(
    refRecord && refRecord.issuer_uid === currentProfile.universal_id && currentProfile.universal_id !== 'GUEST'
  );

  const unitPoints = linkedListing ? linkedListing.price_points : refRecord?.points_amount || 0;
  const cleanQty = Math.max(1, Math.round(quantity || 1));
  const totalPoints = Number((unitPoints * cleanQty).toFixed(2));
  const cleanRedirectUrl =
    receipt?.triggerType === 'Redirect URL' && receipt.triggerPayload
      ? sanitizeExternalLink(receipt.triggerPayload)
      : '';

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refRecord || submitting) return;
    if (!isLiveFirestore) {
      setAuthModalOpen(true);
      pushToast('warning', 'Please sign in with a verified email account to complete this payment.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-xl w-full max-h-[92vh] overflow-y-auto">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
              {refRecord?.widget_name || linkedListing?.title || `Checkout ${normalizedCode}`}
            </h2>
            <p className="text-xs font-mono-tabular text-stone-500 dark:text-stone-400">
              Ref: {normalizedCode} · {refRecord?.ref_type || 'C2P'} · {refRecord?.status || 'Lookup'}
              {refRecord && refRecord.ref_type === 'C2P' ? ` · ${refRecord.payments_count || 0} paid` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={closeCheckout}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Close checkout modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loadingRef ? (
            <p className="text-xs text-stone-500 py-8 text-center">Loading payment reference details...</p>
          ) : !refRecord ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-stone-700 dark:text-stone-300">
                Reference <span className="font-mono-tabular font-semibold">{normalizedCode}</span> was not found.
              </p>
              {!isLiveFirestore && (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
                >
                  Sign In to Load Live Reference
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Full Marketplace Listing Card Content when connected */}
              {linkedListing ? (
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50/50 dark:bg-[#0B0D10]">
                  <div className="relative aspect-[16/10] bg-stone-200 dark:bg-[#0B0D10] overflow-hidden">
                    {showVideo && videoEmbed ? (
                      <iframe
                        src={videoEmbed}
                        title={linkedListing.title}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : currentImg ? (
                      <img
                        src={currentImg}
                        alt={linkedListing.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-stone-500">
                        {linkedListing.title}
                      </div>
                    )}

                    {!showVideo && images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCarouselIdx((i) => (i - 1 + images.length) % images.length)}
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

                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <p className="text-stone-500 dark:text-stone-400">
                        {linkedListing.listing_type} · {linkedListing.category} · {linkedListing.listing_code} · Demand: {listingDemand}
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
                      {linkedListing.title}
                    </h3>

                    {linkedProject && (
                      <p className="text-[11px] text-[#B88B1E] dark:text-[#D4AF37] inline-flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        Linked Investment Project: {linkedProject.name} ({linkedProject.project_code})
                      </p>
                    )}

                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {linkedListing.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                      <UserAvatar universalId={linkedListing.owner_uid} showName showUid />
                      <div className="text-right">
                        <p className="text-lg font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                          {linkedListing.price_points} pts
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          {linkedListing.payment_model}
                          {linkedListing.end_date ? ` · Until ${linkedListing.end_date}` : ''}
                        </p>
                      </div>
                    </div>

                    {(linkedListing.location || linkedListing.google_map_link) && (
                      <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                        <span>{linkedListing.location}</span>
                        {linkedListing.google_map_link && (
                          <a
                            href={linkedListing.google_map_link}
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
                      {refRecord.widget_name || `${refRecord.ref_type} Payment Request`}
                    </span>
                    <span className="font-mono-tabular font-bold text-base text-[#B88B1E] dark:text-[#D4AF37]">
                      {refRecord.points_amount} pts
                    </span>
                  </div>
                  {refRecord.description && (
                    <p className="text-stone-600 dark:text-stone-300">{refRecord.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => {
                        closeCheckout();
                        setInspectedUid(refRecord.issuer_uid);
                      }}
                      className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                    >
                      Issuer: {refRecord.issuer_uid}
                    </button>
                    <span className="text-stone-500">
                      {refRecord.payment_model} · Trigger: {refRecord.trigger_type}
                    </span>
                  </div>
                </div>
              )}

              {/* API / Integration Notice */}
              <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#B88B1E] dark:text-[#D4AF37]" />
                  Post-Payment Trigger: <strong className="text-stone-800 dark:text-stone-200">{refRecord.trigger_type}</strong>
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
                      {receipt.order && (
                        <p className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                          Linked Order: {receipt.order.order_number} · Recorded under Buyer ({receipt.order.buyer_uid}) & Seller ({receipt.order.seller_uid})
                        </p>
                      )}
                      {receipt.triggerType && receipt.triggerType !== 'None' && (
                        <p className="text-emerald-700 dark:text-emerald-300">
                          Integration Trigger Executed: <span className="font-semibold">{receipt.triggerType}</span> (API postMessage event dispatched)
                          {receipt.triggerType === 'Access Grant' && receipt.triggerPayload
                            ? ` · Grant Key: ${receipt.triggerPayload}`
                            : ''}
                        </p>
                      )}
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
                    <button
                      type="button"
                      onClick={closeCheckout}
                      className="px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : isClosed ? (
                <div className="p-3.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-800 dark:text-rose-200">
                  This payment reference or connected listing is closed/deactivated for new buyers. Existing active orders and period obligations remain active until fulfilled.
                </div>
              ) : (
                <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
                  {linkedListing && (
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

                  {!isLiveFirestore ? (
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Sign In with Verified Email to Pay {totalPoints} pts
                    </button>
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
                        disabled={submitting || isSelfIssuer}
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
    </div>
  );
};
