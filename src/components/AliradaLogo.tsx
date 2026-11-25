import React, { useState } from 'react';
import { ALIRADA_LOGO_URL } from '../lib/mediaUtils';

export const AliradaLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Alirada Crest"
      >
        <path
          d="M20 4L33 11.5V28.5L20 36L7 28.5V11.5L20 4Z"
          stroke="currentColor"
          strokeWidth="1.75"
          className="text-[#B88B1E] dark:text-[#D4AF37]"
        />
        <path
          d="M20 10L27 28H23.6L22.1 24H17.9L16.4 28H13L20 10ZM18.8 21.2H21.2L20 17.4L18.8 21.2Z"
          fill="currentColor"
          className="text-[#B88B1E] dark:text-[#D4AF37]"
        />
      </svg>
    );
  }

  return (
    <img
      src={ALIRADA_LOGO_URL}
      alt="Alirada"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-contain shrink-0 bg-transparent border-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
