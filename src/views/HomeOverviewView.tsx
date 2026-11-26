import React, { useMemo, useState } from 'react';
import { PlayCircle, EyeOff, Eye, ArrowRight, Compass, Layers, ShoppingBag, Repeat } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { HARDSHIP_MATRIX } from '../data/masterData';
import { buildPlatformInvestmentSeries } from '../lib/ledgerMath';
import { getEmbeddableVideoUrl } from '../lib/mediaUtils';
import { UserAvatar } from '../components/UserAvatar';
import { InvestmentAnalyticsChart } from '../components/InvestmentAnalyticsChart';

export const HomeOverviewView: React.FC = () => {
  const {
    firebaseUser,
    currentProfile,
    metricsMap,
    serviceLogs,
    listings,
    projects,
    orders,
    investments,
    projectReports,
    systemConfig,
    setActiveSection,
    setInspectedUid,
    notifications,
    markNotificationRead,
  } = useAlirada();

  const [hideIntroVideo, setHideIntroVideo] = useState(false);
  const metrics = metricsMap[currentProfile.universal_id];
  const platformInvestment = useMemo(
    () => buildPlatformInvestmentSeries(investments, projectReports, orders, listings),
    [investments, projectReports, orders, listings]
  );
  const embedUrl = getEmbeddableVideoUrl(systemConfig.intro_video_url);
  const unreadAlerts = notifications.filter((n) => !n.read);

  return (
    <div className="space-y-8">
      {/* Hero / Personal Ledger Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-[#B88B1E] dark:text-[#D4AF37]">
              {systemConfig.current_cycle_name} ·{' '}
              {firebaseUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => setInspectedUid(currentProfile.universal_id)}
                    className="notranslate font-mono-tabular hover:underline"
                    title="Inspect your UID profile"
                  >
                    {currentProfile.universal_id}
                  </button>{' '}
                  · {currentProfile.entity_type}
                </>
              ) : (
                'Guest Preview'
              )}
            </p>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
              Be served as you serve.
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
              Every hour of cooperative service creates verifiable value equal to{' '}
              <span className="font-mono-tabular font-medium text-stone-900 dark:text-stone-100">
                Hours × Hardship (1–10)
              </span>
              . Exchange products, fund workshops, govern shared projects, and settle peer payments transparently.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSection('ledger')}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 transition-opacity inline-flex items-center gap-2 whitespace-nowrap"
            >
              Log Service Hours
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('marketplace')}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors whitespace-nowrap"
            >
              Explore Marketplace ({listings.length})
            </button>
          </div>
        </div>

        {/* Front-Page Intro Video (Home View Only with Dismiss Toggle) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
              <PlayCircle className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              <span>Cooperative Introduction</span>
            </div>
            <button
              type="button"
              onClick={() => setHideIntroVideo((v) => !v)}
              className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 inline-flex items-center gap-1 whitespace-nowrap"
            >
              {hideIntroVideo ? (
                <>
                  <Eye className="w-3.5 h-3.5" /> Show Video
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" /> Hide Video
                </>
              )}
            </button>
          </div>

          {!hideIntroVideo && embedUrl ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-950 border border-stone-200 dark:border-stone-800">
              <iframe
                src={embedUrl}
                title="Alirada Introduction Video"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-dashed border-stone-300 dark:border-stone-800">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {hideIntroVideo
                  ? 'Introduction video hidden for this session.'
                  : 'No valid introduction video URL configured.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4-Column Ledger KPI Strip */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5">
            <p className="text-xs text-stone-500 dark:text-stone-400">Net Point Balance</p>
            <p className="mt-1 text-2xl font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              {metrics?.balance ?? 0} <span className="text-sm font-normal text-stone-500">pts</span>
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
              Carried: {metrics?.carried_balance ?? 0} · Floor: {systemConfig.negative_points_floor} pts
            </p>
          </div>

          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5">
            <p className="text-xs text-stone-500 dark:text-stone-400">Total Earned (Services + Credits)</p>
            <p className="mt-1 text-2xl font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
              +{metrics?.total_earned ?? 0} <span className="text-sm font-normal text-stone-500">pts</span>
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
              Service: +{metrics?.score_earned ?? 0} · Credits: +{metrics?.credits_in ?? 0}
            </p>
          </div>

          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5">
            <p className="text-xs text-stone-500 dark:text-stone-400">Total Deductions</p>
            <p className="mt-1 text-2xl font-mono-tabular font-semibold text-rose-700 dark:text-rose-400">
              -{metrics?.total_deductions ?? 0} <span className="text-sm font-normal text-stone-500">pts</span>
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
              Ledger: -{metrics?.deductions ?? 0} · Penalty: -{metrics?.penalty_score ?? 0}
            </p>
          </div>

          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5">
            <p className="text-xs text-stone-500 dark:text-stone-400">Hardship, Tier & Recognition</p>
            <p className="mt-1 text-2xl font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              {metrics?.average_hardship ?? 0} <span className="text-sm font-normal text-stone-500">/ 10</span>
            </p>
            <p className="mt-1 text-xs text-[#B88B1E] dark:text-[#D4AF37] font-medium font-mono-tabular">
              {metrics?.service_tier || 'Initiate'} · +{metrics?.upward_votes ?? 0}/-{metrics?.compensate_votes ?? 0} · {metrics?.today_hours ?? 0}h/{systemConfig.daily_max_hours}h
            </p>
          </div>
        </div>

        {metrics && (
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl px-5 py-3.5 text-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-600 dark:text-stone-300 font-mono-tabular">
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                Earnings Breakdown:
              </span>
              <span>Services +{metrics.earning_breakdown.services}</span>
              <span>Sales +{metrics.earning_breakdown.orders_sold}</span>
              <span>Dividends +{metrics.earning_breakdown.dividends}</span>
              <span>C2P/P2P +{metrics.earning_breakdown.c2p_p2p_in}</span>
              <span>Batches +{metrics.earning_breakdown.batch_in}</span>
              <span>Exchange +{metrics.earning_breakdown.exchange_in}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-600 dark:text-stone-300 font-mono-tabular">
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                Deductions Breakdown:
              </span>
              <span>Requested -{metrics.deduction_breakdown.requested_servants}</span>
              <span>Orders -{metrics.deduction_breakdown.orders_spent}</span>
              <span>Invested -{metrics.deduction_breakdown.investments_out}</span>
              <span>C2P/P2P -{metrics.deduction_breakdown.c2p_p2p_out}</span>
              <span>Batches -{metrics.deduction_breakdown.batch_out}</span>
              <span>Escrow -{metrics.deduction_breakdown.exchange_escrow_out}</span>
              <span>Penalty -{metrics.deduction_breakdown.penalty}</span>
            </div>
          </div>
        )}
      </section>

      {/* Unread Notices */}
      {unreadAlerts.length > 0 && (
        <section className="bg-white dark:bg-[#12151B] border border-amber-300/60 dark:border-amber-700/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Cooperative Alerts ({unreadAlerts.length})
          </p>
          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {unreadAlerts.slice(0, 3).map((n) => (
              <div key={n.id} className="py-2 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-medium text-stone-900 dark:text-stone-100">{n.title}</span>
                  <span className="mx-1.5 text-stone-400">·</span>
                  <span className="text-stone-600 dark:text-stone-300">{n.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => markNotificationRead(n.id)}
                  className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Module Launchers */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setActiveSection('ledger')}
          className="text-left bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] rounded-xl p-4 transition-colors space-y-1.5"
        >
          <Compass className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Service Ledger</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Log from 150 master services or record deductions
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('marketplace')}
          className="text-left bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] rounded-xl p-4 transition-colors space-y-1.5"
        >
          <ShoppingBag className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Marketplace</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {listings.length} products, services & courses linked to project income
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('projects')}
          className="text-left bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] rounded-xl p-4 transition-colors space-y-1.5"
        >
          <Layers className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Projects, Invest & Jobs</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {projects.length} cooperative projects, shareholder rounds & jobs
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('payments')}
          className="text-left bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] rounded-xl p-4 transition-colors space-y-1.5"
        >
          <Repeat className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">C2P / P2P & Exchange</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Embeddable checkout widgets, batches, & point swaps
          </p>
        </button>
      </section>

      {/* Platform-Wide Accumulated Investments & Income Diagram */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Platform-Wide Accumulated Investment & Income
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Combined cooperative project investments, reported operating costs, shareholder reports, and real-time linked listing income
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular">
            <span className="text-[#B88B1E] dark:text-[#D4AF37]">
              Invested: {platformInvestment.totalInvested} pts
            </span>
            <span className="text-rose-700 dark:text-rose-400">
              Cost: {platformInvestment.totalCost} pts
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              Income: {platformInvestment.totalIncome} pts (Live Listings +{platformInvestment.realTimeListingIncome} pts)
            </span>
          </div>
        </div>
        <InvestmentAnalyticsChart
          points={platformInvestment.points}
          title="General Cooperative Investment & Income Trajectory"
          subtitle="Tracks cumulative capital invested, reported project costs, and combined project + linked-listing revenue from inception to now"
          showInvested
        />
      </section>

      {/* Recent Cooperative Activity + 10-Level Hardship Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Recent Cooperative Service Logs
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('ledger')}
              className="text-xs text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
            >
              View Full Ledger
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 font-medium">Service</th>
                  <th className="py-2 pr-3 font-medium">Recipient</th>
                  <th className="py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                {serviceLogs.slice(0, 6).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/40">
                    <td className="py-2.5 pr-3">
                      <UserAvatar universalId={log.provider_uid} showUid />
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-stone-900 dark:text-stone-100">{log.service_type}</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono-tabular">
                        {log.logged_date} · {log.hours}h × H{log.hardship}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <UserAvatar universalId={log.recipient_uid} showUid />
                    </td>
                    <td className="py-2.5 text-right font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                      +{log.final_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            10-Level Hardship Matrix
          </h2>
          <div className="divide-y divide-stone-100 dark:divide-stone-800/70 max-h-80 overflow-y-auto pr-1">
            {HARDSHIP_MATRIX.map((h) => (
              <div key={h.level} className="py-2 flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100">
                    Level {h.level}: {h.title}
                  </p>
                  <p className="text-stone-500 dark:text-stone-400">{h.examples}</p>
                </div>
                <span className="font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] shrink-0">
                  ×{h.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
