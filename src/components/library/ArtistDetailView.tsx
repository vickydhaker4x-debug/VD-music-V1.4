import React from 'react';
import { Track } from '../../types';
import { EnrichedArtist, EnrichedAlbum } from '../../services/libraryDataService';
import { TrackImage } from '../TrackImage';

interface ArtistDetailViewProps {
  artist: EnrichedArtist;
  currentTrack: Track | null;
  isPlaying: boolean;
  isSubscribed: boolean;
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayArtistTracks: (tracks: Track[], startIndex?: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleSubscription: (artistName: string) => void;
  onSelectAlbum: (album: EnrichedAlbum) => void;
  onToggleDownload: (track: Track) => void;
  isDownloaded: (trackId: string) => boolean;
}

export const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({
  artist,
  currentTrack,
  isPlaying,
  isSubscribed,
  onBack,
  onSelectTrack,
  onPlayArtistTracks,
  onToggleFavorite,
  onToggleSubscription,
  onSelectAlbum,
  onToggleDownload,
  isDownloaded
}) => {
  return (
    <div id="artist-detail-view" className="flex flex-col gap-6 animate-fade-in">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-artists-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-bold text-[#a1a1aa] hover:text-[#e4e1e7] transition-colors cursor-pointer py-1"
        >
          <span className="material-symbols-outlined floating-icon text-[20px]">arrow_back</span>
          Back to Artists
        </button>
      </div>

      {/* Artist Hero Header */}
      <div className="p-6 rounded-3xl liquid-glass border border-white/[0.08] flex flex-col sm:flex-row items-center gap-5 shadow-xl text-center sm:text-left">
        <div className="w-28 h-28 rounded-full overflow-hidden shrink-0 shadow-2xl ring-4 ring-white/10 liquid-glass-heavy">
          <TrackImage
            src={artist.avatarUrl}
            videoId={artist.tracks[0]?.videoId}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Artist
          </span>
          <h1 className="text-[24px] sm:text-[28px] font-black text-[#e4e1e7] truncate mt-0.5">
            {artist.name}
          </h1>
          <p className="text-[13px] text-[#a1a1aa] mt-1">
            {artist.subscribers || '1.2M subscribers'} • {artist.tracks.length} tracks in library
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
            {artist.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[11px] font-medium text-[#e4e1e7] border border-white/[0.08]"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        {/* Subscribe & Play Artist Radio Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            id={`artist-subscribe-toggle-${artist.name}`}
            onClick={() => onToggleSubscription(artist.name)}
            className={`px-4 py-2 rounded-full text-[13px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
              isSubscribed
                ? 'bg-white/[0.12] text-[#e4e1e7] border border-white/20 hover:bg-white/[0.18]'
                : 'bg-[var(--color-primary)] text-[#670211] hover:brightness-110'
            }`}
          >
            <span
              className="material-symbols-outlined floating-icon text-[18px]"
              style={{ fontVariationSettings: isSubscribed ? "'FILL' 1" : "'FILL' 0" }}
            >
              {isSubscribed ? 'notifications_active' : 'person_add'}
            </span>
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>

          {artist.tracks.length > 0 && (
            <button
              id="play-artist-radio-btn"
              onClick={() => onPlayArtistTracks(artist.tracks, 0)}
              className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#e4e1e7] flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/10 shadow-sm"
              title="Play Artist Radio"
            >
              <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                play_arrow
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Popular Tracks Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
            Popular Songs
          </span>
          {artist.tracks.length > 0 && (
            <button
              onClick={() => onPlayArtistTracks(artist.tracks, 0)}
              className="text-[12px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Play All
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {artist.tracks.map((track, idx) => {
            const isThisActive = currentTrack?.id === track.id;
            const downloaded = isDownloaded(track.id);

            return (
              <div
                key={track.id}
                id={`artist-track-${track.id}`}
                onClick={() => onSelectTrack(track)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                  isThisActive
                    ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                    : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_8px_20px_0_rgba(0,0,0,0.25)] hover:scale-[1.01] border-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
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

                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy">
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
                      {track.album || track.plays || 'Top Track'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    aria-label="Toggle download"
                    title={downloaded ? 'Downloaded' : 'Download'}
                    onClick={() => onToggleDownload(track)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined floating-icon text-[18px]">
                      {downloaded ? 'check_circle' : 'download'}
                    </span>
                  </button>

                  <button
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
          })}
        </div>
      </div>

      {/* Albums Section */}
      {artist.albums.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
            Albums &amp; Singles ({artist.albums.length})
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {artist.albums.map((alb) => (
              <div
                key={alb.id}
                onClick={() => onSelectAlbum(alb)}
                className="liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 p-3 rounded-2xl border border-white/[0.04] cursor-pointer group transition-all flex flex-col"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 liquid-glass-heavy shadow-md">
                  <TrackImage
                    src={alb.coverUrl}
                    videoId={alb.tracks[0]?.videoId}
                    alt={alb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-bold text-[13px] text-[#e4e1e7] truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {alb.title}
                </h3>
                <span className="text-[11px] text-[#a1a1aa] mt-0.5 truncate">
                  {alb.year} • {alb.tracks.length} tracks
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
