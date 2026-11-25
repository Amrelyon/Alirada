/**
 * Normalizes Imgur and Google Drive links for reliable rendering, validates safe URLs,
 * and parses YouTube/Vimeo links into embeddable iframe URLs.
 */

export const ALIRADA_LOGO_URL = 'https://i.imgur.com/LkCssoJ.png';

export function isSafeHttpUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeMediaImageUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  const url = rawUrl.trim();
  if (!isSafeHttpUrl(url)) return '';

  // Imgur page link -> direct image
  const imgurMatch = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)(?:\.[a-zA-Z]+)?$/i);
  if (imgurMatch) {
    return `https://i.imgur.com/${imgurMatch[1]}.png`;
  }

  // Google Drive sharing link -> lh3 direct view
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveFileMatch) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
  }
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (driveOpenMatch) {
    return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}`;
  }

  if (url.startsWith('/src/assets/')) {
    const rawBase = import.meta.env.BASE_URL || '/';
    if (rawBase === './' || rawBase === '.') {
      return `.${url}`;
    }
    const base = rawBase.replace(/\/$/, '');
    return `${base}${url}`;
  }

  return url;
}

export function getEmbeddableVideoUrl(rawUrl?: string): string | null {
  if (!rawUrl || !isSafeHttpUrl(rawUrl)) return null;
  const url = rawUrl.trim();

  // YouTube standard or short link
  const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/);
  if (ytWatch) {
    return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}?rel=0`;
  }

  // Vimeo link
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Google Drive video preview
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Direct mp4/webm
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return url;
  }

  return null;
}

export function sanitizeExternalLink(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  return isSafeHttpUrl(trimmed) ? trimmed : undefined;
}
