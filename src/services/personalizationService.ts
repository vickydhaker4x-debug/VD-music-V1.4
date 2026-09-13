import { Track, Album, FavoriteItem, MusicMix, UserTastePreferences } from '../types';
import { TRACKS, RELATED_ALBUMS } from '../data/musicData';
import { getRelatedTracksFromVideo } from '../utils/pipedApi';

export interface ExtendedTasteProfile {
  lastPlayedTrack: Track | null;
  recentSeeds: Track[];
  favoriteArtists: string[];
  favoriteGenres: string[];
  onboardingCompleted: boolean;
  listens: Record<string, number>;
  skips: Record<string, number>;
  loops: Record<string, number>;
  likes: string[];
  dislikes: string[];
  topArtists: Record<string, number>;
  topGenres: Record<string, number>;
  activeVibe: string;
}

export interface PersonalizedHomeData {
  vibeBadge: string;
  basedOnSection: {
    title: string;
    subtitle: string;
    tracks: Track[];
  };
  quickPicks: Track[];
  similarTastes: FavoriteItem[];
  relatedAlbums: Album[];
  radioName: string;
  radioVibe: string;
  curatedMixes: MusicMix[];
}

const STORAGE_KEY = 'vd_music_taste_profile_v2';

/**
 * Smart Vibe & Genre Classifier (supports Bollywood, Punjabi, EDM, Lo-Fi, Pop, Hip-Hop, etc.)
 */
export function detectVibeAndGenre(track: Partial<Track>): { vibe: string; category: string } {
  const text = `${track.title || ''} ${track.artist || ''} ${track.album || ''} ${track.genre || ''}`.toLowerCase();

  // 1. Bollywood & Hindi Romance
  if (
    /arijit|jubin|atif|shreya|pritam|neha|sonu|armaan|sachin|jigar|kesariya|tum hi ho|raataan|channa|apna bana|shayad|agar tum|satranga|bollywood|hindi|romantic|t-series|filmi|soulful/i.test(text)
  ) {
    return { vibe: 'Bollywood Melody & Romance', category: 'bollywood' };
  }

  // 2. Punjabi & Desi Beats
  if (
    /sidhu|moose|ap dhillon|diljit|karan aujla|shubh|amrit|honey singh|badshah|punjabi|brown munde|elevated|so high|jatt|desihood|cheques|softly/i.test(text)
  ) {
    return { vibe: 'Punjabi Pop & Urban Beats', category: 'punjabi' };
  }

  // 3. Electronic & Dance / EDM
  if (
    /alan walker|marshmello|chainsmokers|garrix|avicii|goose|synrise|remix|edm|electronic|house|techno|dance|tiesto|guetta|djs|faded/i.test(text)
  ) {
    return { vibe: 'High-Energy Electronic & EDM', category: 'electronic' };
  }

  // 4. Chill Lo-Fi & Downtempo
  if (
    /emancipator|bonobo|tycho|koresma|tor|lofi|lo-fi|dusk|chill|relax|ambient|study|sleep|downtempo|trip hop|acoustic|sauda|preet/i.test(text)
  ) {
    return { vibe: 'Midnight Chillout & Lo-Fi', category: 'chillout' };
  }

  // 5. Hip-Hop & Rap / Trap
  if (
    /drake|eminem|travis|post malone|kendrick|divine|stan|emiway|rap|hip hop|trap|drill|flow/i.test(text)
  ) {
    return { vibe: 'Urban Hip-Hop & Trap', category: 'hiphop' };
  }

  // 6. Global Pop & Hits
  if (
    /the weeknd|taylor swift|ed sheeran|billie eilish|dua lipa|ariana|bieber|starboy|blinding lights|pop|chart/i.test(text)
  ) {
    return { vibe: 'Global Pop & Trending Hits', category: 'pop' };
  }

  // 7. Indie, Rock & Alternative
  if (
    /coldplay|imagine dragons|arctic monkeys|queen|nirvana|rock|indie|alternative|acoustic/i.test(text)
  ) {
    return { vibe: 'Indie Atmosphere & Acoustic', category: 'indie' };
  }

  return { vibe: 'Personalized Daily Mix', category: 'eclectic' };
}

class PersonalizationService {
  private profile: ExtendedTasteProfile;
  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.profile = this.loadProfile();
  }

  private loadProfile(): ExtendedTasteProfile {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            lastPlayedTrack: parsed.lastPlayedTrack || null,
            recentSeeds: parsed.recentSeeds || [],
            favoriteArtists: parsed.favoriteArtists || [],
            favoriteGenres: parsed.favoriteGenres || [],
            onboardingCompleted: Boolean(parsed.onboardingCompleted),
            listens: parsed.listens || {},
            skips: parsed.skips || {},
            loops: parsed.loops || {},
            likes: parsed.likes || [],
            dislikes: parsed.dislikes || [],
            topArtists: parsed.topArtists || {},
            topGenres: parsed.topGenres || {},
            activeVibe: parsed.activeVibe || 'Personalized Mix'
          };
        }
      } catch {
        // ignore
      }
    }

    return {
      lastPlayedTrack: null,
      recentSeeds: [],
      favoriteArtists: [],
      favoriteGenres: [],
      onboardingCompleted: false,
      listens: {},
      skips: {},
      loops: {},
      likes: [],
      dislikes: [],
      topArtists: {},
      topGenres: {},
      activeVibe: 'Personalized Mix'
    };
  }

  private saveProfile() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    this.subscribers.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  public getProfile(): ExtendedTasteProfile {
    return this.profile;
  }

  public isColdStartCompleted(): boolean {
    return this.profile.onboardingCompleted;
  }

  /**
   * Save Cold Start Onboarding preferences (favorite genres & artists)
   */
  public saveColdStartPreferences(genres: string[], artists: string[]) {
    this.profile.favoriteGenres = genres;
    this.profile.favoriteArtists = artists;
    this.profile.onboardingCompleted = true;

    // Seed initial affinities
    artists.forEach((art) => {
      this.profile.topArtists[art] = (this.profile.topArtists[art] || 0) + 15;
    });

    genres.forEach((genre) => {
      const cat = genre.toLowerCase().replace(/[^a-z]/g, '');
      this.profile.topGenres[cat] = (this.profile.topGenres[cat] || 0) + 12;
    });

    this.saveProfile();
  }

  /**
   * Calculate exact user affinity score for a track
   * Heavy weighting of:
   * - Listens (+5 pts per listen)
   * - Loop counts (+20 pts per loop)
   * - Likes / Thumbs Up (+30 pts)
   * - Dislikes / Thumbs Down (-100 pts)
   * - Skips (-12 pts per early skip)
   * - Cold start artist & genre matches (+25 pts / +15 pts)
   */
  public calculateTrackAffinity(track: Track): number {
    const id = track.id;

    // Disliked tracks receive a massive negative score
    if (this.profile.dislikes.includes(id)) {
      return -1000;
    }

    let score = 0;

    // 1. Likes & Dislikes
    if (this.profile.likes.includes(id) || track.isFavorite) {
      score += 35;
    }

    // 2. Loop Counts (Strongest positive engagement signal)
    const loopCount = this.profile.loops[id] || 0;
    score += loopCount * 22;

    // 3. Listen Counts
    const listenCount = this.profile.listens[id] || 0;
    score += Math.min(listenCount * 6, 60);

    // 4. Skips Penalty
    const skipCount = this.profile.skips[id] || 0;
    score -= skipCount * 14;

    // 5. Cold Start Artist Seed Match
    const artistLower = (track.artist || '').toLowerCase();
    const matchesFavArtist = this.profile.favoriteArtists.some((a) =>
      artistLower.includes(a.toLowerCase()) || a.toLowerCase().includes(artistLower)
    );
    if (matchesFavArtist) {
      score += 25;
    }

    // 6. Cold Start Genre Seed Match
    const { category } = detectVibeAndGenre(track);
    const matchesFavGenre = this.profile.favoriteGenres.some((g) => {
      const gClean = g.toLowerCase();
      return gClean.includes(category) || category.includes(gClean);
    });
    if (matchesFavGenre) {
      score += 15;
    }

    // 7. General Artist Affinity
    if (this.profile.topArtists[track.artist]) {
      score += Math.min(this.profile.topArtists[track.artist] * 2, 40);
    }

    // 8. General Genre Affinity
    if (this.profile.topGenres[category]) {
      score += Math.min(this.profile.topGenres[category] * 1.5, 30);
    }

    return score;
  }

  /**
   * Record track listen with duration
   */
  public recordTrackListen(track: Track, durationSec = 0, isCompleted = false): { vibe: string; category: string } {
    const { vibe, category } = detectVibeAndGenre(track);

    this.profile.lastPlayedTrack = track;
    this.profile.activeVibe = vibe;

    // Increment play count
    this.profile.listens[track.id] = (this.profile.listens[track.id] || 0) + 1;

    // Maintain recent seeds (last 8 tracks)
    const existingIndex = this.profile.recentSeeds.findIndex((t) => t.id === track.id || t.title === track.title);
    if (existingIndex !== -1) {
      this.profile.recentSeeds.splice(existingIndex, 1);
    }
    this.profile.recentSeeds.unshift(track);
    if (this.profile.recentSeeds.length > 8) {
      this.profile.recentSeeds.pop();
    }

    // Increment artist & genre affinity
    if (track.artist) {
      this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 2;
    }
    this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 2;

    this.saveProfile();
    return { vibe, category };
  }

  /**
   * Record when a user skips a track early (< 20 seconds)
   */
  public recordTrackSkip(track: Track, secondsBeforeSkip: number) {
    if (secondsBeforeSkip < 25) {
      this.profile.skips[track.id] = (this.profile.skips[track.id] || 0) + 1;

      // Mild penalty to artist
      if (track.artist && this.profile.topArtists[track.artist]) {
        this.profile.topArtists[track.artist] = Math.max(0, this.profile.topArtists[track.artist] - 1);
      }

      this.saveProfile();
    }
  }

  /**
   * Record when user loops or replays a track
   */
  public recordTrackLoop(track: Track) {
    this.profile.loops[track.id] = (this.profile.loops[track.id] || 0) + 1;

    if (track.artist) {
      this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 4;
    }

    const { category } = detectVibeAndGenre(track);
    this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 3;

    this.saveProfile();
  }

  /**
   * Record Thumbs Up / Like
   */
  public toggleLike(trackId: string, isFav?: boolean): boolean {
    const isCurrentlyLiked = this.profile.likes.includes(trackId) || Boolean(isFav);
    if (isCurrentlyLiked) {
      this.profile.likes = this.profile.likes.filter((id) => id !== trackId);
    } else {
      this.profile.likes.push(trackId);
      // Remove from dislikes if it was there
      this.profile.dislikes = this.profile.dislikes.filter((id) => id !== trackId);
    }
    this.saveProfile();
    return !isCurrentlyLiked;
  }

  /**
   * Record Thumbs Down / Dislike
   */
  public toggleDislike(trackId: string): boolean {
    const isCurrentlyDisliked = this.profile.dislikes.includes(trackId);
    if (isCurrentlyDisliked) {
      this.profile.dislikes = this.profile.dislikes.filter((id) => id !== trackId);
    } else {
      this.profile.dislikes.push(trackId);
      // Remove from likes
      this.profile.likes = this.profile.likes.filter((id) => id !== trackId);
    }
    this.saveProfile();
    return !isCurrentlyDisliked;
  }

  public isDisliked(trackId: string): boolean {
    return this.profile.dislikes.includes(trackId);
  }

  public isLiked(trackId: string): boolean {
    return this.profile.likes.includes(trackId);
  }

  /**
   * Generate dynamic 2x2 collage artwork from top tracks
   */
  private generateCollageGrid(tracks: Track[], fallbackCovers: string[]): string[] {
    const covers: string[] = [];
    for (const t of tracks) {
      if (t.coverUrl && !covers.includes(t.coverUrl)) {
        covers.push(t.coverUrl);
        if (covers.length >= 4) break;
      }
    }
    while (covers.length < 4) {
      const fallback = fallbackCovers[covers.length] || tracks[0]?.coverUrl || 'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg';
      covers.push(fallback);
    }
    return covers;
  }

  /**
   * Generate "My Supermix"
   * The ultimate personalized mix combining top affinities, favorite artists, loops, and familiar staples.
   */
  public generateSupermix(catalog: Track[] = TRACKS): MusicMix {
    // Filter out disliked tracks
    const allowed = catalog.filter((t) => !this.isDisliked(t.id));

    // Score all tracks with the listening history weighting algorithm
    const scored = allowed.map((t) => ({
      track: t,
      score: this.calculateTrackAffinity(t) + Math.random() * 5
    }));

    scored.sort((a, b) => b.score - a.score);
    const topTracks = scored.slice(0, 16).map((s) => s.track);

    // Extract top artist names for subtitle
    const topArtistsList: string[] = [];
    topTracks.forEach((t) => {
      const primaryArtist = t.artist.split(/[,&]/)[0].trim();
      if (!topArtistsList.includes(primaryArtist)) {
        topArtistsList.push(primaryArtist);
      }
    });

    const artistSubtitle = topArtistsList.slice(0, 3).join(', ') + ' and more';

    return {
      id: 'mix-supermix',
      title: 'My Supermix',
      subtitle: artistSubtitle || 'Your favorite artists, heavy repeats, and daily discoveries',
      description: 'An endless personalized blend combining all your favorite genres, loops, and daily repeats.',
      badge: 'SUPERMIX',
      gradient: 'from-[#ff0033]/80 via-[#990000]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(topTracks, [
        'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
        'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
        'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
        'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg'
      ]),
      trackIds: topTracks.map((t) => t.id)
    };
  }

  /**
   * Generate "Discover Mix"
   * Explores fresh and unplayed or rarely-played songs that match user's weighted genre and artist affinity profile.
   */
  public generateDiscoverMix(catalog: Track[] = TRACKS): MusicMix {
    const allowed = catalog.filter((t) => !this.isDisliked(t.id));

    // Prioritize tracks with 0 or 1 listens that still match top genres or related artists
    const scored = allowed.map((t) => {
      const listens = this.profile.listens[t.id] || 0;
      const skips = this.profile.skips[t.id] || 0;
      if (skips > 0) return { track: t, score: -100 };

      let discoveryScore = 0;

      // Heavy bonus for fresh/unplayed
      if (listens === 0) {
        discoveryScore += 35;
      } else if (listens === 1) {
        discoveryScore += 15;
      } else {
        discoveryScore -= listens * 5; // Demote frequently played tracks
      }

      // Match genre affinity
      const { category } = detectVibeAndGenre(t);
      if (this.profile.topGenres[category]) {
        discoveryScore += Math.min(this.profile.topGenres[category] * 2, 30);
      }

      // Match artist or related artist
      const matchesArtist = this.profile.favoriteArtists.some((a) =>
        t.artist.toLowerCase().includes(a.toLowerCase())
      );
      if (matchesArtist) {
        discoveryScore += 20;
      }

      return {
        track: t,
        score: discoveryScore + Math.random() * 8
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const discoverTracks = scored.slice(0, 14).map((s) => s.track);

    // Pick top genre name
    const topGenreKeys = Object.entries(this.profile.topGenres).sort((a, b) => b[1] - a[1]);
    const topGenreName = topGenreKeys.length > 0 ? topGenreKeys[0][0] : 'your taste';

    return {
      id: 'mix-discover',
      title: 'Discover Mix',
      subtitle: `Fresh tracks and hidden gems matched to ${topGenreName}`,
      description: 'Updated weekly with hidden gems and breakthrough releases tailored to your listening habits.',
      badge: 'DISCOVER',
      gradient: 'from-[#8e2de2]/80 via-[#4a00e0]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(discoverTracks, [
        'https://i.ytimg.com/vi/p8gq-PqMv2c/mqdefault.jpg',
        'https://i.ytimg.com/vi/qfZm277B1iI/mqdefault.jpg',
        'https://i.ytimg.com/vi/ElZfdU54Cp8/mqdefault.jpg',
        'https://i.ytimg.com/vi/IJq0yyWug1k/mqdefault.jpg'
      ]),
      trackIds: discoverTracks.map((t) => t.id)
    };
  }

  /**
   * Generate "New Release Mix"
   * Curates newly released 2024 singles from the user's favorite and seeded artists.
   */
  public generateNewReleaseMix(catalog: Track[] = TRACKS): MusicMix {
    const allowed = catalog.filter((t) => !this.isDisliked(t.id));

    // Filter by recent / 2024 releases, then score by affinity
    const recent = allowed.filter((t) => t.year === '2024');
    const pool = recent.length >= 6 ? recent : allowed;

    const scored = pool.map((t) => ({
      track: t,
      score: this.calculateTrackAffinity(t) + (t.year === '2024' ? 30 : 0) + Math.random() * 6
    }));

    scored.sort((a, b) => b.score - a.score);
    const newTracks = scored.slice(0, 14).map((s) => s.track);

    const artists = Array.from(new Set(newTracks.map((t) => t.artist.split(/[,&]/)[0].trim()))).slice(0, 3);
    const subtitle = artists.length > 0 ? `Fresh drops from ${artists.join(', ')} & more` : 'Fresh drops from your favorite artists';

    return {
      id: 'mix-new-release',
      title: 'New Release Mix',
      subtitle,
      description: 'Catch every newly released single, collaboration, and EP in one dynamic feed.',
      badge: 'NEW',
      gradient: 'from-[#ff416c]/80 via-[#ff4b2b]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(newTracks, [
        'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
        'https://i.ytimg.com/vi/VAdGW7QDJiU/mqdefault.jpg',
        'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
        'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg'
      ]),
      trackIds: newTracks.map((t) => t.id)
    };
  }

  /**
   * Returns all dynamic curated mixes
   */
  public getAllCuratedMixes(catalog: Track[] = TRACKS): MusicMix[] {
    const supermix = this.generateSupermix(catalog);
    const discoverMix = this.generateDiscoverMix(catalog);
    const newReleaseMix = this.generateNewReleaseMix(catalog);

    // Auxiliary mood mixes
    const chillTracks = catalog
      .filter((t) => !this.isDisliked(t.id) && detectVibeAndGenre(t).category === 'chillout')
      .slice(0, 10);
    const energyTracks = catalog
      .filter((t) => !this.isDisliked(t.id) && (detectVibeAndGenre(t).category === 'electronic' || detectVibeAndGenre(t).category === 'punjabi'))
      .slice(0, 10);

    const chillMix: MusicMix = {
      id: 'mix-chill',
      title: 'Chill Mix',
      subtitle: 'Darshan Raval, Asees Kaur, Pritam & more',
      description: 'Mellow melodies, acoustic chords, and relaxed evening warmth.',
      badge: 'CHILL',
      gradient: 'from-[#1e3c72]/80 via-[#2a5298]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(chillTracks, [
        'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
        'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg',
        'https://i.ytimg.com/vi/J_CD7rFH-O0/mqdefault.jpg',
        'https://i.ytimg.com/vi/sK7riqg2mr4/mqdefault.jpg'
      ]),
      trackIds: chillTracks.map((t) => t.id)
    };

    const energyMix: MusicMix = {
      id: 'mix-energy',
      title: 'Energy Mix',
      subtitle: 'Sidhu Moosewala, The Weeknd, Alan Walker',
      description: 'High-octane Punjabi drill, driving electronic kicks and upbeat tracks to fuel your grind.',
      badge: 'ENERGY',
      gradient: 'from-[#f12711]/80 via-[#f5af19]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(energyTracks, [
        'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
        'https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg',
        'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
        'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg'
      ]),
      trackIds: energyTracks.map((t) => t.id)
    };

    return [supermix, discoverMix, newReleaseMix, chillMix, energyMix];
  }

  /**
   * Instantly synchronously generates a highly personalized Up-Next queue
   */
  public getInstantPersonalizedQueue(seedTrack: Track, catalog: Track[] = TRACKS, history: Track[] = []): Track[] {
    const { category } = detectVibeAndGenre(seedTrack);
    const resultQueue: Track[] = [];
    const seenIds = new Set<string>();

    // Exclude disliked tracks
    this.profile.dislikes.forEach((id) => seenIds.add(id));

    // Exclude history to prevent immediate repeats
    history.forEach((t) => {
      seenIds.add(t.id);
      if (t.title) seenIds.add(t.title.toLowerCase());
    });

    const addTrack = (t: Track) => {
      if (
        t.id !== seedTrack.id &&
        !seenIds.has(t.id) &&
        !seenIds.has(t.title.toLowerCase()) &&
        !this.isDisliked(t.id)
      ) {
        seenIds.add(t.id);
        seenIds.add(t.title.toLowerCase());
        resultQueue.push(t);
      }
    };

    // 1. Same artist tracks
    catalog
      .filter((t) => t.artist.toLowerCase().includes(seedTrack.artist.toLowerCase()) || seedTrack.artist.toLowerCase().includes(t.artist.toLowerCase()))
      .forEach(addTrack);

    // 2. Same genre / vibe category
    catalog
      .filter((t) => detectVibeAndGenre(t).category === category)
      .forEach(addTrack);

    // 3. User top artists affinity
    const topArtistNames = Object.keys(this.profile.topArtists);
    if (topArtistNames.length > 0) {
      catalog
        .filter((t) => {
          const otherDetection = detectVibeAndGenre(t);
          return otherDetection.category === category && topArtistNames.some((art) => t.artist.toLowerCase().includes(art.toLowerCase()));
        })
        .forEach(addTrack);
    }

    // 4. Fill remaining category tracks
    catalog
      .filter((t) => detectVibeAndGenre(t).category === category)
      .forEach(addTrack);

    // If queue is empty, allow repeats by resetting history seenIds, but strictly avoid disliked tracks
    if (resultQueue.length === 0) {
      seenIds.clear();
      seenIds.add(seedTrack.id);
      this.profile.dislikes.forEach((id) => seenIds.add(id));
      catalog
        .filter((t) => detectVibeAndGenre(t).category === category && !this.isDisliked(t.id))
        .forEach(addTrack);
    }

    return resultQueue;
  }

  /**
   * Generates a fully personalized YouTube Music style Up-Next queue
   */
  public async generatePersonalizedQueue(seedTrack: Track, catalog: Track[] = TRACKS, history: Track[] = []): Promise<Track[]> {
    const instantQueue = this.getInstantPersonalizedQueue(seedTrack, catalog, history);

    if (seedTrack.videoId) {
      try {
        const liveRelated = await getRelatedTracksFromVideo(seedTrack.videoId, seedTrack.artist);
        if (liveRelated && liveRelated.length > 0) {
          const blended: Track[] = [];
          const seen = new Set<string>();

          history.forEach((t) => {
            seen.add(t.id);
            if (t.title) seen.add(t.title.toLowerCase());
          });
          this.profile.dislikes.forEach((id) => seen.add(id));

          const addB = (t: Track) => {
            if (t.id !== seedTrack.id && !seen.has(t.id) && !seen.has(t.title.toLowerCase()) && !this.isDisliked(t.id)) {
              seen.add(t.id);
              seen.add(t.title.toLowerCase());
              blended.push(t);
            }
          };

          liveRelated.slice(0, 15).forEach(addB);
          instantQueue.forEach(addB);

          if (blended.length > 0) return blended;
        }
      } catch {
        // Fallback to instant queue
      }
    }

    return instantQueue;
  }

  /**
   * Generates personalized Home Screen data tailored directly to the seed track and affinity scores
   */
  public generatePersonalizedHome(seedTrack: Track | null, catalog: Track[] = TRACKS): PersonalizedHomeData {
    const active = seedTrack || this.profile.lastPlayedTrack || catalog[0];
    const { vibe, category } = detectVibeAndGenre(active);

    const allowed = catalog.filter((t) => !this.isDisliked(t.id));

    // Scored quick picks combining vibe, artist, and listen history weights
    const scoredQuickPicks = allowed.map((t) => {
      let score = this.calculateTrackAffinity(t);
      if (t.id === active.id) score += 50;
      if (t.artist.toLowerCase() === active.artist.toLowerCase()) score += 20;
      if (detectVibeAndGenre(t).category === category) score += 15;
      return { track: t, score };
    });

    scoredQuickPicks.sort((a, b) => b.score - a.score);
    const personalizedQuickPicks = scoredQuickPicks.map((s) => s.track);

    // Similar tastes & favorites based on current vibe
    const similarTastes: FavoriteItem[] = personalizedQuickPicks.slice(1, 7).map((t, idx) => ({
      id: `fav-pers-${t.id}-${idx}`,
      title: t.title,
      artist: t.artist,
      coverUrl: t.coverUrl
    }));

    // Related albums matching the artist or mood
    const matchingAlbums = RELATED_ALBUMS.filter(
      (a) => a.artist.toLowerCase() === active.artist.toLowerCase()
    );
    const otherAlbums = RELATED_ALBUMS.filter(
      (a) => a.artist.toLowerCase() !== active.artist.toLowerCase()
    );
    const relatedAlbums = [...matchingAlbums, ...otherAlbums];

    return {
      vibeBadge: vibe,
      basedOnSection: {
        title: `Similar to ${active.title}`,
        subtitle: `More tracks like ${active.artist} • ${vibe}`,
        tracks: personalizedQuickPicks.slice(0, 10)
      },
      quickPicks: personalizedQuickPicks,
      similarTastes: similarTastes.length > 0 ? similarTastes : [
        {
          id: 'fav-def-1',
          title: active.title,
          artist: active.artist,
          coverUrl: active.coverUrl
        }
      ],
      relatedAlbums,
      radioName: `${active.artist} Mix`,
      radioVibe: vibe,
      curatedMixes: this.getAllCuratedMixes(catalog)
    };
  }
}

export const personalizationService = new PersonalizationService();
