import React, { useState, useMemo } from 'react';
import { Track } from '../types';
import { TrackImage } from './TrackImage';
import { EXPLORE_CHARTS, EXPLORE_MOODS_GENRES, RECOMMENDED_MUSIC_VIDEOS } from '../data/ytmModulesData';
import { MusicVideoItem } from '../types';

interface ExploreScreenProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onOpenVideo: (video: MusicVideoItem) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onOpenVideo
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'new_releases' | 'charts' | 'moods'>('all');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string | null>(null);

  // Derive New Releases from tracks (recent release years or tagged)
  const newReleases = useMemo(() => {
    const fresh = tracks.filter((t) => t.year === '2024' || t.year === '2023');
    return fresh.length > 0 ? fresh : tracks.slice(0, 10);
  }, [tracks]);

  // Derived filtered tracks when a mood card is clicked
  const moodFilteredTracks = useMemo(() => {
    if (!selectedMoodFilter) return null;
    const lower = selectedMoodFilter.toLowerCase();
    return tracks.filter((t) => {
      const g = (t.genre || '').toLowerCase();
      const title = t.title.toLowerCase();
      const artist = t.artist.toLowerCase();
      return g.includes(lower) || title.includes(lower) || artist.includes(lower);
    });
  }, [selectedMoodFilter, tracks]);

  return (
    <div 
      id="explore-screen-view"
      className="flex flex-col w-full pb-12 space-y-6 max-w-4xl mx-auto px-4 sm:px-6 animate-fade-in"
    >
      {/* Top 3 YTM Explore Quick Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 pt-1">
        <button
          id="explore-btn-new-releases"
          onClick={() => setActiveCategory(activeCategory === 'new_releases' ? 'all' : 'new_releases')}
          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl transition-all cursor-pointer border ${
            activeCategory === 'new_releases'
              ? 'bg-gradient-to-br from-rose-600 to-red-800 border-rose-400/50 shadow-lg shadow-rose-900/30 scale-[1.02]'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-1.5">
            <span className="material-symbols-outlined floating-icon text-[22px]">album</span>
          </div>
          <span className="text-[12px] sm:text-[13px] font-bold text-white text-center">
            New releases
          </span>
        </button>

        <button
          id="explore-btn-charts"
          onClick={() => setActiveCategory(activeCategory === 'charts' ? 'all' : 'charts')}
          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl transition-all cursor-pointer border ${
            activeCategory === 'charts'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-800 border-blue-400/50 shadow-lg shadow-blue-900/30 scale-[1.02]'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1.5">
            <span className="material-symbols-outlined floating-icon text-[22px]">trending_up</span>
          </div>
          <span className="text-[12px] sm:text-[13px] font-bold text-white text-center">
            Charts
          </span>
        </button>

        <button
          id="explore-btn-moods"
          onClick={() => setActiveCategory(activeCategory === 'moods' ? 'all' : 'moods')}
          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl transition-all cursor-pointer border ${
            activeCategory === 'moods'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-400/50 shadow-lg shadow-emerald-900/30 scale-[1.02]'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5">
            <span className="material-symbols-outlined floating-icon text-[22px]">sentiment_very_satisfied</span>
          </div>
          <span className="text-[12px] sm:text-[13px] font-bold text-white text-center">
            Moods & genres
          </span>
        </button>
      </div>

      {/* Selected Mood Filter Alert Banner */}
      {selectedMoodFilter && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.08] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
            <span className="text-sm font-semibold text-white">
              Showing: <span className="capitalize text-[var(--color-primary)]">{selectedMoodFilter}</span>
            </span>
          </div>
          <button
            onClick={() => setSelectedMoodFilter(null)}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/10 cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* When a mood card is clicked, show its matching tracks */}
      {selectedMoodFilter && moodFilteredTracks && (
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-bold text-white">
            {selectedMoodFilter.toUpperCase()} Tracks ({moodFilteredTracks.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {moodFilteredTracks.map((track) => {
              const isThisActive = currentTrack?.id === track.id;
              return (
                <div
                  key={`mood-trk-${track.id}`}
                  onClick={() => onSelectTrack(track)}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                    isThisActive ? 'bg-white/15' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <TrackImage src={track.coverUrl} videoId={track.videoId} alt={track.title} className="w-full h-full object-cover" />
                    {isThisActive && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="material-symbols-outlined floating-icon text-white text-[18px]">
                          {isPlaying ? 'volume_up' : 'pause'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-white truncate">{track.title}</span>
                    <span className="text-xs text-zinc-400 truncate">{track.artist}</span>
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0">{track.duration}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1: CHARTS (YouTube Music Top Charts) */}
      {(activeCategory === 'all' || activeCategory === 'charts') && (
        <div className="flex flex-col space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-primary)]">
                Top Trending
              </span>
              <h2 className="text-[20px] font-bold text-white tracking-tight">
                Top Charts
              </h2>
            </div>
            <span className="text-xs text-zinc-400">Updated Daily</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {EXPLORE_CHARTS.map((chartItem) => {
              const matchingTrack = tracks.find((t) => t.id === chartItem.trackId);
              const isThisActive = currentTrack?.id === chartItem.trackId;

              return (
                <div
                  key={`chart-${chartItem.rank}`}
                  onClick={() => {
                    if (matchingTrack) onSelectTrack(matchingTrack);
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                    isThisActive
                      ? 'bg-white/[0.12] border-[var(--color-primary)]/40 shadow-lg'
                      : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.05]'
                  }`}
                >
                  {/* Rank Number with Trend */}
                  <div className="flex flex-col items-center justify-center w-8 shrink-0">
                    <span className="text-base font-black text-white">
                      {chartItem.rank}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center">
                      {chartItem.trend === 'up' ? '▲' : chartItem.trend === 'down' ? '▼' : '•'}
                    </span>
                  </div>

                  {/* Artwork */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm">
                    {matchingTrack ? (
                      <TrackImage
                        src={matchingTrack.coverUrl}
                        videoId={matchingTrack.videoId}
                        alt={chartItem.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800" />
                    )}
                    {isThisActive && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <span className="material-symbols-outlined floating-icon text-white text-[18px] animate-pulse">
                          volume_up
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title and Info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-white truncate group-hover:text-[var(--color-primary)] transition-colors">
                        {chartItem.title}
                      </span>
                    </div>
                    <span className="text-[12px] text-zinc-400 truncate">
                      {chartItem.artist}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                      <span className="text-[var(--color-primary)] font-medium">{chartItem.badge}</span>
                      <span>•</span>
                      <span>{chartItem.plays}</span>
                    </div>
                  </div>

                  {/* Quick Play Action */}
                  <button
                    aria-label="Play track"
                    className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-[var(--color-primary)] group-hover:text-black flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined floating-icon text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: NEW RELEASES (Horizontal Scroll) */}
      {(activeCategory === 'all' || activeCategory === 'new_releases') && (
        <div className="flex flex-col space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                Fresh drops
              </span>
              <h2 className="text-[20px] font-bold text-white tracking-tight">
                New Releases
              </h2>
            </div>
            <button
              onClick={() => {
                if (newReleases.length > 0) onSelectTrack(newReleases[0]);
              }}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Play all
            </button>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
            <div className="flex items-start gap-4 min-w-max pb-2">
              {newReleases.map((track) => (
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
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider">
                      {track.year || 'Single'}
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
      )}

      {/* SECTION 3: MOODS & GENRES (Interactive Colorful Grid) */}
      {(activeCategory === 'all' || activeCategory === 'moods') && (
        <div className="flex flex-col space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                Explore by vibe
              </span>
              <h2 className="text-[20px] font-bold text-white tracking-tight">
                Moods & Genres
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {EXPLORE_MOODS_GENRES.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedMoodFilter(item.filterKey)}
                className={`relative overflow-hidden rounded-xl p-3.5 h-24 bg-gradient-to-br ${item.color} shadow-md border border-white/10 flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all group`}
              >
                <div className="flex items-center justify-between">
                  <span className="material-symbols-outlined floating-icon text-[24px] text-white/80 group-hover:text-white transition-colors">
                    {item.icon}
                  </span>
                  <span className="material-symbols-outlined floating-icon text-[16px] text-white/40 group-hover:text-white transition-colors">
                    arrow_forward
                  </span>
                </div>
                <span className="text-[14px] font-bold text-white tracking-tight leading-tight">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: TRENDING MUSIC VIDEOS */}
      <div className="flex flex-col space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-red-500">
              Visual Streaming
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Trending Music Videos
            </h2>
          </div>
        </div>

        <div className="w-full overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="flex items-start gap-4 min-w-max pb-2">
            {RECOMMENDED_MUSIC_VIDEOS.map((video) => (
              <div
                key={`explore-vid-${video.id}`}
                onClick={() => onOpenVideo(video)}
                className="flex flex-col w-64 group cursor-pointer"
              >
                <div className="relative w-64 aspect-video rounded-xl overflow-hidden shadow-lg border border-white/[0.08] bg-black">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined floating-icon text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono font-medium text-white">
                    {video.duration}
                  </div>
                </div>

                <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-red-400 transition-colors leading-snug">
                  {video.title}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="truncate">{video.artist}</span>
                  <span>•</span>
                  <span>{video.views}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
