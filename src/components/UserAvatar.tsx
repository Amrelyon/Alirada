import React, { useState } from 'react';
import { useAlirada } from '../context/AliradaContext';
import { normalizeMediaImageUrl } from '../lib/mediaUtils';

interface UserAvatarProps {
  universalId: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showUid?: boolean;
  onClick?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  universalId,
  size = 'sm',
  showName = false,
  showUid = false,
  onClick,
}) => {
  const { profiles, setInspectedUid, setAuthModalOpen } = useAlirada();
  const [imgError, setImgError] = useState(false);

  const profile = profiles.find((p) => p.universal_id === universalId);
  const displayName =
    universalId === 'GUEST' ? 'Guest Visitor' : profile?.full_name || universalId;
  const imgUrl = normalizeMediaImageUrl(profile?.profile_image_url);

  const dimClass =
    size === 'lg' ? 'w-14 h-14 text-base' : size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[11px]';

  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => {
        if (onClick) {
          onClick();
        } else if (universalId === 'GUEST') {
          setAuthModalOpen(true);
        } else {
          setInspectedUid(universalId);
        }
      }}
      className="inline-flex items-center gap-2 text-start group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-md"
      title={
        universalId === 'GUEST'
          ? 'Sign in to access your Alirada account'
          : `View profile of ${displayName} (${universalId})`
      }
    >
      <span
        className={`${dimClass} rounded-full overflow-hidden shrink-0 border border-stone-300 dark:border-stone-700 group-hover:border-[#B88B1E] dark:group-hover:border-[#D4AF37] bg-stone-200 dark:bg-stone-800 flex items-center justify-center font-semibold text-stone-700 dark:text-stone-200 transition-colors`}
      >
        {imgUrl && !imgError ? (
          <img
            src={imgUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </span>
      {(showName || showUid) && (
        <span className="min-w-0 leading-tight">
          {showName && (
            <span className="block text-sm font-medium text-stone-900 dark:text-stone-100 group-hover:text-[#B88B1E] dark:group-hover:text-[#D4AF37] group-hover:underline transition-colors truncate">
              {displayName}
            </span>
          )}
          {showUid && (
            <span className="notranslate block text-xs font-mono-tabular text-stone-500 dark:text-stone-400 group-hover:text-[#B88B1E] dark:group-hover:text-[#D4AF37] group-hover:underline transition-colors">
              {universalId}
            </span>
          )}
        </span>
      )}
    </button>
  );
};
