import { Listing, TransactionRef } from '../types/alirada';
import { getEmbeddableVideoUrl, normalizeMediaImageUrl, sanitizeExternalLink } from './mediaUtils';

export interface WidgetPreviewSnapshot {
  ref_code: string;
  widget_name?: string;
  description?: string;
  points_amount: number;
  payment_model: string;
  issuer_uid: string;
  trigger_type: string;
  linked_listing_code?: string;
  listing_type?: string;
  category?: string;
  image_url?: string;
  video_url?: string;
  location?: string;
  google_map_link?: string;
  project_name?: string;
}

function toBase64Url(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function fromBase64Url(token: string): string {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export function encodeWidgetPreview(
  ref: TransactionRef,
  linkedListing?: Listing,
  projectName?: string
): string {
  const rawVideo = linkedListing?.video_url
    ? getEmbeddableVideoUrl(linkedListing.video_url)
    : null;
  const rawMapLink = linkedListing?.google_map_link
    ? sanitizeExternalLink(linkedListing.google_map_link)
    : undefined;
  const payload: WidgetPreviewSnapshot = {
    ref_code: ref.ref_code,
    widget_name: linkedListing?.title || ref.widget_name || undefined,
    description: (linkedListing?.description || ref.description || '').slice(0, 260) || undefined,
    points_amount: linkedListing ? linkedListing.price_points : ref.points_amount,
    payment_model: linkedListing?.payment_model || ref.payment_model,
    issuer_uid: linkedListing?.owner_uid || ref.issuer_uid,
    trigger_type: ref.trigger_type,
    linked_listing_code: linkedListing?.listing_code || ref.linked_listing_code || undefined,
    listing_type: linkedListing?.listing_type || undefined,
    category: linkedListing?.category || undefined,
    image_url: linkedListing?.image_urls?.[0]
      ? normalizeMediaImageUrl(linkedListing.image_urls[0]).slice(0, 320) || undefined
      : undefined,
    video_url: rawVideo ? rawVideo.slice(0, 240) : undefined,
    location: linkedListing?.location || undefined,
    google_map_link: rawMapLink ? rawMapLink.slice(0, 240) : undefined,
    project_name: projectName || undefined,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeWidgetPreviewFromSearch(search: string): WidgetPreviewSnapshot | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('wp');
    if (!raw) return null;
    const json = fromBase64Url(raw.trim());
    if (!json) return null;
    const parsed = JSON.parse(json) as Partial<WidgetPreviewSnapshot>;
    if (!parsed || typeof parsed !== 'object' || !parsed.ref_code) return null;
    const safeVideo = parsed.video_url ? getEmbeddableVideoUrl(String(parsed.video_url)) : null;
    return {
      ref_code: String(parsed.ref_code).trim().toUpperCase(),
      widget_name: parsed.widget_name ? String(parsed.widget_name) : undefined,
      description: parsed.description ? String(parsed.description) : undefined,
      points_amount: Number(parsed.points_amount) || 0,
      payment_model: parsed.payment_model ? String(parsed.payment_model) : 'One-Time',
      issuer_uid: parsed.issuer_uid ? String(parsed.issuer_uid) : '',
      trigger_type: parsed.trigger_type ? String(parsed.trigger_type) : 'None',
      linked_listing_code: parsed.linked_listing_code ? String(parsed.linked_listing_code) : undefined,
      listing_type: parsed.listing_type ? String(parsed.listing_type) : undefined,
      category: parsed.category ? String(parsed.category) : undefined,
      image_url: parsed.image_url ? normalizeMediaImageUrl(String(parsed.image_url)) || undefined : undefined,
      video_url: safeVideo || undefined,
      location: parsed.location ? String(parsed.location) : undefined,
      google_map_link: parsed.google_map_link ? sanitizeExternalLink(String(parsed.google_map_link)) : undefined,
      project_name: parsed.project_name ? String(parsed.project_name) : undefined,
    };
  } catch {
    return null;
  }
}
