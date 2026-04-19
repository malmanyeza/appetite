/**
 * Utility to resolve Supabase storage URLs with cache-busting.
 *
 * Images are stored at whatever path the dashboard uploaded them to
 * (e.g. /restaurants/, /menu-items/, etc.). We do NOT remap folders —
 * we just add a ?t= cache-buster so expo-image re-downloads when
 * the record's updated_at timestamp changes.
 */

export const getOptimizedImageUrl = (
    url: string | null | undefined,
    _type: 'thumbnail' | 'original' = 'thumbnail', // kept for API compatibility, unused
    cacheBust?: string | number | null
): string | null => {
    if (!url) return null;

    // Strip any existing cache-buster query param so we don't stack them
    const base = url.split('?')[0];

    if (cacheBust) {
        // Convert ISO date string to unix ms timestamp for a compact, stable buster
        const ts = typeof cacheBust === 'string'
            ? new Date(cacheBust).getTime()
            : cacheBust;
        return `${base}?t=${ts}`;
    }

    return base;
};

export const getThumbnailUrl = (url: string | null | undefined, cacheBust?: string | number | null) =>
    getOptimizedImageUrl(url, 'thumbnail', cacheBust);

export const getOriginalUrl = (url: string | null | undefined, cacheBust?: string | number | null) =>
    getOptimizedImageUrl(url, 'original', cacheBust);
