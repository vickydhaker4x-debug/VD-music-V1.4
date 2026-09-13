import { Track, Album, Artist, Playlist, MusicMix, ContextualSearchResults, EnrichedTrackSearchResult } from '../types';
import { TRACKS } from '../data/musicData';
import { YTM_PERSONALIZED_MIXES } from '../data/ytmModulesData';
import { extractAlbums, extractArtists } from './libraryDataService';
import { lyricsService } from './lyricsService';

function getUserPlaylists(): Playlist[] {
  try {
    const saved = localStorage.getItem('vd_user_playlists');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Common musical typo dictionary & transliteration mappings
 */
const KNOWN_TYPO_CORRECTIONS: Record<string, string> = {
  arjit: 'Arijit',
  arijeet: 'Arijit',
  'arjit singh': 'Arijit Singh',
  weaknd: 'The Weeknd',
  weekend: 'The Weeknd',
  'the weekend': 'The Weeknd',
  punjbi: 'Punjabi',
  kesriya: 'Kesariya',
  kesariya: 'Kesariya',
  kesariyaa: 'Kesariya',
  apdhillon: 'AP Dhillon',
  dhillon: 'AP Dhillon',
  sidhu: 'Sidhu Moosewala',
  moosewala: 'Sidhu Moosewala',
  moosetape: 'Sidhu Moosewala',
  diljit: 'Diljit Dosanjh',
  dosanjh: 'Diljit Dosanjh',
  alan: 'Alan Walker',
  alanwalkr: 'Alan Walker',
  walker: 'Alan Walker',
  faded: 'Faded',
  pritham: 'Pritam',
  channa: 'Channa Mereya',
  brown: 'Brown Munde',
  munde: 'Brown Munde',
  shreya: 'Shreya Ghoshal',
  ghoshal: 'Shreya Ghoshal',
  darshan: 'Darshan Raval',
  raval: 'Darshan Raval',
  badshah: 'Badshah',
  honey: 'Honey Singh',
  lofi: 'Lofi',
  'lo-fi': 'Lofi',
  blinding: 'Blinding Lights',
  starboy: 'Starboy'
};

/**
 * Compute Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize string for resilient searching
 */
function clean(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a word fuzzy matches target
 */
function isFuzzyMatch(word: string, target: string): boolean {
  if (!word || !target) return false;
  if (target.includes(word) || word.includes(target)) return true;

  const maxDistance = word.length <= 4 ? 1 : word.length <= 8 ? 2 : 3;
  return levenshteinDistance(word, target) <= maxDistance;
}

/**
 * Score text against query tokens
 */
function scoreMatch(text: string, query: string, weight = 1): number {
  const cleanText = clean(text);
  const cleanQuery = clean(query);

  if (!cleanQuery) return 0;
  if (cleanText === cleanQuery) return 100 * weight;
  if (cleanText.startsWith(cleanQuery)) return 85 * weight;
  if (cleanText.includes(cleanQuery)) return 70 * weight;

  const textTokens = cleanText.split(' ');
  const queryTokens = cleanQuery.split(' ');

  let matchedTokens = 0;
  let fuzzyBonus = 0;

  for (const qToken of queryTokens) {
    if (qToken.length < 2) continue;
    let found = false;

    for (const tToken of textTokens) {
      if (tToken === qToken) {
        matchedTokens++;
        fuzzyBonus += 15;
        found = true;
        break;
      } else if (isFuzzyMatch(qToken, tToken)) {
        matchedTokens++;
        fuzzyBonus += 8;
        found = true;
        break;
      }
    }
  }

  if (matchedTokens > 0) {
    return (matchedTokens / queryTokens.length) * 50 * weight + fuzzyBonus;
  }

  return 0;
}

export const searchEngine = {
  /**
   * Check if query has a known typo and suggest correction
   */
  detectTypoCorrection(rawQuery: string): string | null {
    const q = clean(rawQuery);
    if (!q) return null;

    if (KNOWN_TYPO_CORRECTIONS[q]) {
      return KNOWN_TYPO_CORRECTIONS[q];
    }

    // Check individual tokens
    const words = q.split(' ');
    let changed = false;
    const correctedWords = words.map((w) => {
      if (KNOWN_TYPO_CORRECTIONS[w]) {
        changed = true;
        return KNOWN_TYPO_CORRECTIONS[w];
      }
      return w;
    });

    if (changed) {
      return correctedWords.join(' ');
    }

    // Check fuzzy match against known artist names
    const catalogArtists = [
      'Arijit Singh',
      'Sidhu Moosewala',
      'AP Dhillon',
      'The Weeknd',
      'Pritam',
      'Alan Walker',
      'Diljit Dosanjh',
      'Shreya Ghoshal',
      'Karan Aujla',
      'Taylor Swift',
      'Darshan Raval',
      'Sachin-Jigar',
      'Badshah',
      'Jasleen Royal'
    ];

    for (const artist of catalogArtists) {
      const cleanArtist = clean(artist);
      if (cleanArtist !== q && isFuzzyMatch(q, cleanArtist)) {
        return artist;
      }
    }

    return null;
  },

  /**
   * Powerful contextual search across Songs (Title, Artist, Album, and Timed Lyrics),
   * Albums, Artists, and Playlists.
   */
  search(
    rawQuery: string,
    catalog: Track[] = TRACKS,
    userPlaylists: Playlist[] = getUserPlaylists()
  ): ContextualSearchResults {
    const cleanQuery = clean(rawQuery);

    if (!cleanQuery) {
      return {
        query: rawQuery,
        hasTypoCorrection: false,
        songs: [],
        albums: [],
        artists: [],
        playlists: []
      };
    }

    const correctedQuery = this.detectTypoCorrection(rawQuery);
    const hasTypoCorrection = Boolean(correctedQuery && clean(correctedQuery) !== cleanQuery);
    const effectiveQuery = correctedQuery || rawQuery;

    // 1. Search Songs (Title, Artist, Album, and Lyrics)
    const songResults: EnrichedTrackSearchResult[] = [];

    catalog.forEach((track) => {
      const titleScore = scoreMatch(track.title, effectiveQuery, 1.2);
      const artistScore = scoreMatch(track.artist, effectiveQuery, 1.1);
      const albumScore = scoreMatch(track.album || '', effectiveQuery, 0.9);
      const genreScore = scoreMatch(track.genre || '', effectiveQuery, 0.7);

      let maxMetaScore = Math.max(titleScore, artistScore, albumScore, genreScore);

      // Search inside track lyrics
      let lyricMatchDetail: { matchedLine: string; timestampSec: number } | undefined;
      const lyrics = lyricsService.getTrackLyrics(track);

      for (const line of lyrics) {
        if (!line.text.startsWith('♪')) {
          const lScore = scoreMatch(line.text, effectiveQuery, 0.95);
          if (lScore > 20) {
            maxMetaScore = Math.max(maxMetaScore, lScore);
            lyricMatchDetail = {
              matchedLine: line.text,
              timestampSec: line.time
            };
            break;
          }
        }
      }

      if (maxMetaScore > 10) {
        songResults.push({
          ...track,
          matchScore: maxMetaScore,
          lyricMatch: lyricMatchDetail
        });
      }
    });

    songResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    // 2. Search Albums
    const allAlbums = extractAlbums(catalog);
    const albumResults: Album[] = [];

    allAlbums.forEach((alb) => {
      const titleScore = scoreMatch(alb.title, effectiveQuery, 1.2);
      const artistScore = scoreMatch(alb.artist, effectiveQuery, 1.0);
      if (Math.max(titleScore, artistScore) > 12) {
        albumResults.push(alb);
      }
    });

    // 3. Search Artists
    const allArtists = extractArtists(catalog, allAlbums);
    const artistResults: Artist[] = [];

    allArtists.forEach((art) => {
      const nameScore = scoreMatch(art.name, effectiveQuery, 1.3);
      const genreScore = (art.genres || []).some((g) => scoreMatch(g, effectiveQuery) > 15) ? 25 : 0;
      if (Math.max(nameScore, genreScore) > 15) {
        artistResults.push(art);
      }
    });

    // 4. Search Playlists & Personalized Mixes
    const playlistResults: (Playlist | MusicMix)[] = [];

    // Check user playlists
    userPlaylists.forEach((pl) => {
      const nameScore = scoreMatch(pl.name, effectiveQuery, 1.2);
      const descScore = scoreMatch(pl.description || '', effectiveQuery, 0.8);
      if (Math.max(nameScore, descScore) > 12) {
        playlistResults.push(pl);
      }
    });

    // Check YTM curated mixes
    YTM_PERSONALIZED_MIXES.forEach((mix) => {
      const titleScore = scoreMatch(mix.title, effectiveQuery, 1.2);
      const subScore = scoreMatch(mix.subtitle, effectiveQuery, 1.0);
      if (Math.max(titleScore, subScore) > 12) {
        playlistResults.push(mix);
      }
    });

    // 5. Determine Top Result
    let topResult: ContextualSearchResults['topResult'] = undefined;

    const topArtist = artistResults[0];
    const topSong = songResults[0];
    const topAlbum = albumResults[0];

    // Priority: Exact artist match usually wins in music apps, else top scored song
    if (topArtist && clean(topArtist.name) === clean(effectiveQuery)) {
      topResult = { type: 'artist', item: topArtist };
    } else if (topSong && (topSong.matchScore || 0) >= 50) {
      topResult = { type: 'song', item: topSong };
    } else if (topArtist) {
      topResult = { type: 'artist', item: topArtist };
    } else if (topAlbum) {
      topResult = { type: 'album', item: topAlbum };
    } else if (topSong) {
      topResult = { type: 'song', item: topSong };
    }

    return {
      query: rawQuery,
      correctedQuery: hasTypoCorrection ? correctedQuery || undefined : undefined,
      hasTypoCorrection,
      topResult,
      songs: songResults,
      albums: albumResults,
      artists: artistResults,
      playlists: playlistResults
    };
  }
};
