/**
 * Ultra-fast CDN & Image URL optimizer.
 * Automatically injects WebP format and width constraints to prevent heavy image downloads.
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  width: number = 400,
  quality: number = 75
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    // Supabase Storage: keep original object/public URL (render/image requires paid Supabase Pro plan)
    if (trimmed.includes('.supabase.co/storage/v1/object/public/')) {
      return trimmed;
    }

    // Unsplash Images
    if (trimmed.includes('images.unsplash.com')) {
      const sep = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${sep}w=${width}&auto=format&q=${quality}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
