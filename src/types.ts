export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  coverUrl: string;
  isFavorite?: boolean;
  quality?: string;
  year?: string;
  genre?: string;
  lyrics?: { time: number; text: string }[];
  audioUrl?: string;
  videoId?: string;
  plays?: string;
  isDownloaded?: boolean;
  isSmartDownloaded?: boolean;
  playedAt?: number;
  playCount?: number;
}

export interface HistoryRecord {
  id: string;
  track: Track;
  playedAt: number;
  playCount?: number;
}

export interface DownloadRecord {
  trackId: string;
  track: Track;
  downloadedAt: number;
  sizeBytes: number;
  isSmartDownload: boolean;
  quality: string;
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  isSubscribed?: boolean;
  subscribers?: string;
  trackCount: number;
  albumCount: number;
  genres: string[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: string;
  coverUrl: string;
  trackCount?: number;
}

export interface FavoriteItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  tracks: Track[];
}

export interface MusicMix {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  coverGrid: string[];
  gradient: string;
  trackIds: string[];
}

export interface MusicVideoItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  views: string;
  thumbnailUrl: string;
  videoId: string;
  releaseDate?: string;
  trackId?: string;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeContextInfo {
  timeOfDay: TimeOfDay;
  greeting: string;
  subtitle: string;
  icon: string;
  recommendedVibes: string[];
  ambientColor: string;
}

export type AccentColor = 'coral' | 'orange' | 'cyan' | 'emerald' | 'purple';
export type ActiveScreen = 'home' | 'explore' | 'search' | 'library' | 'settings';
export type PlayerLayout = 'vimusic' | 'opentune';
export type FilterChip = 'quick_picks' | 'songs' | 'albums' | 'artists' | 'playlists';
export type SearchFilterCategory = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

export interface UserTastePreferences {
  favoriteGenres: string[];
  favoriteArtists: string[];
  onboardingCompleted: boolean;
  dislikedTrackIds: string[];
}

export interface LyricMatchDetail {
  matchedLine: string;
  timestampSec: number;
}

export interface EnrichedTrackSearchResult extends Track {
  lyricMatch?: LyricMatchDetail;
  matchScore?: number;
}

export interface ContextualSearchResults {
  query: string;
  correctedQuery?: string;
  hasTypoCorrection: boolean;
  topResult?: {
    type: 'song' | 'artist' | 'album';
    item: Track | Artist | Album;
  };
  songs: EnrichedTrackSearchResult[];
  albums: Album[];
  artists: Artist[];
  playlists: (Playlist | MusicMix)[];
}

export type BitrateTier = 'dataSaver' | 'standard' | 'high' | 'audiophile';
export type StreamingProtocol = 'hls' | 'dash' | 'chunked';

export interface AbrMetrics {
  currentBitrateKbps: number;
  tier: BitrateTier;
  tierLabel: string;
  networkSpeedKbps: number;
  latencyMs: number;
  bufferHealthSec: number;
  protocol: string;
  isPrebuffered: boolean;
  prebufferedTrackId?: string;
  prebufferedTrackTitle?: string;
}

export interface SettingsState {
  dynamicColors: boolean;
  accentColor: AccentColor;
  pureBlackAmoled: boolean;
  playerLayout: PlayerLayout;
  defaultTab: string;
  showQuickPicksFullscreen: boolean;
  aodDisplay: boolean;
  discordRpc: boolean;
  lastFm: boolean;
  listenBrainz: boolean;
  invidiousInstance: string;
  audioQuality: string;
  volumeNormalization: boolean;
  skipSilence: boolean;
  skipSponsor: boolean;
  equalizerPreset: string;
  sleepTimerRemaining: number | null; // in minutes
  outputDevice: string;
  enableOfflineCache: boolean;
  backgroundPlayback: boolean;
  adaptiveBitrate?: boolean;
  prebufferNextTrack?: boolean;
  streamingProtocol?: StreamingProtocol;
}
