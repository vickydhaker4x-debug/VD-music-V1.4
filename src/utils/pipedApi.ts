import { Track } from '../types';

export const PIPED_INSTANCES = [
  'https://api.piped.privacydev.net',
  'https://pipedapi.ducks.party',
  'https://pipedapi.nosebs.ru',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.projectsegfau.lt'
];

export const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pizza',
  'https://invidious.no-valat.net',
  'https://vid.priv.au',
  'https://invidious.flokinet.to',
  'https://invidious.einfachzocken.eu'
];

// Helper to format seconds to mm:ss
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '3:30';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Return reliable thumbnail for YouTube/Invidious video IDs
 */
export function getSafeThumbnailUrl(videoId?: string, rawThumb?: string): string {
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }
  if (rawThumb && rawThumb.startsWith('http')) {
    return rawThumb.replace('/hqdefault.jpg', '/mqdefault.jpg');
  }
  return '/vd_music_logo.jpg';
}

// Fetch with timeout and optional external AbortSignal (for zero-latency offline abort)
async function fetchWithTimeout(url: string, timeoutMs: number = 4000, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(id);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Search tracks across reliable Invidious and Piped instances
 */
export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  if (!query.trim()) return [];

  const invidiousPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const res = await fetchWithTimeout(url, 4500, signal);
    if (!res.ok) throw new Error('Not ok');
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
    
    return items.slice(0, 20).map((item: any) => {
      const videoId = item.videoId;
      return {
        id: `inv-${videoId}`,
        title: item.title || 'Untitled Song',
        artist: item.author || 'Popular Artist',
        album: 'VD Music High-Fidelity',
        duration: formatDuration(item.lengthSeconds),
        durationSec: item.lengthSeconds || 210,
        coverUrl: getSafeThumbnailUrl(videoId, item.videoThumbnails?.[0]?.url),
        quality: '320kbps High Quality',
        videoId: videoId,
        isFavorite: false
      };
    });
  });

  const pipedPromises = PIPED_INSTANCES.map(async (instance) => {
    const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
    const res = await fetchWithTimeout(url, 4000, signal);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    const items = data.items || [];
    if (items.length === 0) throw new Error('No items');
    
    return items.slice(0, 20).map((item: any) => {
      const videoId = (item.url || '').replace('/watch?v=', '');
      return {
        id: `piped-${videoId || Math.random().toString(36).substring(2, 9)}`,
        title: item.title || 'Untitled Song',
        artist: item.uploaderName || 'Popular Artist',
        album: 'VD Music High-Fidelity',
        duration: formatDuration(item.duration),
        durationSec: item.duration || 210,
        coverUrl: getSafeThumbnailUrl(videoId, item.thumbnail),
        quality: '320kbps High Quality',
        videoId: videoId,
        isFavorite: false
      };
    });
  });

  try {
    // Try to get fastest result from any instance
    return await Promise.any([...invidiousPromises, ...pipedPromises]);
  } catch (err) {
    return [];
  }
}

/**
 * Get direct playable audio stream URL for a given video ID
 */
export async function getAudioStreamUrl(videoId: string): Promise<string | null> {
  if (!videoId) return null;

  const invidiousStreamPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const url = `${instance}/api/v1/videos/${videoId}`;
    const res = await fetchWithTimeout(url, 4500);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    const formats = data.adaptiveFormats || [];
    const audioFormats = formats.filter((f: any) => f.type && f.type.startsWith('audio/'));
    if (audioFormats.length > 0) {
      const sorted = audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = sorted[0];
      if (best && best.url) {
        return best.url;
      }
    }
    throw new Error('No stream found');
  });

  const pipedStreamPromises = PIPED_INSTANCES.map(async (instance) => {
    const url = `${instance}/streams/${videoId}`;
    const res = await fetchWithTimeout(url, 4000);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    const audioStreams = data.audioStreams || [];
    if (audioStreams.length > 0) {
      const sorted = audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = sorted[0];
      if (best && best.url) {
        return best.url;
      }
    }
    throw new Error('No stream found');
  });

  try {
    return await Promise.any([...invidiousStreamPromises, ...pipedStreamPromises]);
  } catch (err) {
    // Fallback direct endpoint
    for (const instance of INVIDIOUS_INSTANCES) {
      return `${instance}/latest_version?id=${videoId}&itag=140`;
    }
    return null;
  }
}

/**
 * Fetch related / recommended tracks for YouTube Music style queue & personalization
 */
export async function getRelatedTracksFromVideo(videoId: string, artist?: string): Promise<Track[]> {
  if (!videoId) {
    if (artist) {
      return searchTracks(`${artist} songs`);
    }
    return [];
  }

  // Strategy 1: Fetch recommendedVideos from Invidious video metadata
  const invidiousPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const url = `${instance}/api/v1/videos/${videoId}`;
    const res = await fetchWithTimeout(url, 4000);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    const recommended = data.recommendedVideos || [];
    if (!Array.isArray(recommended) || recommended.length === 0) throw new Error('No items');
    
    return recommended.slice(0, 20).map((item: any) => {
      const recVideoId = item.videoId;
      return {
        id: `yt-rec-${recVideoId}`,
        title: item.title || 'Recommended Song',
        artist: item.author || artist || 'Suggested Artist',
        album: 'YouTube Music Mix',
        duration: formatDuration(item.lengthSeconds),
        durationSec: item.lengthSeconds || 210,
        coverUrl: getSafeThumbnailUrl(recVideoId, item.videoThumbnails?.[0]?.url),
        quality: '320kbps High Quality',
        videoId: recVideoId,
        isFavorite: false
      };
    });
  });

  try {
    return await Promise.any(invidiousPromises);
  } catch (err) {
    // Strategy 2: If recommendedVideos not available, search for artist's similar tracks
    if (artist && artist.trim().length > 0) {
      try {
        const results = await searchTracks(`${artist} songs`);
        if (results.length > 0) {
          return results.filter(r => r.videoId !== videoId);
        }
      } catch {
        // ignore
      }
    }
    return [];
  }
}

/**
 * Fetch online search suggestion queries from Invidious & Piped
 */
export async function fetchSearchSuggestions(query: string): Promise<string[]> {
  const clean = query.trim();
  if (!clean) return [];

  const invidiousSuggestions = INVIDIOUS_INSTANCES.slice(0, 4).map(async (instance) => {
    const url = `${instance}/api/v1/search/suggestions?q=${encodeURIComponent(clean)}`;
    const res = await fetchWithTimeout(url, 2200);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions as string[];
    }
    throw new Error('No suggestions');
  });

  const pipedSuggestions = PIPED_INSTANCES.slice(0, 3).map(async (instance) => {
    const url = `${instance}/suggestions?query=${encodeURIComponent(clean)}`;
    const res = await fetchWithTimeout(url, 2200);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data as string[];
    }
    throw new Error('No suggestions');
  });

  try {
    const results = await Promise.any([...invidiousSuggestions, ...pipedSuggestions]);
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

