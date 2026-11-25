import React, { useMemo, useState } from 'react';
import { Plus, Search, Shield, User, Users, Vote } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { LegacyBeneficiary } from '../types/alirada';
import { UserAvatar } from '../components/UserAvatar';

export const GovernancePeopleView: React.FC = () => {
  const {
    currentProfile,
    profiles,
    metricsMap,
    governanceDelegates,
    saveGovernanceDelegate,
    voteForCeo,
    saveLegacyProtocol,
    setInspectedUid,
  } = useAlirada();

  const [subTab, setSubTab] = useState<'people' | 'governance' | 'legacy'>('people');
  const [search, setSearch] = useState('');
  const [lookupUid, setLookupUid] = useState('');

  // Governance Delegation Form
  const [govScope, setGovScope] = useState<'INSTITUTIONAL' | 'PLATFORM'>('INSTITUTIONAL');
  const [govEntity, setGovEntity] = useState(currentProfile.full_name);
  const [govDelegateEmail, setGovDelegateEmail] = useState('');
  const [govDelegateUid, setGovDelegateUid] = useState('UID-2');
  const [govTasks, setGovTasks] = useState('Approve Orders, Audit Service Logs');
  const [govSuccessor, setGovSuccessor] = useState('');
  const [govAbsentDays, setGovAbsentDays] = useState(180);

  // Legacy Protocol Form
  const [absentDays, setAbsentDays] = useState(currentProfile.absent_period_days || 365);
  const [successorEmail, setSuccessorEmail] = useState(currentProfile.successor_email || '');
  const [beneficiaries, setBeneficiaries] = useState<LegacyBeneficiary[]>(
    currentProfile.legacy_beneficiaries && currentProfile.legacy_beneficiaries.length > 0
      ? currentProfile.legacy_beneficiaries
      : [{ uid: 'UID-2', email: 'nadia.khoury@alirada.org', percentage: 100 }]
  );

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.universal_id.toLowerCase().includes(q) ||
        p.entity_type.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const handleSaveGov = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveGovernanceDelegate({
      scope: govScope,
      entity_name: govEntity,
      delegate_email: govDelegateEmail,
      delegate_uid: govDelegateUid,
      delegated_tasks: govTasks
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      successor_email: govSuccessor,
      absent_period_days: Number(govAbsentDays),
    });
  };

  const handleSaveLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveLegacyProtocol(Number(absentDays), successorEmail, beneficiaries);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            People Ledger & Governance
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Click any member avatar to inspect full ledger stats, recognition audit, and legacy rules
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg self-start">
          {(
            [
              ['people', `People Ledger (${profiles.length})`],
              ['governance', 'Delegation & CEO Voting'],
              ['legacy', 'Legacy & Absent Protocol'],
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

      {subTab === 'people' && (
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <Users className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Cooperative Directory
            </h2>
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
                  className="w-36 px-2.5 py-2 text-xs font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <button
                  type="submit"
                  disabled={!lookupUid.trim()}
                  className="px-2.5 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] disabled:opacity-40 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5" />
                  View Profile
                </button>
              </form>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search UID, name, entity, country..."
                  className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">Entity Type</th>
                  <th className="py-2 pr-3 font-medium">Tier</th>
                  <th className="py-2 pr-3 text-right font-medium">Hours</th>
                  <th className="py-2 pr-3 text-right font-medium">Avg Hardship</th>
                  <th className="py-2 pr-3 text-right font-medium">Recognition</th>
                  <th className="py-2 pr-3 text-right font-medium">Balance</th>
                  <th className="py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                {filteredProfiles.map((p) => {
                  const m = metricsMap[p.universal_id];
                  return (
                    <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/40">
                      <td className="py-3 pr-3">
                        <UserAvatar universalId={p.universal_id} showName showUid />
                      </td>
                      <td className="py-3 pr-3 text-stone-600 dark:text-stone-300">{p.entity_type}</td>
                      <td className="py-3 pr-3 text-[#B88B1E] dark:text-[#D4AF37] font-medium">
                        {m?.service_tier || 'Initiate'}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tabular">{m?.hours_served ?? 0}h</td>
                      <td className="py-3 pr-3 text-right font-mono-tabular">{m?.average_hardship ?? 0}</td>
                      <td className="py-3 pr-3 text-right font-mono-tabular">
                        +{m?.upward_votes ?? 0} / -{m?.compensate_votes ?? 0}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                        {m?.balance ?? 0} pts
                      </td>
                      <td className="py-3 text-right">{p.user_status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'governance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveGov}
            className="lg:col-span-5 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Configure Institutional / Platform Delegation
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={govScope}
                onChange={(e) => setGovScope(e.target.value as 'INSTITUTIONAL' | 'PLATFORM')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              >
                <option value="INSTITUTIONAL">Institutional</option>
                <option value="PLATFORM">Platform</option>
              </select>
              <input
                type="text"
                required
                placeholder="Entity / Council Name"
                value={govEntity}
                onChange={(e) => setGovEntity(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="email"
                required
                placeholder="Delegate Email"
                value={govDelegateEmail}
                onChange={(e) => setGovDelegateEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <input
                type="text"
                placeholder="Delegate UID (UID-2)"
                value={govDelegateUid}
                onChange={(e) => setGovDelegateUid(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <input
              type="text"
              placeholder="Delegated Tasks (comma-separated)"
              value={govTasks}
              onChange={(e) => setGovTasks(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="email"
                placeholder="Founder Successor Email"
                value={govSuccessor}
                onChange={(e) => setGovSuccessor(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <input
                type="number"
                min={30}
                value={govAbsentDays}
                onChange={(e) => setGovAbsentDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
            >
              Save Delegation Charter
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Vote className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Active Delegates & Changeable CEO Elections
            </h2>
            <div className="divide-y divide-stone-100 dark:divide-stone-800/70">
              {governanceDelegates.map((g) => (
                <div key={g.id} className="py-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {g.entity_name}{' '}
                        <span className="text-xs font-normal text-stone-500">· {g.scope}</span>
                      </p>
                      <p className="text-stone-500 dark:text-stone-400">
                        Principal:{' '}
                        <button
                          type="button"
                          onClick={() => setInspectedUid(g.principal_uid)}
                          className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                        >
                          {g.principal_uid}
                        </button>{' '}
                        · Delegate:{' '}
                        {g.delegate_uid ? (
                          <button
                            type="button"
                            onClick={() => setInspectedUid(g.delegate_uid!)}
                            className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                          >
                            {g.delegate_uid}
                          </button>
                        ) : (
                          g.delegate_email
                        )}{' '}
                        · Successor: {g.successor_email || '—'} ({g.absent_period_days}d)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) voteForCeo(g.id, e.target.value);
                        }}
                        defaultValue=""
                        className="px-2.5 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                      >
                        <option value="">Vote / Change CEO...</option>
                        {profiles.map((p) => (
                          <option key={p.universal_id} value={p.universal_id}>
                            Vote {p.universal_id} ({p.full_name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300">
                    Tasks: {g.delegated_tasks.join(' · ')}
                  </p>
                  <p className="font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37]">
                    CEO Votes ({g.ceo_votes.length}): {g.ceo_votes.join(', ') || 'None yet'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'legacy' && (
        <form
          onSubmit={handleSaveLegacy}
          className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 max-w-2xl space-y-4 text-xs"
        >
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Absent-Period Wealth Allocation & Legacy Protocol
          </h2>
          <p className="text-stone-500 dark:text-stone-400">
            Configure your inactivity threshold so prolonged absence triggers automated balance distribution to your designated beneficiaries and successor.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Inactivity Threshold (Days)</label>
              <input
                type="number"
                min={30}
                max={3650}
                required
                value={absentDays}
                onChange={(e) => setAbsentDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Successor Email</label>
              <input
                type="email"
                value={successorEmail}
                onChange={(e) => setSuccessorEmail(e.target.value)}
                placeholder="successor@domain.org"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Beneficiaries (Must total 100%)</span>
              <button
                type="button"
                onClick={() =>
                  setBeneficiaries((prev) => [...prev, { uid: 'UID-4', email: '', percentage: 0 }])
                }
                className="text-[#B88B1E] dark:text-[#D4AF37] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Beneficiary
              </button>
            </div>
            {beneficiaries.map((b, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="UID"
                  value={b.uid}
                  onChange={(e) =>
                    setBeneficiaries((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, uid: e.target.value } : row))
                    )
                  }
                  className="col-span-3 px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={b.email}
                  onChange={(e) =>
                    setBeneficiaries((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, email: e.target.value } : row))
                    )
                  }
                  className="col-span-6 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={b.percentage}
                  onChange={(e) =>
                    setBeneficiaries((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, percentage: Number(e.target.value) } : row
                      )
                    )
                  }
                  className="col-span-3 px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
          >
            Save Legacy Protocol
          </button>
        </form>
      )}
    </div>
  );
};
