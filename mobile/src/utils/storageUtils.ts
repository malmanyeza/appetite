/**
 * Utility to resolve optimized Supabase storage URLs.
 * Since we are on the Free Plan (Option B), we manually route to /thumbnails or /originals folders.
 */

const STORAGE_URL = 'https://zmsactoninhdtngtlyep.supabase.co/storage/v1/object/public/restaurant-assets';

export const getOptimizedImageUrl = (url: string | null | undefined, type: 'thumbnail' | 'original' = 'thumbnail') => {
    if (!url) return null;

    // If it's already an Unsplash URL, we let it be (since it has its own resizing)
    if (url.includes('unsplash.com')) {
        return url;
    }

    // If it's a Supabase URL for our restaurant-assets bucket
    if (url.includes('restaurant-assets')) {
        // Extract the filename (everything after the last slash)
        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        
        // Route to the appropriate manual folder
        const folder = type === 'thumbnail' ? 'thumbnails' : 'originals';
        return `${STORAGE_URL}/${folder}/${filename}`;
    }

    return url;
};

export const getThumbnailUrl = (url: string | null | undefined) => getOptimizedImageUrl(url, 'thumbnail');
export const getOriginalUrl = (url: string | null | undefined) => getOptimizedImageUrl(url, 'original');
