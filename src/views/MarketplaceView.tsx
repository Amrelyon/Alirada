import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Flag, MapPin, Play, Plus, Search, Trash2, TrendingUp, X } from 'lucide-react';
import { getEffectiveListingAvailability, useAlirada } from '../context/AliradaContext';
import { computeListingDemandCount } from '../lib/ledgerMath';
import { getEmbeddableVideoUrl, normalizeMediaImageUrl } from '../lib/mediaUtils';
import { Listing, Order, PaymentModel } from '../types/alirada';
import { UserAvatar } from '../components/UserAvatar';

export const MarketplaceView: React.FC = () => {
  const {
    isLiveFirestore,
    currentProfile,
    isAdmin,
    metricsMap,
    listings,
    orders,
    investments,
    systemConfig,
    setAuthModalOpen,
    pushToast,
    createListing,
    deleteListing,
    activateListingForOrders,
    placeOrder,
    confirmOrderDelivery,
    investInListing,
    setInspectedUid,
    setReportModalTarget,
  } = useAlirada();

  const [subTab, setSubTab] = useState<'browse' | 'orders' | 'investments'>('browse');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Product' | 'Service' | 'Course'>('All');
  const [carouselIdx, setCarouselIdx] = useState<Record<string, number>>({});

  // Modals & Submit Locks
  const [createOpen, setCreateOpen] = useState(false);
  const [orderModalListing, setOrderModalListing] = useState<Listing | null>(null);
  const [investModalListing, setInvestModalListing] = useState<Listing | null>(null);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<Order | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submittingInvest, setSubmittingInvest] = useState(false);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [activatingListingId, setActivatingListingId] = useState<string | null>(null);

  // Create Listing Form
  const [newType, setNewType] = useState<'Product' | 'Service' | 'Course'>('Product');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(systemConfig.custom_categories[0] || 'Crafts & Production');
  const [newDescription, setNewDescription] = useState('');
  const [newHours, setNewHours] = useState(6);
  const [newHardship, setNewHardship] = useState(5);
  const [newPaymentModel, setNewPaymentModel] = useState<PaymentModel>('One-Time');
  const [newEndDate, setNewEndDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newMapLink, setNewMapLink] = useState('');
  const [newImagesRaw, setNewImagesRaw] = useState('/src/assets/images/listing_artisan_craft_1795619022780.jpg');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newGoalPts, setNewGoalPts] = useState(500);
  const [requireFundingFirst, setRequireFundingFirst] = useState(true);
  const [newBudgetUrl, setNewBudgetUrl] = useState('');
  const [newDeckUrl, setNewDeckUrl] = useState('');

  // Order Confirmation Form
  const [orderQty, setOrderQty] = useState(1);
  const [orderMap, setOrderMap] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Investment Form
  const [investAmount, setInvestAmount] = useState(100);

  // Delivery Confirmation Form
  const [delStatus, setDelStatus] = useState<'Delivered' | 'Partially Delivered' | 'Rejected'>('Delivered');
  const [delEvidence, setDelEvidence] = useState('');
  const [delNotes, setDelNotes] = useState('');
  const [delRejectionReason, setDelRejectionReason] = useState('');

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (typeFilter !== 'All' && l.listing_type !== typeFilter) return false;
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.listing_code.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    });
  }, [listings, search, typeFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingCreate) return;
    setSubmittingCreate(true);
    try {
      const imgs = newImagesRaw
        .split(',')
        .map((s) => normalizeMediaImageUrl(s.trim()))
        .filter(Boolean);
      const ok = await createListing({
        listing_type: newType,
        title: newTitle,
        category: newCategory,
        description: newDescription,
        location: newLocation,
        google_map_link: newMapLink,
        image_urls: imgs.length > 0 ? imgs : ['/src/assets/images/listing_solar_kit_1795619023780.jpg'],
        video_url: newVideoUrl,
        price_points: Number((newHours * newHardship).toFixed(2)),
        payment_model: newPaymentModel,
        end_date: newEndDate || undefined,
        investment_goal_points: newGoalPts > 0 ? newGoalPts : undefined,
        availability_status: newGoalPts > 0 && requireFundingFirst ? 'Funding' : 'Active',
        budget_doc_url: newBudgetUrl,
        presentation_url: newDeckUrl,
      });
      if (ok) {
        setCreateOpen(false);
        setNewTitle('');
        setNewDescription('');
      }
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderModalListing || submittingOrder) return;
    setSubmittingOrder(true);
    try {
      const ok = await placeOrder({
        listing: orderModalListing,
        quantity: orderQty,
        google_map_link: orderMap,
        notes: orderNotes,
      });
      if (ok) {
        setOrderModalListing(null);
        setOrderQty(1);
        setOrderNotes('');
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleInvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investModalListing || submittingInvest) return;
    setSubmittingInvest(true);
    try {
      const ok = await investInListing(investModalListing, Number(investAmount));
      if (ok) {
        setInvestModalListing(null);
      }
    } finally {
      setSubmittingInvest(false);
    }
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalOrder || submittingDelivery) return;
    setSubmittingDelivery(true);
    try {
      const ok = await confirmOrderDelivery({
        order: deliveryModalOrder,
        status: delStatus,
        evidence: delEvidence,
        notes: delNotes,
        rejection_reason: delRejectionReason,
      });
      if (ok) {
        setDeliveryModalOrder(null);
        setDelNotes('');
        setDelRejectionReason('');
        setDelEvidence('');
      }
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const stepCarousel = (listingId: string, total: number, delta: number) => {
    setCarouselIdx((prev) => {
      const cur = prev[listingId] || 0;
      return { ...prev, [listingId]: (cur + delta + total) % total };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            Marketplace & Crowdfunding
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Point prices anchored to Production Hours × Hardship · Proportional dividends settle on delivery
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg">
            {(
              [
                ['browse', 'Browse Listings'],
                ['orders', `Orders & Delivery (${orders.length})`],
                ['investments', `Investments (${investments.length})`],
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

          <button
            type="button"
            onClick={() => {
              if (!isLiveFirestore) {
                setAuthModalOpen(true);
                pushToast('warning', 'Please sign in with a verified email account to publish a listing.');
                return;
              }
              setCreateOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Publish Listing
          </button>
        </div>
      </div>

      {subTab === 'browse' && (
        <>
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute start-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, services, courses, codes..."
                className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B] text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg self-start">
              {(['All', 'Product', 'Service', 'Course'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Listing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredListings.map((item) => {
              const images = item.image_urls.length > 0 ? item.image_urls : [];
              const idx = carouselIdx[item.id] || 0;
              const currentImg = images[idx] ? normalizeMediaImageUrl(images[idx]) : '';
              const demand = computeListingDemandCount(item.id, orders);
              const totalInvested = investments
                .filter((i) => i.listing_id === item.id && i.status === 'Active')
                .reduce((acc, i) => acc + i.invested_points, 0);
              const goal = item.investment_goal_points || 0;
              const progressPct = goal > 0 ? Math.min(100, Math.round((totalInvested / goal) * 100)) : 0;
              const effectiveAvailability = getEffectiveListingAvailability(item, investments);
              const isFundingPhase = effectiveAvailability === 'Funding';
              const isOwn = item.owner_uid === currentProfile.universal_id;
              const videoEmbed = getEmbeddableVideoUrl(item.video_url);

              return (
                <article
                  key={item.id}
                  className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Image Carousel */}
                    <div className="relative aspect-[4/3] bg-stone-200 dark:bg-[#0B0D10] overflow-hidden">
                      {currentImg ? (
                        <img
                          src={currentImg}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-stone-500">
                          {item.title}
                        </div>
                      )}

                      {images.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => stepCarousel(item.id, images.length, -1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => stepCarousel(item.id, images.length, 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                            aria-label="Next image"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {videoEmbed && (
                        <button
                          type="button"
                          onClick={() => setVideoModalUrl(videoEmbed)}
                          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/75 text-white text-xs inline-flex items-center gap-1 hover:bg-black"
                        >
                          <Play className="w-3 h-3" /> Video
                        </button>
                      )}
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <p className="text-stone-500 dark:text-stone-400">
                          {item.listing_type} · {item.category} · {item.listing_code} · Demand: {demand}
                        </p>
                        <span
                          className={
                            isFundingPhase
                              ? 'text-amber-700 dark:text-amber-400 font-medium shrink-0'
                              : 'text-emerald-700 dark:text-emerald-400 font-medium shrink-0'
                          }
                        >
                          {isFundingPhase ? 'Funding Phase' : 'Active'}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <UserAvatar universalId={item.owner_uid} showName showUid />
                        <div className="text-right">
                          <p className="text-lg font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                            {item.price_points} pts
                          </p>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400">
                            {item.payment_model}
                            {item.end_date ? ` · Until ${item.end_date}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Crowdfunding Progress */}
                      {goal > 0 && (
                        <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500 dark:text-stone-400">Crowdfund Progress</span>
                            <span className="font-mono-tabular text-stone-900 dark:text-stone-100">
                              {totalInvested} / {goal} pts ({progressPct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                            <div
                              className="h-full bg-[#B88B1E] dark:bg-[#D4AF37]"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          {(item.budget_doc_url || item.presentation_url) && (
                            <div className="flex items-center gap-3 text-[11px] text-[#B88B1E] dark:text-[#D4AF37]">
                              {item.budget_doc_url && (
                                <a href={item.budget_doc_url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                                  Budget <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {item.presentation_url && (
                                <a href={item.presentation_url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                                  Deck <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Bar */}
                  <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.google_map_link && (
                        <a
                          href={item.google_map_link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                          title="Open Location on Google Maps"
                        >
                          <MapPin className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setReportModalTarget({ type: 'Listing', id: item.listing_code })}
                        className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Report Listing"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                      {(isOwn || isAdmin) && item.obligation_status === 'None' && (
                        <button
                          type="button"
                          onClick={() => deleteListing(item.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Delete Listing (No Obligations)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {goal > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isLiveFirestore) {
                              setAuthModalOpen(true);
                              pushToast('warning', 'Please sign in with a verified email account to invest.');
                              return;
                            }
                            const remaining = Math.max(1, goal - totalInvested);
                            setInvestAmount(Math.min(100, remaining));
                            setInvestModalListing(item);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap ${
                            isFundingPhase
                              ? 'bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90'
                              : 'border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                          }`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          Invest
                        </button>
                      )}
                      {isFundingPhase && (isOwn || isAdmin) && (
                        <button
                          type="button"
                          disabled={activatingListingId === item.id}
                          onClick={async () => {
                            setActivatingListingId(item.id);
                            try {
                              await activateListingForOrders(item.id);
                            } finally {
                              setActivatingListingId(null);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap"
                          title="Activate product/service for customer orders now"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {activatingListingId === item.id ? 'Activating...' : 'Activate Orders'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isOwn || isFundingPhase}
                        onClick={() => {
                          if (!isLiveFirestore) {
                            setAuthModalOpen(true);
                            pushToast('warning', 'Please sign in with a verified email account to place an order.');
                            return;
                          }
                          setOrderQty(1);
                          setOrderMap('');
                          setOrderNotes('');
                          setOrderModalListing(item);
                        }}
                        title={
                          isFundingPhase
                            ? 'Investment goal must be funded or activated before customer orders open'
                            : undefined
                        }
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap ${
                          isFundingPhase
                            ? 'border border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400'
                            : 'bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90'
                        }`}
                      >
                        {isOwn ? 'Your Listing' : isFundingPhase ? 'Funding First' : 'Order'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {subTab === 'orders' && (
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Orders & Delivery Settlement
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 pr-3 font-medium">Order #</th>
                  <th className="py-2 pr-3 font-medium">Listing</th>
                  <th className="py-2 pr-3 font-medium">Buyer</th>
                  <th className="py-2 pr-3 font-medium">Seller</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Delivery Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                {orders.map((ord) => {
                  const canConfirmDelivery =
                    ord.buyer_uid === currentProfile.universal_id &&
                    ord.delivery_status === 'Awaiting';
                  return (
                    <tr key={ord.id}>
                      <td className="py-3 pr-3 font-mono-tabular">
                        <span className="block text-stone-900 dark:text-stone-100">{ord.order_number}</span>
                        <span className="text-[11px] text-stone-500">{ord.order_date}</span>
                      </td>
                      <td className="py-3 pr-3 font-mono-tabular">
                        {ord.listing_code} × {ord.quantity} ({ord.payment_model})
                      </td>
                      <td className="py-3 pr-3">
                        <UserAvatar universalId={ord.buyer_uid} showUid />
                      </td>
                      <td className="py-3 pr-3">
                        <UserAvatar universalId={ord.seller_uid} showUid />
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tabular font-semibold">
                        {ord.total_points} pts
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={
                            ord.delivery_status === 'Delivered'
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : ord.delivery_status === 'Rejected'
                                ? 'text-rose-700 dark:text-rose-400 font-medium'
                                : 'text-amber-700 dark:text-amber-400 font-medium'
                          }
                        >
                          {ord.delivery_status}
                        </span>
                        {ord.rejection_reason && (
                          <p className="text-[11px] text-stone-500">{ord.rejection_reason}</p>
                        )}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        {canConfirmDelivery && (
                          <button
                            type="button"
                            onClick={() => setDeliveryModalOrder(ord)}
                            className="px-3 py-1 text-xs font-medium rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
                          >
                            Confirm / Reject
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReportModalTarget({ type: 'Order', id: ord.order_number })}
                          className="p-1 text-stone-400 hover:text-rose-600"
                          title="Report Order"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'investments' && (
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Crowdfunding Investments & Dividends
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Investor</th>
                  <th className="py-2 pr-3 font-medium">Listing</th>
                  <th className="py-2 pr-3 text-right font-medium">Invested</th>
                  <th className="py-2 pr-3 text-right font-medium">Share %</th>
                  <th className="py-2 pr-3 text-right font-medium">Dividends Earned</th>
                  <th className="py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                {investments.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 pr-3 font-mono-tabular">{inv.investment_code}</td>
                    <td className="py-3 pr-3">
                      <UserAvatar universalId={inv.investor_uid} showUid />
                    </td>
                    <td className="py-3 pr-3 font-mono-tabular">{inv.listing_code}</td>
                    <td className="py-3 pr-3 text-right font-mono-tabular">{inv.invested_points} pts</td>
                    <td className="py-3 pr-3 text-right font-mono-tabular">{inv.share_percentage}%</td>
                    <td className="py-3 pr-3 text-right font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                      +{inv.dividends_earned} pts
                    </td>
                    <td className="py-3 text-right">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Listing Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
                Publish Marketplace Listing
              </h3>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'Product' | 'Service' | 'Course')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  >
                    <option value="Product">Product</option>
                    <option value="Service">Service</option>
                    <option value="Course">Course</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Prod. Hours</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={newHours}
                    onChange={(e) => setNewHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Hardship (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newHardship}
                    onChange={(e) => setNewHardship(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Point Price</label>
                  <div className="px-3 py-2 text-sm font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                    {newHours * newHardship} pts
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Payment Model</label>
                  <select
                    value={newPaymentModel}
                    onChange={(e) => setNewPaymentModel(e.target.value as PaymentModel)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  >
                    <option value="One-Time">One-Time</option>
                    <option value="Monthly Installment">Monthly Installment</option>
                    <option value="Monthly Subscription">Monthly Subscription</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Google Map Link</label>
                  <input
                    type="url"
                    value={newMapLink}
                    onChange={(e) => setNewMapLink(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Image URLs (comma-separated, Imgur/Drive supported)
                </label>
                <input
                  type="text"
                  value={newImagesRaw}
                  onChange={(e) => setNewImagesRaw(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Video URL</label>
                  <input
                    type="url"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Invest Goal (pts)</label>
                  <input
                    type="number"
                    min={0}
                    value={newGoalPts}
                    onChange={(e) => setNewGoalPts(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Budget Doc URL</label>
                  <input
                    type="url"
                    value={newBudgetUrl}
                    onChange={(e) => setNewBudgetUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-600 dark:text-stone-300 mb-1">Presentation URL</label>
                <input
                  type="url"
                  value={newDeckUrl}
                  onChange={(e) => setNewDeckUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              {newGoalPts > 0 && (
                <label className="flex items-center gap-2 pt-1 text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireFundingFirst}
                    onChange={(e) => setRequireFundingFirst(e.target.checked)}
                  />
                  <span>
                    Start in Investment Phase (orders remain locked until goal is funded or owner activates)
                  </span>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-4 py-2 rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold disabled:opacity-50"
                >
                  {submittingCreate ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {orderModalListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
                Confirm Order
              </h3>
              <button onClick={() => setOrderModalListing(null)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs space-y-1 text-stone-600 dark:text-stone-300">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{orderModalListing.title}</p>
              <p>
                Seller:{' '}
                <button
                  type="button"
                  onClick={() => {
                    const sellerUid = orderModalListing.owner_uid;
                    setOrderModalListing(null);
                    setInspectedUid(sellerUid);
                  }}
                  className="notranslate font-mono-tabular font-medium text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                  title="View Seller UID Profile"
                >
                  {orderModalListing.owner_uid}
                </button>{' '}
                · Payment: {orderModalListing.payment_model}
              </p>
              {orderModalListing.end_date && <p>End Date: {orderModalListing.end_date}</p>}
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={orderQty}
                  onChange={(e) => setOrderQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Delivery Google Map Link (Optional)</label>
                <input
                  type="url"
                  value={orderMap}
                  onChange={(e) => setOrderMap(e.target.value)}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Order Notes</label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                <span className="text-sm font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                  Total: {(orderModalListing.price_points * orderQty).toFixed(2)} pts
                </span>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 disabled:opacity-50"
                >
                  {submittingOrder ? 'Processing...' : 'Confirm & Pay Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invest Modal */}
      {investModalListing && (() => {
        const modalGoal = investModalListing.investment_goal_points || 0;
        const modalFunded = investments
          .filter((i) => i.listing_id === investModalListing.id && i.status === 'Active')
          .reduce((acc, i) => acc + i.invested_points, 0);
        const modalRemaining = Math.max(0, Number((modalGoal - modalFunded).toFixed(2)));
        const myBalance = metricsMap[currentProfile.universal_id]?.balance ?? 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <h3 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
                  Invest in Listing
                </h3>
                <button
                  type="button"
                  onClick={() => setInvestModalListing(null)}
                  className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                  aria-label="Close invest dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {investModalListing.title}
                </p>
                <p>
                  Funded: <span className="font-mono-tabular font-semibold">{modalFunded} / {modalGoal} pts</span>
                  {modalRemaining > 0
                    ? ` · ${modalRemaining} pts remaining to activate customer orders`
                    : ' · Goal met (orders active)'}
                </p>
                <p className="text-stone-500 dark:text-stone-400">
                  Your Balance: <span className="font-mono-tabular font-medium">{myBalance} pts</span> (Floor {systemConfig.negative_points_floor} pts). Dividends settle on delivery.
                </p>
              </div>
              <form onSubmit={handleInvestSubmit} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium">Investment Amount (pts)</label>
                    {modalRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setInvestAmount(modalRemaining)}
                        className="text-[11px] font-medium text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                      >
                        Fund Remaining ({modalRemaining} pts)
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={investAmount || ''}
                    onChange={(e) => setInvestAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingInvest || !investAmount || investAmount <= 0}
                  className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 disabled:opacity-50"
                >
                  {submittingInvest ? 'Committing Investment...' : 'Commit Investment Points'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Buyer Delivery Confirmation Modal */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
                Confirm Delivery ({deliveryModalOrder.order_number})
              </h3>
              <button onClick={() => setDeliveryModalOrder(null)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDeliverySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Delivery Outcome</label>
                <select
                  value={delStatus}
                  onChange={(e) =>
                    setDelStatus(e.target.value as 'Delivered' | 'Partially Delivered' | 'Rejected')
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="Delivered">Delivered (Settle Seller & Dividends)</option>
                  <option value="Partially Delivered">Partially Delivered</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              {delStatus === 'Rejected' && (
                <div>
                  <label className="block font-medium mb-1">Rejection Reason (Required)</label>
                  <input
                    type="text"
                    required
                    value={delRejectionReason}
                    onChange={(e) => setDelRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              )}
              <div>
                <label className="block font-medium mb-1">Delivery Evidence Link (Optional)</label>
                <input
                  type="url"
                  value={delEvidence}
                  onChange={(e) => setDelEvidence(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={delNotes}
                  onChange={(e) => setDelNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <button
                type="submit"
                disabled={submittingDelivery}
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 disabled:opacity-50"
              >
                {submittingDelivery ? 'Submitting...' : 'Submit Delivery Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Playable Video Modal */}
      {videoModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-black border border-stone-800 rounded-xl max-w-3xl w-full overflow-hidden">
            <div className="flex justify-end p-2">
              <button onClick={() => setVideoModalUrl(null)} className="text-stone-300 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe src={videoModalUrl} title="Listing Video" className="w-full h-full" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
