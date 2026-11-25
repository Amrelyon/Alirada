import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, ThumbsUp, AlertTriangle, MapPin, Award, Lock, Edit3, BookOpen } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { normalizeMediaImageUrl, sanitizeExternalLink } from '../lib/mediaUtils';
import { EntityType } from '../types/alirada';
import { UserAvatar } from './UserAvatar';

export const UserInspectorModal: React.FC = () => {
  const {
    firebaseUser,
    inspectedUid,
    setInspectedUid,
    profiles,
    metricsMap,
    serviceLogs,
    recognitionVotes,
    currentProfile,
    isAdmin,
    castRecognitionVote,
    updateOwnProfile,
    setReportModalTarget,
  } = useAlirada();

  const [direction, setDirection] = useState<'UPWARD' | 'COMPENSATE'>('UPWARD');
  const [comment, setComment] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  const [editingSelf, setEditingSelf] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const normalizedUid = inspectedUid?.trim().toUpperCase() || '';
  const profile = profiles.find((p) => p.universal_id.toUpperCase() === normalizedUid);
  const [editName, setEditName] = useState('');
  const [editEntity, setEditEntity] = useState<EntityType>('Individual');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editContact, setEditContact] = useState('');

  useEffect(() => {
    setEditingSelf(false);
    if (profile) {
      setEditName(profile.full_name || '');
      setEditEntity(profile.entity_type || 'Individual');
      setEditCountry(profile.country || '');
      setEditCity(profile.city || '');
      setEditAvatar(profile.profile_image_url || '');
      setEditContact(profile.contact_info || '');
    }
  }, [inspectedUid, profile?.uid]);

  if (!inspectedUid) return null;

  if (!profile) {
    const relatedLogs = serviceLogs.filter(
      (l) =>
        l.provider_uid.toUpperCase() === normalizedUid ||
        l.recipient_uid.toUpperCase() === normalizedUid
    );
    const votesForMissing = recognitionVotes.filter(
      (v) => v.target_uid.toUpperCase() === normalizedUid
    );
    const hoursGiven = relatedLogs
      .filter((l) => l.provider_uid.toUpperCase() === normalizedUid)
      .reduce((acc, l) => acc + l.hours, 0);
    const scoreEarned = relatedLogs
      .filter((l) => l.provider_uid.toUpperCase() === normalizedUid)
      .reduce((acc, l) => acc + l.final_score, 0);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
            <h3 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
              UID Holder <span className="notranslate text-[#B88B1E] dark:text-[#D4AF37]">{normalizedUid}</span>
            </h3>
            <button
              type="button"
              onClick={() => setInspectedUid(null)}
              className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              aria-label="Close inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            No active registered profile record is available for {normalizedUid}.
          </p>
          {(relatedLogs.length > 0 || votesForMissing.length > 0) && (
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 text-xs">
              <div>
                <p className="text-stone-500">Ledger Entries</p>
                <p className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                  {relatedLogs.length}
                </p>
              </div>
              <div>
                <p className="text-stone-500">Hours Served</p>
                <p className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                  {hoursGiven}h (+{scoreEarned} pts)
                </p>
              </div>
              <div>
                <p className="text-stone-500">Recognition Votes</p>
                <p className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                  {votesForMissing.length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const metrics = metricsMap[profile.universal_id];
  const votesForUser = recognitionVotes.filter((v) => v.target_uid === profile.universal_id);
  const recentLogsForUser = serviceLogs
    .filter(
      (l) =>
        l.provider_uid === profile.universal_id || l.recipient_uid === profile.universal_id
    )
    .slice(0, 5);
  const isSelf = Boolean(firebaseUser && currentProfile.universal_id === profile.universal_id);
  const canViewPrivate = isSelf || isAdmin;
  const avatarSrc = normalizeMediaImageUrl(profile.profile_image_url);

  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingVote) return;
    setSubmittingVote(true);
    try {
      const ok = await castRecognitionVote(profile.universal_id, direction, comment);
      if (ok) setComment('');
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const cleanImg = sanitizeExternalLink(editAvatar) || editAvatar.trim();
      const ok = await updateOwnProfile({
        full_name: editName.trim() || profile.full_name,
        entity_type: editEntity,
        country: editCountry.trim(),
        city: editCity.trim(),
        profile_image_url: cleanImg || profile.profile_image_url,
        contact_info: editContact.trim(),
      });
      if (ok) setEditingSelf(false);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-200 dark:bg-stone-800 shrink-0 flex items-center justify-center font-semibold text-lg text-stone-700 dark:text-stone-200">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={profile.full_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {profile.full_name
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-cinzel text-xl font-bold text-stone-900 dark:text-stone-100">
                  {profile.full_name}
                </h2>
                <span className="notranslate text-xs font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37]">
                  {profile.universal_id}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {profile.entity_type} · {metrics?.service_tier || 'Initiate'} · Status: {profile.user_status} · Avatar: {profile.image_verified_status}
              </p>
              {(profile.city || profile.country) && (
                <p className="text-xs text-stone-500 dark:text-stone-400 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSelf && (
              <button
                type="button"
                onClick={() => setEditingSelf((v) => !v)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {editingSelf ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setInspectedUid(null)}
              className="p-2 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isSelf && editingSelf && (
          <form
            onSubmit={handleSaveProfile}
            className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-3 text-xs"
          >
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              Update Verified Account Profile
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Entity Type</label>
                <select
                  value={editEntity}
                  onChange={(e) => setEditEntity(e.target.value as EntityType)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                >
                  <option value="Individual">Individual</option>
                  <option value="Family">Family</option>
                  <option value="Organization">Organization</option>
                  <option value="Governmental">Governmental</option>
                  <option value="Charity / Vulnerable Entity">Charity / Vulnerable Entity</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Country</label>
                <input
                  type="text"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">City</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Profile Image URL</label>
                <input
                  type="text"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Contact Info (Private)</label>
                <input
                  type="text"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Ledger Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-stone-200 dark:border-stone-800 pb-5">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Net Balance</p>
            <p className="text-lg font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              {metrics?.balance ?? 0} pts
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Hours Served</p>
            <p className="text-lg font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              {metrics?.hours_served ?? 0}h
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Avg Hardship</p>
            <p className="text-lg font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              {metrics?.average_hardship ?? 0} / 10
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Recognition</p>
            <p className="text-lg font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
              +{metrics?.upward_votes ?? 0} / -{metrics?.compensate_votes ?? 0}
            </p>
          </div>
        </div>

        {/* Authorized / Private Details */}
        {canViewPrivate ? (
          <div className="space-y-2 border-b border-stone-200 dark:border-stone-800 pb-4 text-xs text-stone-600 dark:text-stone-300">
            <div className="flex items-center gap-1.5 font-semibold text-stone-800 dark:text-stone-200">
              <Lock className="w-3.5 h-3.5 text-[#B88B1E] dark:text-[#D4AF37]" />
              <span>Authorized Account & Legacy Metadata</span>
            </div>
            <p>Email: {profile.email || 'Verified Session Account'}</p>
            <p>
              Absent-Period Threshold: {profile.absent_period_days} days · Successor:{' '}
              {profile.successor_email || 'Not configured'}
            </p>
            <p>
              Penalty Score: {profile.penalty_score} pts · Carried Balance: {profile.carried_balance} pts
            </p>
          </div>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-4">
            Private contact details, reference codes, and legacy succession settings are visible only to the account holder and administrators.
          </p>
        )}

        {/* Recent Service Activity */}
        <div className="space-y-2 border-b border-stone-200 dark:border-stone-800 pb-4">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
            Recent Cooperative Ledger Activity ({recentLogsForUser.length})
          </h3>
          {recentLogsForUser.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No recent service ledger entries for {profile.universal_id}.
            </p>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-36 overflow-y-auto text-xs">
              {recentLogsForUser.map((l) => {
                const isProvider = l.provider_uid === profile.universal_id;
                const counterpartyUid = isProvider ? l.recipient_uid : l.provider_uid;
                return (
                  <div key={l.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-mono-tabular text-stone-500">{l.logged_date}</span>
                      <span className="font-medium text-stone-900 dark:text-stone-100 truncate">
                        {l.service_type}
                      </span>
                      <span className="text-stone-500">
                        ({isProvider ? 'Served' : 'Received from'}
                      </span>
                      <UserAvatar universalId={counterpartyUid} showUid />
                      <span className="text-stone-500">)</span>
                    </div>
                    <span
                      className={`font-mono-tabular font-semibold shrink-0 ${
                        isProvider
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {isProvider ? `+${l.final_score}` : `${l.hours}h × H${l.hardship}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peer Recognition Audit Trail */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Peer Recognition Audit ({votesForUser.length})
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setInspectedUid(null);
                  setReportModalTarget({ type: 'Profile Image', id: profile.universal_id });
                }}
                className="text-xs text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Report Image
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectedUid(null);
                  setReportModalTarget({ type: 'User', id: profile.universal_id });
                }}
                className="text-xs text-rose-700 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Report User
              </button>
            </div>
          </div>

          {votesForUser.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No peer recognition entries recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-40 overflow-y-auto">
              {votesForUser.map((v) => (
                <div key={v.id} className="py-2 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-stone-500 dark:text-stone-400">From</span>
                      <UserAvatar universalId={v.recognizer_uid} showUid />
                      <span className="text-stone-400">·</span>
                      <span
                        className={
                          v.direction === 'UPWARD'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-amber-700 dark:text-amber-400 font-medium'
                        }
                      >
                        {v.direction}
                      </span>
                    </div>
                    <p className="text-stone-600 dark:text-stone-300">{v.comment}</p>
                  </div>
                  <span className="text-stone-400 font-mono-tabular shrink-0">
                    {v.created_at.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recognition Form */}
          {!isSelf && (
            <form onSubmit={handleSubmitVote} className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-3">
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Cast Peer Recognition for {profile.universal_id}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('UPWARD')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                    direction === 'UPWARD'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Upward Recognition
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('COMPENSATE')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                    direction === 'COMPENSATE'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Compensate (Corrective)
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Provide specific observable reason for audit trail..."
                  required
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={submittingVote}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {submittingVote ? 'Saving...' : 'Submit Vote'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
