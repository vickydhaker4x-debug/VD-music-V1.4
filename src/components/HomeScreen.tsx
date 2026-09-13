import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Track, FilterChip, Album, MusicMix, MusicVideoItem, TimeOfDay } from '../types';
import { TRACKS, FORGOTTEN_FAVORITES, RELATED_ALBUMS } from '../data/musicData';
import { YTM_PERSONALIZED_MIXES, RECOMMENDED_MUSIC_VIDEOS } from '../data/ytmModulesData';
import { TrackImage } from './TrackImage';
import { PersonalizedHomeData, personalizationService } from '../services/personalizationService';
import { getTimeContext } from '../utils/timeContext';

const TOP_STREAMING_METAS: Record<string, { rank: number; streams: string; chart: string }> = {
  'track-kesariya': { rank: 1, streams: '485M+', chart: 'Daily Top 50 #1' },
  'track-chaleya': { rank: 2, streams: '430M+', chart: 'India Viral #1' },
  'track-295': { rank: 3, streams: '495M+', chart: 'Spotify Global #3' },
  'track-brown-munde': { rank: 4, streams: '415M+', chart: 'Desi Hip-Hop #1' },
  'track-starboy': { rank: 5, streams: '3.2B+', chart: 'Global 100 #1' },
  'track-softly': { rank: 6, streams: '280M+', chart: 'Trending Now' },
  'track-apna-bana-le': { rank: 7, streams: '345M+', chart: 'Romance Hits #1' },
  'track-cheques': { rank: 8, streams: '310M+', chart: 'Viral Hits' },
  'track-with-you': { rank: 9, streams: '265M+', chart: 'Top Charts' },
  'track-blinding-lights': { rank: 10, streams: '4.2B+', chart: 'All-Time Hit' },
  'track-shape-of-you': { rank: 11, streams: '3.9B+', chart: 'Top 100 Global' },
  'track-raataan': { rank: 12, streams: '380M+', chart: 'Melodic Top #1' },
  'track-tum-hi-ho': { rank: 13, streams: '520M+', chart: 'Evergreen Hit' }
};

interface HomeScreenProps {
  tracks: Track[];
  favoriteTrackIds: Set<string>;
  currentTrack: Track | null;
  isPlaying: boolean;
  personalizedData?: PersonalizedHomeData;
  playbackHistory?: Track[];
  userName?: string;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onOpenVideo?: (video: MusicVideoItem) => void;
  onPlayMix?: (mix: MusicMix) => void;
  onOpenColdStart?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  tracks,
  favoriteTrackIds,
  currentTrack,
  isPlaying,
  personalizedData,
  playbackHistory = [],
  userName,
  onSelectTrack,
  onTogglePlay,
  onToggleFavorite,
  onOpenVideo,
  onPlayMix,
  onOpenColdStart
}) => {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  // Time-of-Day Context state (auto detects local time, allows testing different times)
  const [forcedTimeOfDay, setForcedTimeOfDay] = useState<TimeOfDay | null>(null);
  const timeContext = useMemo(() => getTimeContext(forcedTimeOfDay), [forcedTimeOfDay]);

  // Curated and reactive Top Streaming songs derived directly from tracks
  const topStreamingTracks = useMemo(() => {
    const list: (Track & { rank: number; streams: string; chart: string })[] = [];
    const orderedIds = Object.keys(TOP_STREAMING_METAS);

    for (const id of orderedIds) {
      const found = tracks.find((t) => t.id === id);
      if (found) {
        list.push({
          ...found,
          ...TOP_STREAMING_METAS[id]
        });
      }
    }

    if (list.length < 9) {
      tracks.forEach((t) => {
        if (!list.some((item) => item.id === t.id)) {
          list.push({
            ...t,
            rank: list.length + 1,
            streams: '200M+',
            chart: 'Top Streaming'
          });
        }
      });
    }

    return list;
  }, [tracks]);

  // Dynamic tracks list
  const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]);

  useEffect(() => {
    const baseTracks = personalizedData?.quickPicks || tracks;
    
    // Extract user preferences from favorites
    const favGenres = new Set(tracks.filter(t => favoriteTrackIds.has(t.id)).map(t => t.genre).filter(Boolean));
    const favArtists = new Set<string>();
    tracks.filter(t => favoriteTrackIds.has(t.id)).forEach(t => {
      if (t.artist) {
        t.artist.split(/[,&]/).map(p => p.trim()).forEach(p => favArtists.add(p));
      }
    });

    const scored = baseTracks.map(track => {
      let score = Math.random() * 5;
      
      const trackGenre = track.genre;
      if (trackGenre && favGenres.has(trackGenre)) {
         score += 4 + Math.random() * 3;
      }
      
      if (track.artist) {
        const trackArtists = track.artist.split(/[,&]/).map(p => p.trim());
        const hasFavArtist = trackArtists.some(a => favArtists.has(a));
        if (hasFavArtist) {
           score += 6 + Math.random() * 3;
        }
      }
      
      if (favoriteTrackIds.has(track.id)) {
         score += 3;
      }
      
      return { track, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const uniqueTracks: Track[] = [];
    const seenIds = new Set<string>();
    for (const item of scored) {
      if (!seenIds.has(item.track.id)) {
        seenIds.add(item.track.id);
        uniqueTracks.push(item.track);
      }
    }
    
    setDisplayedTracks(uniqueTracks.length > 0 ? uniqueTracks : tracks);
  }, [tracks, personalizedData, favoriteTrackIds]);
  
  // Pull-to-refresh state
  const [pullY, setPullY] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const touchStartY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);

    setTimeout(() => {
      setDisplayedTracks((prev) => {
        const shuffled = [...prev].sort(() => 0.5 - Math.random());
        return shuffled;
      });
      setIsRefreshing(false);
      setRefreshSuccess(true);
      setPullY(0);

      setTimeout(() => {
        setRefreshSuccess(false);
      }, 2000);
    }, 800);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    } else {
      isPulling.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0 && window.scrollY <= 5) {
      const damping = Math.min(diff * 0.45, 90);
      setPullY(damping);
    } else {
      setPullY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullY >= 50 && !isRefreshing) {
      triggerRefresh();
    } else {
      setPullY(0);
    }
  };

  // Derive Listen Again items (frequent or recent playback history + favorites)
  const listenAgainTracks = useMemo(() => {
    const list: Track[] = [];
    const seen = new Set<string>();

    // 1. First priority: playback history
    playbackHistory.forEach((t) => {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    });

    // 2. Second priority: favorites
    tracks.filter((t) => favoriteTrackIds.has(t.id)).forEach((t) => {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    });

    // 3. Fallback to top seed tracks
    tracks.slice(0, 10).forEach((t) => {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    });

    return list.slice(0, 12);
  }, [playbackHistory, favoriteTrackIds, tracks]);

  // Derive New Releases (fresh 2024 releases)
  const newReleaseTracks = useMemo(() => {
    const fresh = tracks.filter((t) => t.year === '2024');
    return fresh.length >= 4 ? fresh : tracks.slice(0, 8);
  }, [tracks]);

  // Derive Quick picks tracks filtered by mood or time of day
  const displayedQuickPicks = useMemo(() => {
    if (!selectedMood) {
      return displayedTracks;
    }
    const lowerMood = selectedMood.toLowerCase();
    const filtered = displayedTracks.filter((t) => {
      const g = (t.genre || '').toLowerCase();
      const title = t.title.toLowerCase();
      const artist = t.artist.toLowerCase();
      if (lowerMood === 'relax' || lowerMood === 'chill') {
        return g.includes('relax') || g.includes('lofi') || g.includes('soulful') || title.includes('lofi');
      }
      if (lowerMood === 'romance') {
        return g.includes('romance') || g.includes('soulful') || g.includes('melodic') || title.includes('dil') || title.includes('preet') || title.includes('ishq');
      }
      if (lowerMood === 'party') {
        return g.includes('hip hop') || g.includes('pop') || g.includes('urban') || g.includes('beats') || artist.includes('sidhu') || artist.includes('dhillon');
      }
      if (lowerMood === 'energize' || lowerMood === 'workout') {
        return g.includes('dance') || g.includes('edm') || g.includes('electronic') || g.includes('urban') || g.includes('hip hop');
      }
      if (lowerMood === 'focus') {
        return g.includes('lofi') || g.includes('relax') || title.includes('sauda') || g.includes('soulful');
      }
      if (lowerMood === 'feel good') {
        return g.includes('melodic') || g.includes('pop') || g.includes('relax') || g.includes('soulful');
      }
      return g.includes(lowerMood) || title.includes(lowerMood) || artist.includes(lowerMood);
    });
    return filtered.length > 0 ? filtered : displayedTracks;
  }, [selectedMood, displayedTracks]);

  // Chunk tracks into columns with exactly 4 tracks per column (YouTube Music layout)
  const quickPicksColumns = useMemo(() => {
    const cols: Track[][] = [];
    const listToChunk = displayedQuickPicks.slice(0, 16);
    for (let i = 0; i < listToChunk.length; i += 4) {
      cols.push(listToChunk.slice(i, i + 4));
    }
    return cols;
  }, [displayedQuickPicks]);

  // Derive forgotten favorites dynamically
  const derivedForgottenFavorites = useMemo(() => {
    const quickPickIds = new Set(displayedQuickPicks.slice(0, 16).map(t => t.id));
    const userFavs = tracks.filter(t => favoriteTrackIds.has(t.id) && !quickPickIds.has(t.id));
    let mixed: Track[] = [...userFavs].sort(() => 0.5 - Math.random());
    
    if (mixed.length < 8) {
      const quickPickGenres = new Set(displayedQuickPicks.slice(0, 10).map(t => t.genre).filter(Boolean));
      const backups = tracks.filter(t => !quickPickIds.has(t.id) && !favoriteTrackIds.has(t.id) && quickPickGenres.has(t.genre)).sort(() => 0.5 - Math.random());
      mixed = [...mixed, ...backups];
    }
    
    const formatted = mixed.slice(0, 10).map(t => ({
      id: `fav-dyn-${t.id}`,
      title: t.title,
      artist: t.artist,
      coverUrl: t.coverUrl,
      originalTrack: t
    }));
    
    return formatted.length > 0 ? formatted : FORGOTTEN_FAVORITES.map(f => ({ ...f, originalTrack: undefined }));
  }, [displayedQuickPicks, tracks, favoriteTrackIds]);

  return (
    <div 
      id="home-screen-view" 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col w-full pb-8 space-y-7 max-w-4xl mx-auto transition-transform duration-200 relative"
      style={{
        transform: pullY > 0 ? `translateY(${pullY}px)` : 'none'
      }}
    >
      {/* Subtle Ambient Time-of-Day Glow at the top */}
      <div className={`absolute top-0 left-0 right-0 h-48 bg-gradient-to-b ${timeContext.ambientColor} pointer-events-none rounded-b-3xl -z-10`} />

      {/* Pull-To-Refresh Visual Indicator */}
      {(pullY > 0 || isRefreshing || refreshSuccess) && (
        <div className="flex items-center justify-center py-2 transition-all">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass shadow-lg text-[12px] font-semibold text-[#e4e1e7]">
            {isRefreshing ? (
              <>
                <span className="material-symbols-outlined floating-icon text-[18px] text-[var(--color-primary)] animate-spin">
                  sync
                </span>
                <span>Refreshing recommendations...</span>
              </>
            ) : refreshSuccess ? (
              <>
                <span className="material-symbols-outlined floating-icon text-[18px] text-green-400">
                  check_circle
                </span>
                <span className="text-green-300 font-bold">Feed Updated!</span>
              </>
            ) : (
              <>
                <span 
                  className="material-symbols-outlined floating-icon text-[18px] text-[var(--color-primary)] transition-transform"
                  style={{ transform: `rotate(${Math.min(pullY * 4, 360)}deg)` }}
                >
                  arrow_downward
                </span>
                <span>{pullY > 50 ? 'Release to refresh' : 'Pull down to refresh'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODULE 1: TIME-OF-DAY CONTEXT & GREETING */}
      <div className="px-4 sm:px-6 pt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0">
              <span className="material-symbols-outlined floating-icon text-[20px]">
                {timeContext.icon}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-[22px] sm:text-[24px] font-black text-white tracking-tight leading-tight truncate">
                {timeContext.greeting}{userName ? `, ${userName}` : ''}
              </h1>
              <p className="text-[12px] text-zinc-400 truncate leading-snug">
                {timeContext.subtitle}
              </p>
            </div>
          </div>

          {/* Time Context Mode Switcher (Allows user to test all 4 dayparts) */}
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 shrink-0">
            {(['auto', 'morning', 'afternoon', 'evening', 'night'] as const).map((t) => {
              const isActive = (t === 'auto' && forcedTimeOfDay === null) || forcedTimeOfDay === t;
              return (
                <button
                  key={t}
                  onClick={() => setForcedTimeOfDay(t === 'auto' ? null : t)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer capitalize ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title={t === 'auto' ? 'Current local time' : `Switch to ${t} recommendations`}
                >
                  {t === 'auto' ? '⏱️ Auto' : t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Mood & Genre Filter Chips adapted to time of day */}
      <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 -mt-1">
        <div className="flex items-center gap-2 min-w-max">
          {timeContext.recommendedVibes.map((mood) => {
            const isSelected = selectedMood === mood;
            return (
              <button
                key={mood}
                id={`mood-chip-${mood.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSelectedMood(isSelected ? null : mood)}
                className={`px-3.5 py-1.5 rounded-lg text-[13.5px] font-medium transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  isSelected
                    ? 'bg-white text-black font-semibold shadow-md scale-105'
                    : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white border border-white/[0.05]'
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>
      </div>

      {/* ROW 1: "LISTEN AGAIN" (YouTube Music Hallmark Row) */}
      <div className="flex flex-col space-y-3">
        <div className="px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
              Pick up where you left off
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Listen again
            </h2>
          </div>
          <button
            onClick={() => {
              if (listenAgainTracks.length > 0) onSelectTrack(listenAgainTracks[0]);
            }}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            Play all
          </button>
        </div>

        {/* Horizontal scroll of recently/frequently listened tracks */}
        <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6">
          <div className="flex items-start gap-4 min-w-max pb-1">
            {listenAgainTracks.map((track) => {
              const isThisActive = currentTrack?.id === track.id;
              return (
                <div
                  key={`listen-again-${track.id}`}
                  onClick={() => onSelectTrack(track)}
                  className="flex flex-col w-32 group cursor-pointer"
                >
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-md bg-zinc-900 border border-white/[0.06]">
                    <TrackImage
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={track.coverUrl}
                      videoId={track.videoId}
                      alt={track.title}
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className={`w-9 h-9 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center shadow-lg transition-transform ${
                        isThisActive ? 'scale-100' : 'opacity-0 group-hover:opacity-100 group-hover:scale-100'
                      }`}>
                        <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {isThisActive && isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-[var(--color-primary)] transition-colors leading-tight">
                    {track.title}
                  </span>
                  <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {track.artist}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 2: "MIXED FOR YOU" (YouTube Music Personalized Mixes with 2x2 Collage Artwork) */}
      <div className="flex flex-col space-y-3 pt-1">
        <div className="px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-primary)] font-bold">
              Endless algorithmic stations
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Mixed for you
            </h2>
          </div>

          {onOpenColdStart && (
            <button
              onClick={onOpenColdStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-white cursor-pointer transition-all active:scale-95"
            >
              <span className="material-symbols-outlined floating-icon text-[16px] text-red-400">tune</span>
              <span>Tune Taste</span>
            </button>
          )}
        </div>

        {/* Horizontal scroll of signature YTM mixes */}
        <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6">
          <div className="flex items-start gap-4 min-w-max pb-2">
            {(personalizedData?.curatedMixes || personalizationService.getAllCuratedMixes(tracks)).map((mix) => (
              <div
                key={mix.id}
                onClick={() => {
                  if (onPlayMix) {
                    onPlayMix(mix);
                  } else {
                    const firstTrack = tracks.find(t => mix.trackIds.includes(t.id)) || tracks[0];
                    if (firstTrack) onSelectTrack(firstTrack);
                  }
                }}
                className="flex flex-col w-40 group cursor-pointer"
              >
                {/* 2x2 Album Artwork Collage replicating YouTube Music */}
                <div className="relative w-40 h-40 rounded-2xl overflow-hidden shadow-xl border border-white/[0.08] bg-zinc-900 group-hover:border-white/20 transition-all">
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {mix.coverGrid.map((imgUrl, idx) => (
                      <img
                        key={idx}
                        src={imgUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ))}
                  </div>

                  {/* Gradient Overlay and Badge */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${mix.gradient} opacity-40 group-hover:opacity-60 transition-opacity`} />
                  
                  {mix.badge && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-black text-white uppercase tracking-wider">
                      {mix.badge}
                    </div>
                  )}

                  {/* Floating Play Button */}
                  <div className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-2xl opacity-95 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </div>
                </div>

                <span className="text-[14px] font-bold text-white mt-2 truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {mix.title}
                </span>
                <span className="text-[11px] text-zinc-400 line-clamp-2 leading-tight mt-0.5">
                  {mix.subtitle}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 3: "QUICK PICKS" (YouTube Music 4-Stacked Vertical Columns) */}
      <div className="flex flex-col space-y-2">
        <div className="px-4 sm:px-6 pt-1 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
              Start radio from a song
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Quick picks
            </h2>
          </div>
          <button
            id="play-all-quick-picks"
            onClick={() => {
              if (displayedQuickPicks.length > 0) {
                onSelectTrack(displayedQuickPicks[0]);
              }
            }}
            className="px-3.5 py-1 rounded-full border border-white/20 hover:bg-white/10 active:scale-95 text-[12px] font-medium text-white transition-all cursor-pointer"
          >
            Play all
          </button>
        </div>

        {/* 4-Item Stacked Swipeable Columns */}
        <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 snap-x snap-mandatory flex gap-3.5 sm:gap-5 pb-1">
          {quickPicksColumns.map((column, colIdx) => (
            <div 
              key={`qp-col-${colIdx}`}
              className="w-[85vw] sm:w-[380px] max-w-[420px] snap-start shrink-0 flex flex-col gap-1.5"
            >
              {column.map((track) => {
                const isThisTrackActive = currentTrack?.id === track.id;
                const isFavorite = favoriteTrackIds.has(track.id) || Boolean(track.isFavorite);
                const subtitle = track.plays 
                  ? `${track.artist} • ${track.plays}`
                  : track.artist;

                return (
                  <div
                    key={track.id}
                    id={`quick-pick-track-${track.id}`}
                    onClick={() => onSelectTrack(track)}
                    className={`flex items-center justify-between py-1 px-1.5 rounded-xl transition-all cursor-pointer group select-none ${
                      isThisTrackActive ? 'bg-white/15' : 'hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-lg overflow-hidden shrink-0 bg-zinc-900 shadow-sm">
                        <TrackImage
                          className="w-full h-full object-cover"
                          src={track.coverUrl}
                          videoId={track.videoId}
                          alt={track.title}
                        />
                        {isThisTrackActive && (
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                            <span className="material-symbols-outlined floating-icon text-white text-[18px] animate-pulse">
                              {isPlaying ? 'volume_up' : 'pause'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0 flex-1 pr-1">
                        <span className="text-[14px] font-medium text-white truncate leading-snug">
                          {track.title}
                        </span>
                        <span className="text-[12px] text-zinc-400 truncate leading-snug mt-0.5">
                          {subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="relative shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        aria-label="More options"
                        onClick={() => setActiveMenuTrackId(activeMenuTrackId === track.id ? null : track.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined floating-icon text-[18px]">more_vert</span>
                      </button>

                      {activeMenuTrackId === track.id && (
                        <div 
                          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-0"
                          onClick={() => setActiveMenuTrackId(null)}
                        >
                          <div 
                            className="w-full max-w-sm bg-[#18181f] rounded-2xl shadow-2xl border border-white/10 p-2 text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-3 p-3 border-b border-white/10 mb-1">
                              <div className="w-11 h-11 rounded-md overflow-hidden shrink-0">
                                <TrackImage 
                                  src={track.coverUrl} 
                                  videoId={track.videoId} 
                                  alt={track.title} 
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-semibold truncate text-white">{track.title}</span>
                                <span className="text-xs text-zinc-400 truncate">{track.artist}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                onSelectTrack(track);
                                setActiveMenuTrackId(null);
                              }}
                              className="w-full px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-3 text-sm text-left font-medium cursor-pointer"
                            >
                              <span className="material-symbols-outlined floating-icon text-[20px]">play_arrow</span>
                              Play now
                            </button>

                            <button
                              onClick={() => {
                                onToggleFavorite(track.id);
                                setActiveMenuTrackId(null);
                              }}
                              className="w-full px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-3 text-sm text-left font-medium cursor-pointer"
                            >
                              <span 
                                className="material-symbols-outlined floating-icon text-[20px] text-[var(--color-primary)]"
                                style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                {isFavorite ? 'favorite' : 'favorite_border'}
                              </span>
                              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ROW 4: "RECOMMENDED MUSIC VIDEOS" (16:9 Widescreen Cards) */}
      <div className="flex flex-col space-y-3 pt-1">
        <div className="px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-red-500 font-bold">
              From YouTube & Official Channels
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Recommended music videos
            </h2>
          </div>
        </div>

        <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6">
          <div className="flex items-start gap-4 min-w-max pb-2">
            {RECOMMENDED_MUSIC_VIDEOS.map((video) => (
              <div
                key={`rec-vid-${video.id}`}
                onClick={() => {
                  if (onOpenVideo) {
                    onOpenVideo(video);
                  } else {
                    const matchingTrack = tracks.find(t => t.videoId === video.videoId);
                    if (matchingTrack) onSelectTrack(matchingTrack);
                  }
                }}
                className="flex flex-col w-64 group cursor-pointer"
              >
                <div className="relative w-64 aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/[0.08] bg-black">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined floating-icon text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white">
                    {video.duration}
                  </div>
                </div>

                <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-red-400 transition-colors leading-tight">
                  {video.title}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                  <span className="truncate">{video.artist}</span>
                  <span>•</span>
                  <span>{video.views}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 5: "NEW RELEASES" (Fresh Drops & Singles) */}
      <div className="flex flex-col space-y-3 pt-1">
        <div className="px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">
              Fresh Drops
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              New releases
            </h2>
          </div>
          <button
            onClick={() => {
              if (newReleaseTracks.length > 0) onSelectTrack(newReleaseTracks[0]);
            }}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            Play all
          </button>
        </div>

        <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6">
          <div className="flex items-start gap-4 min-w-max pb-2">
            {newReleaseTracks.map((track) => (
              <div
                key={`new-rel-${track.id}`}
                onClick={() => onSelectTrack(track)}
                className="flex flex-col w-36 group cursor-pointer"
              >
                <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-white/[0.06] bg-zinc-900">
                  <TrackImage
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={track.coverUrl}
                    videoId={track.videoId}
                    alt={track.title}
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-bold text-white uppercase">
                    Single
                  </div>
                  <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all">
                    <span className="material-symbols-outlined floating-icon text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-rose-400 transition-colors">
                  {track.title}
                </span>
                <span className="text-[11px] text-zinc-400 truncate">
                  {track.artist}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 6: "FORGOTTEN FAVORITES" */}
      <div className="flex flex-col space-y-3 pt-1">
        <div className="px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
              Rediscover
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Forgotten favorites
            </h2>
          </div>
        </div>

        <div className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6">
          <div className="flex items-start gap-3.5 min-w-max pb-2">
            {derivedForgottenFavorites.map((fav) => (
              <div 
                key={fav.id}
                onClick={() => {
                  const matchingTrack = (fav as any).originalTrack || displayedTracks.find(t => t.title.toLowerCase().includes(fav.title.toLowerCase()));
                  if (matchingTrack) onSelectTrack(matchingTrack);
                }}
                className="flex flex-col w-28 group cursor-pointer"
              >
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-md bg-zinc-900 border border-white/[0.04]">
                  <TrackImage 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    src={fav.coverUrl} 
                    alt={fav.title}
                  />
                  <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-sm">
                    <span className="material-symbols-outlined floating-icon text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-white mt-2 truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {fav.title}
                </span>
                <span className="text-[11px] text-zinc-400 truncate">
                  {fav.artist}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
