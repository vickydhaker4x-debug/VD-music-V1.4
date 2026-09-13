import React from 'react';
import { Track } from '../../types';
import { EnrichedAlbum } from '../../services/libraryDataService';
import { TrackImage } from '../TrackImage';

interface AlbumDetailViewProps {
  album: EnrichedAlbum;
  currentTrack: Track | null;
  isPlaying: boolean;
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayAlbum: (tracks: Track[], startIndex?: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: Track) => void;
  isDownloaded: (trackId: string) => boolean;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({
  album,
  currentTrack,
  isPlaying,
  onBack,
  onSelectTrack,
  onPlayAlbum,
  onToggleFavorite,
  onToggleDownload,
  isDownloaded
}) => {
  const handleShuffle = () => {
    if (album.tracks.length === 0) return;
    const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
    onPlayAlbum(shuffled, 0);
  };

  return (
    <div id="album-detail-view" className="flex flex-col gap-5 animate-fade-in">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-albums-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-bold text-[#a1a1aa] hover:text-[#e4e1e7] transition-colors cursor-pointer py-1"
        >
          <span className="material-symbols-outlined floating-icon text-[20px]">arrow_back</span>
          Back to Albums
        </button>
      </div>

      {/* Album Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl liquid-glass border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-xl">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 liquid-glass-heavy">
          <TrackImage
            src={album.coverUrl}
            videoId={album.tracks[0]?.videoId}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Album • {album.year}
          </span>
          <h1 className="text-[22px] sm:text-[26px] font-black text-[#e4e1e7] truncate mt-0.5">
            {album.title}
          </h1>
          <p className="text-[14px] text-[#a1a1aa] font-medium truncate mt-0.5">
            {album.artist}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[12px] text-[#a1a1aa]">
            <span>{album.trackCount} {album.trackCount === 1 ? 'song' : 'songs'}</span>
            <span>•</span>
            <span>{album.totalDuration}</span>
          </div>
        </div>

        {/* Play & Shuffle buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            id="play-album-btn"
            onClick={() => onPlayAlbum(album.tracks, 0)}
            className="px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-[#670211] text-[13px] font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer floating-btn"
          >
            <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              play_arrow
            </span>
            Play
          </button>
          <button
            id="shuffle-album-btn"
            onClick={handleShuffle}
            className="w-10 h-10 rounded-full liquid-glass hover:bg-white/20 text-[#e4e1e7] flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/10"
            title="Shuffle Album"
          >
            <span className="material-symbols-outlined floating-icon text-[19px]">shuffle</span>
          </button>
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
          Tracklist ({album.tracks.length})
        </span>

        {album.tracks.length === 0 ? (
          <div className="p-8 text-center liquid-glass rounded-2xl text-[#a1a1aa] text-[13px]">
            No tracks found for this album.
          </div>
        ) : (
          album.tracks.map((track, idx) => {
            const isThisActive = currentTrack?.id === track.id;
            const downloaded = isDownloaded(track.id);

            return (
              <div
                key={track.id}
                id={`album-track-${track.id}`}
                onClick={() => onSelectTrack(track)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                  isThisActive
                    ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                    : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_8px_20px_0_rgba(0,0,0,0.25)] hover:scale-[1.01] border-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Track number or active equalizer waveform */}
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {isThisActive && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce h-3"></span>
                        <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce h-4 delay-75"></span>
                        <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce h-2 delay-150"></span>
                      </div>
                    ) : (
                      <span className={`text-[13px] font-mono font-bold ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#71717a]'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy">
                    <TrackImage
                      src={track.coverUrl}
                      videoId={track.videoId}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-[14px] font-bold truncate ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#e4e1e7]'}`}>
                      {track.title}
                    </span>
                    <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
                      {track.artist}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Download status icon button */}
                  <button
                    id={`album-download-track-${track.id}`}
                    aria-label="Toggle download"
                    title={downloaded ? 'Downloaded offline' : 'Download for offline'}
                    onClick={() => onToggleDownload(track)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined floating-icon text-[18px]">
                      {downloaded ? 'check_circle' : 'download'}
                    </span>
                  </button>

                  {/* Favorite button */}
                  <button
                    id={`album-fav-track-${track.id}`}
                    aria-label="Toggle favorite"
                    onClick={() => onToggleFavorite(track.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      track.isFavorite ? 'text-[var(--color-primary)]' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined floating-icon text-[18px]"
                      style={{ fontVariationSettings: track.isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {track.isFavorite ? 'favorite' : 'favorite_border'}
                    </span>
                  </button>

                  <span className="text-[12px] text-[#a1a1aa] font-mono min-w-[36px] text-right">
                    {track.duration}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
