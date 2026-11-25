import React, { useEffect, useState } from 'react';
import {
  Archive,
  Coins,
  Database,
  Gavel,
  HeartHandshake,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { ROOT_ADMIN_EMAIL, useAlirada } from '../context/AliradaContext';

const DELEGATABLE_ADMIN_TASKS = [
  'Economy Settings',
  'Member Discipline',
  'Charity Approvals',
  'Reports Queue',
  'Cycle Archiving',
  'Mock Data Purge',
];

export const AdminConsoleView: React.FC = () => {
  const {
    isRootAdmin,
    isAdmin,
    adminDelegates,
    myDelegatedTasks,
    mockDataCleared,
    mockRecordCount,
    profiles,
    userReports,
    systemConfig,
    updateSystemConfig,
    applyAdminDiscipline,
    runDailyMicroFeeCycle,
    approveCharityGrant,
    archiveCurrentCycle,
    resolveUserReport,
    grantAdminDelegation,
    revokeAdminDelegation,
    deleteMockData,
    setInspectedUid,
  } = useAlirada();

  const [floor, setFloor] = useState(systemConfig.negative_points_floor);
  const [warnHrs, setWarnHrs] = useState(systemConfig.daily_warn_hours);
  const [maxHrs, setMaxHrs] = useState(systemConfig.daily_max_hours);
  const [microFee, setMicroFee] = useState(systemConfig.daily_micro_fee);
  const [videoUrl, setVideoUrl] = useState(systemConfig.intro_video_url);
  const [newCategory, setNewCategory] = useState('');
  const [newCustomService, setNewCustomService] = useState('');
  const [nextCycleName, setNextCycleName] = useState('Cycle 2027-Q1');

  // Discipline State
  const [discProfileId, setDiscProfileId] = useState(profiles[1]?.id || profiles[0]?.id || '');
  const [discAction, setDiscAction] = useState<'PENALTY' | 'FREEZE' | 'LEGAL_BLOCK' | 'RESTORE'>('PENALTY');
  const [discPoints, setDiscPoints] = useState(25);
  const [discReason, setDiscReason] = useState('');

  // Charity Grant State
  const [charityId, setCharityId] = useState(
    profiles.find((p) => p.entity_type === 'Charity / Vulnerable Entity')?.id || profiles[0]?.id || ''
  );
  const [grantType, setGrantType] = useState<'One-Time' | 'Monthly'>('Monthly');
  const [grantAmount, setGrantAmount] = useState(150);

  // Admin Task Delegation State (Root Admin Only)
  const [delEmail, setDelEmail] = useState('');
  const [delUid, setDelUid] = useState('');
  const [delTasks, setDelTasks] = useState<string[]>([
    'Member Discipline',
    'Reports Queue',
    'Charity Approvals',
  ]);

  // 2-step Mock Data Purge confirmation
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purging, setPurging] = useState(false);

  // Keep local form fields synchronized with Firestore snapshots & profile updates
  useEffect(() => {
    setFloor(systemConfig.negative_points_floor);
    setWarnHrs(systemConfig.daily_warn_hours);
    setMaxHrs(systemConfig.daily_max_hours);
    setMicroFee(systemConfig.daily_micro_fee);
    setVideoUrl(systemConfig.intro_video_url);
  }, [systemConfig]);

  useEffect(() => {
    if (profiles.length === 0) {
      setDiscProfileId('');
      setCharityId('');
      return;
    }
    if (!profiles.some((p) => p.id === discProfileId)) {
      setDiscProfileId(profiles[1]?.id || profiles[0].id);
    }
    if (!profiles.some((p) => p.id === charityId)) {
      setCharityId(
        profiles.find((p) => p.entity_type === 'Charity / Vulnerable Entity')?.id || profiles[0].id
      );
    }
  }, [profiles, discProfileId, charityId]);

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-8 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
        <h2 className="font-cinzel text-lg font-bold">Administrator Access Restricted</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
          The Admin Console is restricted exclusively to root administrator ({ROOT_ADMIN_EMAIL}) and verified members explicitly delegated admin tasks by {ROOT_ADMIN_EMAIL}.
        </p>
      </div>
    );
  }

  const handleSaveEconomy = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSystemConfig({
      negative_points_floor: Number(floor),
      daily_warn_hours: Number(warnHrs),
      daily_max_hours: Number(maxHrs),
      daily_micro_fee: Number(microFee),
      intro_video_url: videoUrl.trim(),
    });
  };

  const handleGrantDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await grantAdminDelegation(delEmail, delUid, delTasks);
    if (ok) {
      setDelEmail('');
      setDelUid('');
    }
  };

  const handleConfirmMockPurge = async () => {
    setPurging(true);
    await deleteMockData();
    setPurging(false);
    setConfirmPurge(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            Admin Control Console
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Economy caps, task delegation, demo data cleanup, charity grants, discipline, and cycle archiving
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#12151B] text-xs self-start">
          <ShieldCheck className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
          <span className="font-medium text-stone-800 dark:text-stone-200">
            {isRootAdmin
              ? `Root Admin (${ROOT_ADMIN_EMAIL})`
              : `Delegated Admin · Tasks: ${myDelegatedTasks.join(', ') || 'Authorized'}`}
          </span>
        </div>
      </div>

      {/* Admin Task Delegation & Mock Data Cleanup Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs">
          <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <UserPlus className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
            Admin Task Delegation ({adminDelegates.filter((d) => d.active).length} active)
          </h2>

          {isRootAdmin ? (
            <>
              <form onSubmit={handleGrantDelegation} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="email"
                    required
                    value={delEmail}
                    onChange={(e) => setDelEmail(e.target.value)}
                    placeholder="Delegate verified email..."
                    className="sm:col-span-2 px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                  <input
                    type="text"
                    value={delUid}
                    onChange={(e) => setDelUid(e.target.value)}
                    placeholder="UID (Optional)"
                    className="px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {DELEGATABLE_ADMIN_TASKS.map((task) => {
                    const checked = delTasks.includes(task);
                    return (
                      <label
                        key={task}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0B0D10] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setDelTasks((prev) =>
                              e.target.checked ? [...prev, task] : prev.filter((t) => t !== task)
                            )
                          }
                        />
                        <span>{task}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
                >
                  Grant Admin Task Delegation
                </button>
              </form>

              <div className="divide-y divide-stone-100 dark:divide-stone-800/70 pt-2">
                {adminDelegates.length === 0 ? (
                  <p className="text-stone-500">
                    No delegated admins configured. Only {ROOT_ADMIN_EMAIL} currently has Admin Console access.
                  </p>
                ) : (
                  adminDelegates.map((d) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-stone-900 dark:text-stone-100">
                          {d.delegate_email}{' '}
                          {d.delegate_uid && (
                            <button
                              type="button"
                              onClick={() => setInspectedUid(d.delegate_uid!)}
                              className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                              title="View Delegate UID Profile"
                            >
                              ({d.delegate_uid})
                            </button>
                          )}
                        </p>
                        <p className="text-stone-500 dark:text-stone-400">
                          Tasks: {d.tasks.join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => revokeAdminDelegation(d.id)}
                        className="px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Revoke
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              You have been delegated administrative access by{' '}
              <span className="font-semibold">{ROOT_ADMIN_EMAIL}</span>. Only the root administrator can add or revoke admin delegates.
            </p>
          )}
        </div>

        {/* Mock / Demo Data Management Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 flex flex-col justify-between gap-4 text-xs">
          <div className="space-y-2">
            <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <Database className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Mock & Demo Data Purge
            </h2>
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              Remove all initial seed/mock accounts, sample service logs, sample listings, and demo records across the platform so only verified live data remains.
            </p>
            <p className="font-mono-tabular text-stone-500 dark:text-stone-400 pt-1">
              Status:{' '}
              <span
                className={
                  mockDataCleared && mockRecordCount === 0
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-amber-700 dark:text-amber-400 font-semibold'
                }
              >
                {mockDataCleared && mockRecordCount === 0
                  ? 'All Mock Data Cleared (Live Production Mode)'
                  : `${mockRecordCount} Mock Seed Records Active`}
              </span>
            </p>
          </div>

          {(!mockDataCleared || mockRecordCount > 0) && (
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
              {!confirmPurge ? (
                <button
                  type="button"
                  onClick={() => setConfirmPurge(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All Mock Data
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={purging}
                    onClick={handleConfirmMockPurge}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {purging ? 'Purging...' : 'Confirm Permanent Purge'}
                  </button>
                  <button
                    type="button"
                    disabled={purging}
                    onClick={() => setConfirmPurge(false)}
                    className="px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Economy & Video Settings + Micro-Fee */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveEconomy}
          className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs"
        >
          <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <Settings className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
            Platform Economy & Video Settings
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium mb-1">Negative Floor</label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Warn Hours</label>
              <input
                type="number"
                value={warnHrs}
                onChange={(e) => setWarnHrs(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Max Hours</label>
              <input
                type="number"
                value={maxHrs}
                onChange={(e) => setMaxHrs(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Daily Micro-Fee</label>
              <input
                type="number"
                step="0.05"
                value={microFee}
                onChange={(e) => setMicroFee(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Front-Page Intro Video URL (YouTube / Vimeo / Drive)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
            >
              Save Settings
            </button>
            <button
              type="button"
              onClick={runDailyMicroFeeCycle}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 inline-flex items-center gap-1.5"
            >
              <Coins className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Run Daily Micro-Fee ({systemConfig.total_micro_fees_collected} pts total)
            </button>
          </div>
        </form>

        {/* Dynamic Selection Lists & Cycle Archiving */}
        <div className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-5 text-xs">
          <div className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <Archive className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Cycle Archiving & Dynamic Lists
            </h2>
            <p className="text-stone-500">
              Active: {systemConfig.current_cycle_name} · Last Archived: {systemConfig.last_cycle_archived_at?.slice(0, 10) || 'Never'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nextCycleName}
                onChange={(e) => setNextCycleName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="button"
                onClick={() => archiveCurrentCycle(nextCycleName)}
                className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 font-medium whitespace-nowrap"
              >
                Archive & Roll Cycle
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <label className="block font-medium">Add Marketplace Category</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCategory.trim()) return;
                  updateSystemConfig({
                    custom_categories: [...systemConfig.custom_categories, newCategory.trim()],
                  });
                  setNewCategory('');
                }}
                className="px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium"
              >
                Add
              </button>
            </div>

            <label className="block font-medium pt-2">Add Custom Master Service</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCustomService}
                onChange={(e) => setNewCustomService(e.target.value)}
                placeholder="New service title..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCustomService.trim()) return;
                  updateSystemConfig({
                    custom_services: [...systemConfig.custom_services, newCustomService.trim()],
                  });
                  setNewCustomService('');
                }}
                className="px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discipline & Charity Grants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs">
          <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <Gavel className="w-4 h-4 text-rose-600" />
            Member Discipline & Compliance
          </h2>
          {profiles.length === 0 ? (
            <p className="text-stone-500">No verified member profiles loaded yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={discProfileId}
                  onChange={(e) => setDiscProfileId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.universal_id} — {p.full_name} ({p.user_status})
                    </option>
                  ))}
                </select>
                <select
                  value={discAction}
                  onChange={(e) =>
                    setDiscAction(e.target.value as 'PENALTY' | 'FREEZE' | 'LEGAL_BLOCK' | 'RESTORE')
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="PENALTY">PENALTY (Deduct Score)</option>
                  <option value="FREEZE">FREEZE Account</option>
                  <option value="LEGAL_BLOCK">LEGAL_BLOCK</option>
                  <option value="RESTORE">RESTORE Active</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  min={0}
                  value={discPoints}
                  onChange={(e) => setDiscPoints(Number(e.target.value))}
                  placeholder="Penalty pts"
                  className="px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <input
                  type="text"
                  value={discReason}
                  onChange={(e) => setDiscReason(e.target.value)}
                  placeholder="Audit reason..."
                  className="col-span-2 px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <button
                type="button"
                disabled={!discProfileId}
                onClick={() => applyAdminDiscipline(discProfileId, discAction, discPoints, discReason)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40"
              >
                Execute Discipline Action
              </button>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs">
          <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <HeartHandshake className="w-4 h-4 text-emerald-600" />
            Charity Evidence Approval & Grants
          </h2>
          {profiles.length === 0 ? (
            <p className="text-stone-500">No verified member profiles loaded yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={charityId}
                  onChange={(e) => setCharityId(e.target.value)}
                  className="col-span-2 px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.universal_id} — {p.full_name} ({p.entity_type})
                    </option>
                  ))}
                </select>
                <select
                  value={grantType}
                  onChange={(e) => setGrantType(e.target.value as 'One-Time' | 'Monthly')}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="One-Time">One-Time</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  min={10}
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(Number(e.target.value))}
                  className="w-36 px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <button
                  type="button"
                  disabled={!charityId}
                  onClick={() => approveCharityGrant(charityId, grantType, Number(grantAmount))}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Approve Evidence & Disburse Grant
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Reports Queue */}
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
          User Reports Queue ({userReports.length})
        </h2>
        {userReports.length === 0 ? (
          <p className="text-xs text-stone-500">No open user reports at this time.</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800/70 text-xs">
            {userReports.map((r) => (
              <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-stone-900 dark:text-stone-100">
                    {r.report_code} · {r.target_type} ({r.target_id}) · {r.status}
                  </p>
                  <p className="text-stone-600 dark:text-stone-300">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(['Reviewed', 'Actioned', 'Dismissed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => resolveUserReport(r.id, st)}
                      className="px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
