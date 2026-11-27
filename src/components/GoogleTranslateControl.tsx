import React, { useEffect, useRef, useState } from 'react';
import { Languages, X } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement?: new (
          options: { pageLanguage: string; autoDisplay?: boolean },
          elementId: string
        ) => void;
      };
    };
  }
}

const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'ku', 'sd', 'yi']);

function readGoogTransCookie(): string {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return 'en';
  try {
    const val = decodeURIComponent(match[1]);
    const parts = val.split('/');
    const target = parts[parts.length - 1];
    return target || 'en';
  } catch {
    return 'en';
  }
}

function clearGoogTransCookies(): void {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = ['', host, `.${host}`];
  if (parts.length >= 2) {
    const rootDomain = `.${parts.slice(-2).join('.')}`;
    domains.push(rootDomain);
  }
  const paths = ['/', window.location.pathname];
  for (const p of paths) {
    for (const d of domains) {
      const domainAttr = d ? `; domain=${d}` : '';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${p}${domainAttr}`;
    }
  }
}

export const GoogleTranslateControl: React.FC = () => {
  const { pushToast } = useAlirada();
  const [selectedLang, setSelectedLang] = useState<string>(() => readGoogTransCookie());
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const clean = selectedLang.split('-')[0].toLowerCase();
    const isRtl =
      RTL_LANGS.has(clean) || document.documentElement.classList.contains('translated-rtl');
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = selectedLang || 'en';
  }, [selectedLang]);

  useEffect(() => {
    const attachComboListener = () => {
      const combo = document.querySelector<HTMLSelectElement>(
        '#google_translate_element select.goog-te-combo'
      );
      if (!combo) return false;
      setWidgetLoaded(true);

      const handleChange = () => {
        const val = combo.value || 'en';
        setSelectedLang(val);
      };

      combo.onchange = handleChange;
      if (combo.value && combo.value !== selectedLang) {
        setSelectedLang(combo.value);
      }
      return true;
    };

    const initWidget = () => {
      const host = document.getElementById('google_translate_element');
      if (!host) return;
      if (host.querySelector('select.goog-te-combo')) {
        attachComboListener();
        return;
      }
      if (window.google?.translate?.TranslateElement) {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              autoDisplay: false,
            },
            'google_translate_element'
          );
        } catch {
          // ignore duplicate init attempts
        }
      }
    };

    window.googleTranslateElementInit = () => {
      initWidget();
    };

    // Observe Google Translate DOM injection & suppress banner inline shifts
    const obs = new MutationObserver(() => {
      attachComboListener();
      if (document.body.style.top && document.body.style.top !== '0px') {
        document.body.style.top = '0px';
      }
      if (document.documentElement.style.top && document.documentElement.style.top !== '0px') {
        document.documentElement.style.top = '0px';
      }
      if (document.documentElement.classList.contains('translated-rtl') && document.documentElement.dir !== 'rtl') {
        document.documentElement.dir = 'rtl';
      } else if (
        document.documentElement.classList.contains('translated-ltr') &&
        document.documentElement.dir !== 'ltr'
      ) {
        document.documentElement.dir = 'ltr';
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    observerRef.current = obs;

    if (window.google?.translate?.TranslateElement) {
      initWidget();
    } else if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.onerror = () => {
        setWidgetLoaded(false);
      };
      document.body.appendChild(script);
    }

    return () => {
      obs.disconnect();
    };
  }, []);

  const handleResetToDefault = () => {
    clearGoogTransCookies();

    // 1) Try clicking Google Translate's built-in "Show original" inside the hidden banner iframe
    let restoredViaBanner = false;
    try {
      const bannerFrame = document.querySelector<HTMLIFrameElement>(
        'iframe.goog-te-banner-frame, iframe.VIpgJd-ZVi9od-ORHb-OEVmcd'
      );
      const doc = bannerFrame?.contentDocument || bannerFrame?.contentWindow?.document;
      if (doc) {
        const restoreBtn =
          doc.querySelector<HTMLElement>('[id=":1.restore"]') ||
          doc.querySelector<HTMLElement>('button[id*="restore"]');
        if (restoreBtn) {
          restoreBtn.click();
          restoredViaBanner = true;
        }
      }
    } catch {
      // Cross-origin frame access ignored cleanly
    }

    // 2) Fallback: drive .goog-te-combo back to English
    const combo = document.querySelector<HTMLSelectElement>(
      '#google_translate_element select.goog-te-combo'
    );
    if (!restoredViaBanner && combo) {
      const hasEnOption = Array.from(combo.options).some((opt) => opt.value === 'en');
      combo.value = hasEnOption ? 'en' : '';
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    clearGoogTransCookies();
    document.body.style.top = '0px';
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    setSelectedLang('en');
    pushToast('success', 'Language restored to default (English).');
  };

  const isTranslated = Boolean(selectedLang && selectedLang !== 'en');

  return (
    <div className="notranslate inline-flex items-center rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#0B0D10] px-2 py-1 gap-1.5 min-h-[30px] max-w-[128px] sm:max-w-[180px] overflow-hidden shrink-0">
      <Languages className="w-3.5 h-3.5 text-stone-400 shrink-0" />
      <div id="google_translate_element" className="notranslate inline-flex items-center" />
      {!widgetLoaded && (
        <span className="text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap">
          Translate
        </span>
      )}
      {isTranslated && (
        <button
          type="button"
          onClick={handleResetToDefault}
          title="Restore default language (English)"
          aria-label="Restore default language"
          className="ml-0.5 p-0.5 rounded text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
