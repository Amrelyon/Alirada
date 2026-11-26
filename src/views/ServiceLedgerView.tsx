import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search, Flag, Award, ThumbsUp, AlertTriangle, X, User } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { HARDSHIP_MATRIX, UNIVERSAL_SERVICES_MASTER_LIST } from '../data/masterData';
import { UserAvatar } from '../components/UserAvatar';
import { ServiceLog } from '../types/alirada';

export const ServiceLedgerView: React.FC = () => {
  const {
    currentProfile,
    profiles,
    metricsMap,
    serviceLogs,
    deductionLogs,
    systemConfig,
    logService,
    logRequestedServant,
    castRecognitionVote,
    setInspectedUid,
    setReportModalTarget,
  } = useAlirada();

  const [tab, setTab] = useState<'service' | 'deduction' | 'history'>('service');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedService, setSelectedService] = useState(UNIVERSAL_SERVICES_MASTER_LIST[0].name);
  const [customService, setCustomService] = useState('');
  const [recipientUid, setRecipientUid] = useState(
    profiles.find((p) => p.universal_id !== currentProfile.universal_id)?.universal_id || 'UID-2'
  );
  const [hours, setHours] = useState<number>(3);
  const [hardship, setHardship] = useState<number>(4);
  const [loggedDate, setLoggedDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectContext, setProjectContext] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [googleMapLink, setGoogleMapLink] = useState('');
  const [notes, setNotes] = useState('');

  // Deduction Form State
  const [servantUid, setServantUid] = useState('UID-2');
  const [relatedLogId, setRelatedLogId] = useState('');
  const [deductedScore, setDeductedScore] = useState<number>(20);
  const [deductionEvidence, setDeductionEvidence] = useState('');
  const [deductionNotes, setDeductionNotes] = useState('');

  // History Search & UID Lookup
  const [historySearch, setHistorySearch] = useState('');
  const [lookupUid, setLookupUid] = useState('');

  // Ledger History Peer Recognition Modal State
  const [recognitionModalLog, setRecognitionModalLog] = useState<ServiceLog | null>(null);
  const [recognitionTargetUid, setRecognitionTargetUid] = useState('');
  const [recognitionDirection, setRecognitionDirection] = useState<'UPWARD' | 'COMPENSATE'>('UPWARD');
  const [recognitionComment, setRecognitionComment] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);

  const otherProfiles = useMemo(
    () => profiles.filter((p) => p.universal_id !== currentProfile.universal_id),
    [profiles, currentProfile.universal_id]
  );

  useEffect(() => {
    if (otherProfiles.length > 0 && !otherProfiles.some((p) => p.universal_id === recipientUid)) {
      setRecipientUid(otherProfiles[0].universal_id);
    } else if (otherProfiles.length === 0 && recipientUid !== '') {
      setRecipientUid('');
    }
  }, [otherProfiles, recipientUid]);

  useEffect(() => {
    if (otherProfiles.length > 0 && !otherProfiles.some((p) => p.universal_id === servantUid)) {
      setServantUid(otherProfiles[0].universal_id);
    } else if (otherProfiles.length === 0 && servantUid !== '') {
      setServantUid('');
    }
  }, [otherProfiles, servantUid]);

  const allServices = useMemo(() => {
    const customItems = systemConfig.custom_services.map((name, idx) => ({
      id: 1000 + idx,
      name,
      category: 'Custom Cooperative Service',
      suggestedHardship: 4,
    }));
    return [...UNIVERSAL_SERVICES_MASTER_LIST, ...customItems];
  }, [systemConfig.custom_services]);

  const filteredMasterServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return allServices;
    return allServices.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [allServices, serviceSearch]);

  const activeHardshipInfo = HARDSHIP_MATRIX.find((h) => h.level === hardship) || HARDSHIP_MATRIX[0];
  const liveScorePreview = Number(((hours || 0) * (hardship || 1)).toFixed(2));
  const myTodayHours = serviceLogs
    .filter((l) => l.provider_uid === currentProfile.universal_id && l.logged_date === loggedDate)
    .reduce((acc, l) => acc + l.hours, 0);
  const projectedDailyHours = Number((myTodayHours + (hours || 0)).toFixed(2));

  const handleServiceSelect = (name: string) => {
    setSelectedService(name);
    const found = allServices.find((s) => s.name === name);
    if (found) setHardship(found.suggestedHardship);
  };

  const handleLogServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const serviceLabel = customService.trim() || selectedService;
    const ok = await logService({
      recipient_uid: recipientUid,
      service_type: serviceLabel,
      hours: Number(hours),
      hardship: Number(hardship),
      logged_date: loggedDate,
      project_context: projectContext,
      evidence_link: evidenceLink,
      google_map_link: googleMapLink,
      notes,
    });
    if (ok) {
      setCustomService('');
      setNotes('');
      setEvidenceLink('');
      setGoogleMapLink('');
    }
  };

  const hasReceivedServiceFrom = (targetProviderUid: string) =>
    Boolean(
      targetProviderUid &&
        targetProviderUid !== currentProfile.universal_id &&
        serviceLogs.some(
          (l) =>
            l.provider_uid === targetProviderUid &&
            l.recipient_uid === currentProfile.universal_id
        )
    );

  const openRecognitionModal = (log: ServiceLog) => {
    const defaultTarget = hasReceivedServiceFrom(log.provider_uid) ? log.provider_uid : '';
    setRecognitionModalLog(log);
    setRecognitionTargetUid(defaultTarget);
    setRecognitionDirection('UPWARD');
    setRecognitionComment('');
  };

  const handleRecognitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recognitionTargetUid || submittingVote) return;
    setSubmittingVote(true);
    try {
      const ok = await castRecognitionVote(
        recognitionTargetUid,
        recognitionDirection,
        recognitionComment
      );
      if (ok) {
        setRecognitionModalLog(null);
        setRecognitionComment('');
      }
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleDeductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await logRequestedServant({
      requested_servant_uid: servantUid,
      related_service_log_id: relatedLogId,
      deducted_score: Number(deductedScore),
      logged_date: loggedDate,
      evidence_link: deductionEvidence,
      notes: deductionNotes,
    });
    if (ok) {
      setDeductionNotes('');
      setDeductionEvidence('');
      setRelatedLogId('');
    }
  };

  const filteredLogs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return serviceLogs;
    return serviceLogs.filter(
      (l) =>
        l.log_number.toLowerCase().includes(q) ||
        l.provider_uid.toLowerCase().includes(q) ||
        l.recipient_uid.toLowerCase().includes(q) ||
        l.service_type.toLowerCase().includes(q) ||
        (l.project_context || '').toLowerCase().includes(q)
    );
  }, [serviceLogs, historySearch]);

  const myMetrics = metricsMap[currentProfile.universal_id];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            Service Economy & Ledger
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Active Provider:{' '}
            <button
              type="button"
              onClick={() =>
                currentProfile.universal_id !== 'GUEST' &&
                setInspectedUid(currentProfile.universal_id)
              }
              className="notranslate font-mono-tabular font-medium text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
            >
              {currentProfile.universal_id}
            </button>{' '}
            · Balance: {myMetrics?.balance ?? 0} pts · Daily Hours on {loggedDate}: {myTodayHours}h / {systemConfig.daily_max_hours}h
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('service')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'service'
                ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Log Service
          </button>
          <button
            type="button"
            onClick={() => setTab('deduction')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'deduction'
                ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Requested Servant
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'history'
                ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Ledger History ({serviceLogs.length})
          </button>
        </div>
      </div>

      {tab === 'service' && (
        <form
          onSubmit={handleLogServiceSubmit}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6"
        >
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Recipient Universal ID
                </label>
                <select
                  value={recipientUid}
                  onChange={(e) => setRecipientUid(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                >
                  {otherProfiles.length === 0 ? (
                    <option value="">No other verified members available yet</option>
                  ) : (
                    otherProfiles.map((p) => (
                      <option key={p.universal_id} value={p.universal_id}>
                        {p.universal_id} — {p.full_name} ({p.entity_type})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Service Date
                </label>
                <input
                  type="date"
                  required
                  value={loggedDate}
                  onChange={(e) => setLoggedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Filter 150 Universal Master Services
              </label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-stone-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search services (e.g. solar, nursing, carpentry, tutoring)..."
                  className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
              <select
                value={selectedService}
                onChange={(e) => handleServiceSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              >
                {filteredMasterServices.map((s) => (
                  <option key={s.id} value={s.name}>
                    #{s.id} {s.name} [{s.category} · H{s.suggestedHardship}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Or Custom Service Title (Optional Override)
              </label>
              <input
                type="text"
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                placeholder="Leave blank to use selected master service"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Hours Served (Max {systemConfig.daily_max_hours}h/day)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max={systemConfig.daily_max_hours}
                  required
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Hardship Rating (1–10)
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={hardship}
                  onChange={(e) => setHardship(Number(e.target.value))}
                  className="w-full accent-[#D4AF37] mt-2"
                />
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Level {hardship}: {activeHardshipInfo.title} ({activeHardshipInfo.examples})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Project Context (Optional)
                </label>
                <input
                  type="text"
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  placeholder="Project > Function > Step"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Evidence / Photo Link (Optional)
                </label>
                <input
                  type="url"
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Google Map Link (Optional)
              </label>
              <input
                type="url"
                value={googleMapLink}
                onChange={(e) => setGoogleMapLink(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Service Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Work summary or deliverable verification notes..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {/* Live Calculation Summary Column */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 border-t lg:border-t-0 lg:border-s border-stone-200 dark:border-stone-800 pt-4 lg:pt-0 lg:ps-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                Live Score Calculation
              </p>
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-2">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Formula: Hours × Hardship
                </p>
                <p className="text-3xl font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                  +{liveScorePreview} pts
                </p>
                <p className="text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
                  {hours || 0} hours × Level {hardship}
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">Projected Daily Total</span>
                  <span className="font-mono-tabular font-medium text-stone-900 dark:text-stone-100">
                    {projectedDailyHours}h / {systemConfig.daily_max_hours}h
                  </span>
                </div>
                {projectedDailyHours > systemConfig.daily_warn_hours && projectedDailyHours <= systemConfig.daily_max_hours && (
                  <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    Exceeds {systemConfig.daily_warn_hours}h daily threshold: an administrator alert will be recorded.
                  </p>
                )}
                {projectedDailyHours > systemConfig.daily_max_hours && (
                  <p className="flex items-start gap-1.5 text-rose-700 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    Exceeds hard daily cap of {systemConfig.daily_max_hours}h. Reduce hours before submitting.
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={projectedDailyHours > systemConfig.daily_max_hours}
              className="w-full py-2.5 px-4 rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Record Service Score
            </button>
          </div>
        </form>
      )}

      {tab === 'deduction' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleDeductionSubmit}
            className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Log Requested Servant / Deduction
            </h2>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Requested Servant UID (Debited)
              </label>
              <select
                value={servantUid}
                onChange={(e) => setServantUid(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              >
                {otherProfiles.length === 0 ? (
                  <option value="">No other verified members available yet</option>
                ) : (
                  otherProfiles.map((p) => (
                    <option key={p.universal_id} value={p.universal_id}>
                      {p.universal_id} — {p.full_name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Deducted Score (pts)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={deductedScore}
                  onChange={(e) => setDeductedScore(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Related Service Log #
                </label>
                <input
                  type="text"
                  value={relatedLogId}
                  onChange={(e) => setRelatedLogId(e.target.value)}
                  placeholder="SRV-2026-0101"
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Evidence Link (Optional)
              </label>
              <input
                type="url"
                value={deductionEvidence}
                onChange={(e) => setDeductionEvidence(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={deductionNotes}
                onChange={(e) => setDeductionNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold text-sm hover:opacity-90"
            >
              Record Deduction
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Requested Servant Deductions ({deductionLogs.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                    <th className="py-2 pr-3 font-medium">Request #</th>
                    <th className="py-2 pr-3 font-medium">Servant</th>
                    <th className="py-2 pr-3 font-medium">Requester</th>
                    <th className="py-2 pr-3 font-medium">Ref Log</th>
                    <th className="py-2 text-right font-medium">Deducted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                  {deductionLogs.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 pr-3 font-mono-tabular">{d.request_number}</td>
                      <td className="py-2.5 pr-3">
                        <UserAvatar universalId={d.requested_servant_uid} showUid />
                      </td>
                      <td className="py-2.5 pr-3">
                        <UserAvatar universalId={d.requester_uid} showUid />
                      </td>
                      <td className="py-2.5 pr-3 font-mono-tabular text-stone-500">
                        {d.related_service_log_id || '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono-tabular font-semibold text-rose-700 dark:text-rose-400">
                        -{d.deducted_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Complete Service Ledger
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Click any UID or member avatar to inspect the UID holder&apos;s profile, or use Recognize to cast peer recognition.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = lookupUid.trim().toUpperCase();
                  if (clean) setInspectedUid(clean);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={lookupUid}
                  onChange={(e) => setLookupUid(e.target.value)}
                  placeholder="Lookup UID (e.g. UID-2)"
                  className="w-36 px-2.5 py-2 text-xs font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
                <button
                  type="submit"
                  disabled={!lookupUid.trim()}
                  className="px-2.5 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] disabled:opacity-40 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5" />
                  View Profile
                </button>
              </form>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search log #, UID, service, project..."
                  className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 pe-3 font-medium">Log # / Date</th>
                  <th className="py-2 pe-3 font-medium">Provider (UID Profile)</th>
                  <th className="py-2 pe-3 font-medium">Recipient (UID Profile)</th>
                  <th className="py-2 pe-3 font-medium">Service & Context</th>
                  <th className="py-2 pe-3 text-end font-medium">Hrs × H</th>
                  <th className="py-2 pe-3 text-end font-medium">Score</th>
                  <th className="py-2 text-end font-medium">Recognition & Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                {filteredLogs.map((log) => {
                  const canRecognizeRow = hasReceivedServiceFrom(log.provider_uid);
                  return (
                    <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/40">
                      <td className="py-3 pe-3 font-mono-tabular whitespace-nowrap">
                        <span className="block text-stone-900 dark:text-stone-100">{log.log_number}</span>
                        <span className="text-[11px] text-stone-500">{log.logged_date}</span>
                      </td>
                      <td className="py-3 pe-3">
                        <UserAvatar universalId={log.provider_uid} showName showUid />
                      </td>
                      <td className="py-3 pe-3">
                        <UserAvatar universalId={log.recipient_uid} showName showUid />
                      </td>
                      <td className="py-3 pe-3 max-w-xs">
                        <p className="font-medium text-stone-900 dark:text-stone-100">{log.service_type}</p>
                        {log.project_context && (
                          <p className="text-[11px] text-[#B88B1E] dark:text-[#D4AF37] truncate">
                            {log.project_context}
                          </p>
                        )}
                        {log.notes && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                            {log.notes}
                          </p>
                        )}
                        {log.daily_exceed_flag && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            Daily 8h+ threshold flagged
                          </p>
                        )}
                      </td>
                      <td className="py-3 pe-3 text-end font-mono-tabular whitespace-nowrap">
                        {log.hours}h × {log.hardship}
                      </td>
                      <td className="py-3 pe-3 text-end font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        +{log.final_score}
                      </td>
                      <td className="py-3 text-end whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {canRecognizeRow && (
                            <button
                              type="button"
                              onClick={() => openRecognitionModal(log)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#B88B1E]/50 dark:border-[#D4AF37]/50 text-[#B88B1E] dark:text-[#D4AF37] hover:bg-[#B88B1E]/10 dark:hover:bg-[#D4AF37]/10 inline-flex items-center gap-1"
                              title="Cast Peer Recognition from this ledger entry"
                            >
                              <Award className="w-3.5 h-3.5" />
                              Recognize
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setReportModalTarget({ type: 'Service Log', id: log.log_number })}
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Report Service Log"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Peer Recognition Modal triggered from Ledger History */}
      {recognitionModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <h3 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
                  Peer Recognition
                </h3>
                <p className="text-xs font-mono-tabular text-stone-500 dark:text-stone-400">
                  {recognitionModalLog.log_number} · {recognitionModalLog.logged_date} · +{recognitionModalLog.final_score} pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecognitionModalLog(null)}
                className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                aria-label="Close recognition dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {recognitionModalLog.service_type}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Peer recognition is restricted strictly to recipients who received a logged service from the target member.
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span>Select eligible service provider UID:</span>
                {recognitionTargetUid && (
                  <button
                    type="button"
                    onClick={() => {
                      const uid = recognitionTargetUid;
                      setRecognitionModalLog(null);
                      setInspectedUid(uid);
                    }}
                    className="text-[#B88B1E] dark:text-[#D4AF37] hover:underline font-medium"
                  >
                    View {recognitionTargetUid} Profile
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleRecognitionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { role: 'Provider', uid: recognitionModalLog.provider_uid },
                  { role: 'Recipient', uid: recognitionModalLog.recipient_uid },
                ].map((participant) => {
                  const isSelfParticipant = participant.uid === currentProfile.universal_id;
                  const eligible = !isSelfParticipant && hasReceivedServiceFrom(participant.uid);
                  const prof = profiles.find((p) => p.universal_id === participant.uid);
                  const selected = recognitionTargetUid === participant.uid;
                  return (
                    <button
                      key={`${participant.role}-${participant.uid}`}
                      type="button"
                      disabled={!eligible}
                      onClick={() => setRecognitionTargetUid(participant.uid)}
                      className={`p-2.5 rounded-lg border text-start transition-colors ${
                        selected
                          ? 'border-[#B88B1E] dark:border-[#D4AF37] bg-[#B88B1E]/10 dark:bg-[#D4AF37]/10'
                          : 'border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <span className="block text-[11px] text-stone-500 dark:text-stone-400">
                        {participant.role}{' '}
                        {isSelfParticipant ? '(You)' : !eligible ? '(Not Received From)' : ''}
                      </span>
                      <span className="block font-medium text-stone-900 dark:text-stone-100 truncate">
                        {prof?.full_name || participant.uid}
                      </span>
                      <span className="notranslate block font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37]">
                        {participant.uid}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRecognitionDirection('UPWARD')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center justify-center gap-1.5 ${
                    recognitionDirection === 'UPWARD'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Upward Recognition
                </button>
                <button
                  type="button"
                  onClick={() => setRecognitionDirection('COMPENSATE')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center justify-center gap-1.5 ${
                    recognitionDirection === 'COMPENSATE'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Compensate (Corrective)
                </button>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Recognition Audit Reason
                </label>
                <textarea
                  rows={2}
                  required
                  value={recognitionComment}
                  onChange={(e) => setRecognitionComment(e.target.value)}
                  placeholder="Provide specific observable reason for audit trail..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecognitionModalLog(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!recognitionTargetUid || submittingVote}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 disabled:opacity-50"
                >
                  {submittingVote ? 'Saving...' : 'Submit Recognition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
