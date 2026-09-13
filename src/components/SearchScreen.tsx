import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Track, Album, Artist, Playlist, MusicMix, SearchFilterCategory, EnrichedTrackSearchResult } from '../types';
import { TRACKS } from '../data/musicData';
import { searchTracks, getAudioStreamUrl } from '../utils/pipedApi';
import { TrackImage } from './TrackImage';
import { SearchSuggestions } from './SearchSuggestions';
import { searchEngine } from '../services/searchEngine';
import { extractAlbums, extractArtists, EnrichedAlbum, EnrichedArtist } from '../services/libraryDataService';
import { AlbumDetailView } from './library/AlbumDetailView';
import { ArtistDetailView } from './library/ArtistDetailView';
import { networkMonitorService } from '../services/networkMonitorService';
import { offlineDatabaseService } from '../services/offlineDatabaseService';
import { offlineService } from '../services/offlineService';

interface SearchScreenProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onPlayQueue?: (tracks: Track[], startIndex?: number) => void;
  onPlayMix?: (mix: MusicMix) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  currentTrack,
  isPlaying,
  onSelectTrack,
  onPlayQueue,
  onPlayMix
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchFilterCategory>('all');
  const [liveOnlineResults, setLiveOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Selected Album / Artist detail views
  const [selectedAlbum, setSelectedAlbum] = useState<EnrichedAlbum | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<EnrichedArtist | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vd_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const allAlbums = useMemo(() => extractAlbums(TRACKS), []);
  const allArtists = useMemo(() => extractArtists(TRACKS, allAlbums), [allAlbums]);

  const saveRecentSearch = (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    setRecentSearches((prev) => {
      const updated = [cleanTerm, ...prev.filter((i) => i.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('vd_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (item: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i !== item);
      try {
        localStorage.setItem('vd_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('vd_recent_searches');
    } catch {}
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Compute Contextual Local Search Results (Typo-tolerant + Lyrics + Categorized)
  const contextualResults = useMemo(() => {
    if (!activeQuery.trim()) {
      return {
        query: '',
        hasTypoCorrection: false,
        songs: [],
        albums: [],
        artists: [],
        playlists: []
      };
    }
    return searchEngine.search(activeQuery, TRACKS);
  }, [activeQuery]);

  const [isOffline, setIsOffline] = useState<boolean>(() => networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode());

  useEffect(() => {
    const unsubNet = networkMonitorService.subscribe(() => {
      setIsOffline(networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode());
    });
    const unsubOff = offlineService.subscribe(() => {
      setIsOffline(networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode());
    });
    return () => {
      unsubNet();
      unsubOff();
    };
  }, []);

  // Online search when active query is set, with millisecond-exact offline fallback
  useEffect(() => {
    if (!activeQuery.trim()) {
      setLiveOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    let isMounted = true;

    // Exact millisecond network drop check: halt API calls and switch to local database
    if (networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode()) {
      setIsSearchingOnline(false);
      offlineDatabaseService.searchOfflineTracks(activeQuery.trim()).then((localMatches) => {
        if (isMounted) {
          setLiveOnlineResults(localMatches);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    const fetchOnline = async () => {
      setIsSearchingOnline(true);
      try {
        const signal = networkMonitorService.getNetworkAbortSignal();
        const results = await searchTracks(activeQuery.trim(), signal);
        if (isMounted) {
          setLiveOnlineResults(results);
        }
      } catch {
        // If online search is aborted or fails, query local database
        if (isMounted) {
          const localMatches = await offlineDatabaseService.searchOfflineTracks(activeQuery.trim());
          setLiveOnlineResults(localMatches);
        }
      } finally {
        if (isMounted) setIsSearchingOnline(false);
      }
    };

    fetchOnline();
    return () => {
      isMounted = false;
    };
  }, [activeQuery, isOffline]);

  const handleTrackClick = async (track: Track) => {
    setLoadingTrackId(track.id);
    try {
      if (track.audioUrl) {
        onSelectTrack(track);
        return;
      }
      if (track.videoId) {
        const streamUrl = await getAudioStreamUrl(track.videoId);
        if (streamUrl) {
          onSelectTrack({ ...track, audioUrl: streamUrl });
          return;
        }
      }
      onSelectTrack(track);
    } catch {
      onSelectTrack(track);
    } finally {
      setLoadingTrackId(null);
    }
  };

  const handleAlbumClick = (album: Album) => {
    const enriched = allAlbums.find((a) => a.id === album.id || a.title.toLowerCase() === album.title.toLowerCase());
    if (enriched) {
      setSelectedAlbum(enriched);
    } else {
      // Find tracks
      const matchingTracks = TRACKS.filter((t) => t.album?.toLowerCase() === album.title.toLowerCase());
      setSelectedAlbum({
        ...album,
        tracks: matchingTracks,
        totalSec: matchingTracks.reduce((acc, t) => acc + (t.durationSec || 200), 0),
        totalDuration: `${matchingTracks.length * 3} min`
      });
    }
  };

  const handleArtistClick = (artist: Artist) => {
    const enriched = allArtists.find((a) => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase());
    if (enriched) {
      setSelectedArtist(enriched);
    } else {
      const artTracks = TRACKS.filter((t) => t.artist.toLowerCase().includes(artist.name.toLowerCase()));
      setSelectedArtist({
        ...artist,
        tracks: artTracks,
        albums: []
      });
    }
  };

  const handlePlaylistClick = (item: Playlist | MusicMix) => {
    if ('badge' in item && onPlayMix) {
      onPlayMix(item as MusicMix);
    } else if ('tracks' in item && (item as Playlist).tracks.length > 0) {
      if (onPlayQueue) {
        onPlayQueue((item as Playlist).tracks, 0);
      } else {
        onSelectTrack((item as Playlist).tracks[0]);
      }
    }
  };

  // If viewing detailed album
  if (selectedAlbum) {
    return (
      <AlbumDetailView
        album={selectedAlbum}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onBack={() => setSelectedAlbum(null)}
        onSelectTrack={onSelectTrack}
        onPlayQueue={onPlayQueue || ((tr, idx) => onSelectTrack(tr[idx || 0]))}
        onTogglePlay={() => {}}
        onToggleFavorite={() => {}}
      />
    );
  }

  // If viewing detailed artist
  if (selectedArtist) {
    return (
      <ArtistDetailView
        artist={selectedArtist}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onBack={() => setSelectedArtist(null)}
        onSelectTrack={onSelectTrack}
        onPlayQueue={onPlayQueue || ((tr, idx) => onSelectTrack(tr[idx || 0]))}
        onTogglePlay={() => {}}
        onToggleFavorite={() => {}}
        onSelectAlbum={handleAlbumClick}
      />
    );
  }

  // Combined song list (local matches + online matches deduplicated)
  const combinedSongs: EnrichedTrackSearchResult[] = [...contextualResults.songs];
  const seenIds = new Set(contextualResults.songs.map((s) => s.id));

  liveOnlineResults.forEach((ot) => {
    if (!seenIds.has(ot.id) && !seenIds.has(ot.title.toLowerCase())) {
      seenIds.add(ot.id);
      seenIds.add(ot.title.toLowerCase());
      combinedSongs.push(ot);
    }
  });

  const totalResultsCount =
    combinedSongs.length +
    contextualResults.albums.length +
    contextualResults.artists.length +
    contextualResults.playlists.length;

  return (
    <div id="search-screen-view" className="flex flex-col w-full px-4 sm:px-6 gap-4 pb-28 max-w-4xl mx-auto animate-fade-in">
      {/* Search Input Bar */}
      <div ref={searchContainerRef} className="relative w-full mt-2 z-30">
        <div className="flex items-center w-full h-12 bg-white/[0.06] backdrop-blur-2xl rounded-2xl px-4 border border-white/[0.08] shadow-lg focus-within:border-red-500 transition-colors">
          <button
            onClick={() => {
              if (inputQuery.trim()) {
                setActiveQuery(inputQuery.trim());
                saveRecentSearch(inputQuery.trim());
                setShowSuggestions(false);
              }
            }}
            className="material-symbols-outlined floating-icon text-zinc-400 hover:text-red-400 text-[22px] mr-3 cursor-pointer transition-colors"
          >
            {isSearchingOnline ? 'sync' : 'search'}
          </button>
          <input
            id="search-input-field"
            type="text"
            value={inputQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setInputQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputQuery.trim()) {
                setActiveQuery(inputQuery.trim());
                setShowSuggestions(false);
                saveRecentSearch(inputQuery.trim());
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search songs, artists, albums, or lyrics (e.g. 'love storiyan')..."
            className="w-full bg-transparent text-[14px] text-white placeholder:text-zinc-500 focus:outline-none"
          />
          {inputQuery && (
            <button
              onClick={() => {
                setInputQuery('');
                setActiveQuery('');
                setLiveOnlineResults([]);
                setShowSuggestions(true);
              }}
              className="text-zinc-400 hover:text-white p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Live Search Suggestions Dropdown */}
        <div className="absolute top-full left-0 right-0 mt-2 z-40">
          <SearchSuggestions
            query={inputQuery}
            isVisible={showSuggestions}
            onSelectSong={(track) => {
              handleTrackClick(track);
              saveRecentSearch(track.title);
              setShowSuggestions(false);
            }}
            onSelectQuery={(q) => {
              setInputQuery(q);
              setActiveQuery(q);
              saveRecentSearch(q);
              setShowSuggestions(false);
            }}
            onInsertQuery={(q) => {
              setInputQuery(q);
              setShowSuggestions(true);
            }}
            recentSearches={recentSearches}
            onRemoveRecentSearch={removeRecentSearch}
            onClearRecentSearches={clearRecentSearches}
          />
        </div>
      </div>

      {/* Contextual Filter Category Pills */}
      {activeQuery.trim().length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none shrink-0">
          {(['all', 'songs', 'albums', 'artists', 'playlists'] as SearchFilterCategory[]).map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-bold tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-black shadow-md scale-105'
                    : 'bg-white/[0.08] text-zinc-300 hover:bg-white/[0.14] hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Typo Correction Banner */}
      {contextualResults.hasTypoCorrection && contextualResults.correctedQuery && (
        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-[13px] text-zinc-300">
            <span className="material-symbols-outlined floating-icon text-[18px] text-amber-400">
              spellcheck
            </span>
            <span>
              Showing results for{' '}
              <strong className="text-white font-bold underline cursor-pointer" onClick={() => {
                setInputQuery(contextualResults.correctedQuery!);
                setActiveQuery(contextualResults.correctedQuery!);
              }}>
                {contextualResults.correctedQuery}
              </strong>
            </span>
          </div>
          <button
            onClick={() => {
              setInputQuery(activeQuery);
            }}
            className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Search instead for &quot;{activeQuery}&quot;
          </button>
        </div>
      )}

      {/* Results Header Info */}
      {activeQuery.trim().length > 0 && (
        <div className="flex items-center justify-between text-[12px] text-zinc-400 px-0.5">
          <div className="flex items-center gap-2 font-medium">
            <span>
              {isSearchingOnline ? 'Searching catalog & YouTube...' : `Results for "${activeQuery}"`}
            </span>
            {isSearchingOnline && (
              <span className="material-symbols-outlined floating-icon text-[16px] text-red-500 animate-spin">
                sync
              </span>
            )}
          </div>
          <span>{totalResultsCount} items</span>
        </div>
      )}

      {/* Zero State (When query is empty) */}
      {!activeQuery.trim() && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400">
            <span className="material-symbols-outlined floating-icon text-[32px]">travel_explore</span>
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-[16px] font-bold text-white">Contextual Music Search</h3>
            <p className="text-[13px] text-zinc-400">
              Find songs by lyrics (e.g. &quot;love storiyan&quot;), search artists, albums, or discover fresh tracks with typo-tolerant matching.
            </p>
          </div>

          {/* Quick Popular Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mt-2">
            {['Kesariya', 'Arijit Singh', 'Sidhu Moosewala', 'Brown Munde', 'Starboy', 'Dil ke nagar'].map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setInputQuery(chip);
                  setActiveQuery(chip);
                  saveRecentSearch(chip);
                }}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-[12px] font-medium border border-white/10 transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ALL (Bento Overview with Top Result, Songs, Artists, Albums, Playlists) */}
      {activeQuery.trim().length > 0 && activeCategory === 'all' && (
        <div className="space-y-6">
          {/* Top Result Card */}
          {contextualResults.topResult && (
            <div className="p-4 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`relative overflow-hidden shrink-0 border border-white/10 ${
                  contextualResults.topResult.type === 'artist' ? 'w-20 h-20 rounded-full' : 'w-20 h-20 rounded-2xl'
                }`}>
                  <img
                    src={'coverUrl' in contextualResults.topResult.item ? contextualResults.topResult.item.coverUrl : (contextualResults.topResult.item as Artist).avatarUrl}
                    alt={'name' in contextualResults.topResult.item ? contextualResults.topResult.item.name : contextualResults.topResult.item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white uppercase tracking-wider">
                      Top Result
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400 capitalize">
                      {contextualResults.topResult.type}
                    </span>
                  </div>
                  <h4 className="text-[18px] font-black text-white truncate">
                    {'name' in contextualResults.topResult.item ? contextualResults.topResult.item.name : contextualResults.topResult.item.title}
                  </h4>
                  <p className="text-[13px] text-zinc-400 truncate mt-0.5">
                    {contextualResults.topResult.type === 'artist'
                      ? `${(contextualResults.topResult.item as Artist).subscribers || 'Artist'} • ${(contextualResults.topResult.item as Artist).trackCount} tracks`
                      : contextualResults.topResult.type === 'album'
                      ? `${(contextualResults.topResult.item as Album).artist} • ${(contextualResults.topResult.item as Album).year || 'Album'}`
                      : `${(contextualResults.topResult.item as Track).artist} • ${(contextualResults.topResult.item as Track).album}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (contextualResults.topResult?.type === 'artist') {
                    handleArtistClick(contextualResults.topResult.item as Artist);
                  } else if (contextualResults.topResult?.type === 'album') {
                    handleAlbumClick(contextualResults.topResult.item as Album);
                  } else {
                    handleTrackClick(contextualResults.topResult!.item as Track);
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-[13px] hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
              >
                <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
                <span>Play</span>
              </button>
            </div>
          )}

          {/* Section: Songs */}
          {combinedSongs.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Songs</h3>
                {combinedSongs.length > 4 && (
                  <button
                    onClick={() => setActiveCategory('songs')}
                    className="text-[12px] font-semibold text-red-400 hover:text-red-300"
                  >
                    See all ({combinedSongs.length})
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {combinedSongs.slice(0, 5).map((track) => renderSongRow(track))}
              </div>
            </div>
          )}

          {/* Section: Artists Carousel */}
          {contextualResults.artists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Artists</h3>
                {contextualResults.artists.length > 3 && (
                  <button
                    onClick={() => setActiveCategory('artists')}
                    className="text-[12px] font-semibold text-red-400 hover:text-red-300"
                  >
                    See all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {contextualResults.artists.slice(0, 4).map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => handleArtistClick(artist)}
                    className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden mb-2.5 border border-white/10 group-hover:scale-105 transition-transform">
                      <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[13px] font-bold text-white truncate w-full text-center">
                      {artist.name}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate w-full text-center mt-0.5">
                      {artist.subscribers || `${artist.trackCount} songs`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Albums Grid */}
          {contextualResults.albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Albums</h3>
                {contextualResults.albums.length > 3 && (
                  <button
                    onClick={() => setActiveCategory('albums')}
                    className="text-[12px] font-semibold text-red-400 hover:text-red-300"
                  >
                    See all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {contextualResults.albums.slice(0, 4).map((album) => (
                  <div
                    key={album.id}
                    onClick={() => handleAlbumClick(album)}
                    className="flex flex-col p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 border border-white/10 group-hover:scale-105 transition-transform">
                      <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[13px] font-bold text-white truncate">
                      {album.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {album.artist} • {album.year}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Playlists & Mixes */}
          {contextualResults.playlists.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[16px] font-bold text-white">Playlists & Curated Mixes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contextualResults.playlists.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handlePlaylistClick(item)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                      {'coverGrid' in item ? (
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                          {(item as MusicMix).coverGrid.map((img, i) => (
                            <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-red-950/40 text-red-400">
                          <span className="material-symbols-outlined floating-icon text-[24px]">queue_music</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-bold text-white truncate">
                        {'title' in item ? item.title : item.name}
                      </span>
                      <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                        {'subtitle' in item ? item.subtitle : `${(item as Playlist).tracks?.length || 0} tracks`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SONGS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'songs' && (
        <div className="space-y-2">
          {combinedSongs.map((track) => renderSongRow(track))}
          {combinedSongs.length === 0 && (
            <div className="py-12 text-center text-zinc-400 text-sm">
              No matching songs found for &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* TAB: ALBUMS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'albums' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {contextualResults.albums.map((album) => (
            <div
              key={album.id}
              onClick={() => handleAlbumClick(album)}
              className="flex flex-col p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group"
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 border border-white/10 group-hover:scale-105 transition-transform">
                <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
              </div>
              <span className="text-[14px] font-bold text-white truncate">
                {album.title}
              </span>
              <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                {album.artist} • {album.year}
              </span>
            </div>
          ))}
          {contextualResults.albums.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
              No albums matched &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* TAB: ARTISTS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {contextualResults.artists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => handleArtistClick(artist)}
              className="flex flex-col items-center p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group text-center"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border border-white/10 group-hover:scale-105 transition-transform">
                <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-[14px] font-bold text-white truncate w-full">
                {artist.name}
              </span>
              <span className="text-[12px] text-zinc-400 truncate w-full mt-0.5">
                {artist.subscribers || `${artist.trackCount} tracks`}
              </span>
              {artist.genres && artist.genres.length > 0 && (
                <span className="text-[10px] font-medium text-red-400 mt-1 uppercase tracking-wider">
                  {artist.genres[0]}
                </span>
              )}
            </div>
          ))}
          {contextualResults.artists.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
              No artists matched &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* TAB: PLAYLISTS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'playlists' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {contextualResults.playlists.map((item) => (
            <div
              key={item.id}
              onClick={() => handlePlaylistClick(item)}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                {'coverGrid' in item ? (
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {(item as MusicMix).coverGrid.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-red-950/40 text-red-400">
                    <span className="material-symbols-outlined floating-icon text-[28px]">queue_music</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-bold text-white truncate">
                  {'title' in item ? item.title : item.name}
                </span>
                <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                  {'subtitle' in item ? item.subtitle : `${(item as Playlist).tracks?.length || 0} tracks`}
                </span>
              </div>
            </div>
          ))}
          {contextualResults.playlists.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
              No playlists matched &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );

  function renderSongRow(track: EnrichedTrackSearchResult) {
    const isThisTrackActive = currentTrack?.id === track.id;
    const isLoadingThis = loadingTrackId === track.id;

    return (
      <div
        key={track.id}
        onClick={() => handleTrackClick(track)}
        className={`flex flex-col p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all border ${
          isThisTrackActive
            ? 'bg-red-500/15 border-red-500/40 shadow-lg'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.05]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
              <TrackImage
                src={track.coverUrl}
                videoId={track.videoId}
                alt={track.title}
                className="w-full h-full object-cover"
              />
              {isThisTrackActive && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="material-symbols-outlined floating-icon text-red-500 text-[22px] animate-pulse">
                    {isPlaying ? 'volume_up' : 'pause'}
                  </span>
                </div>
              )}
              {isLoadingThis && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="material-symbols-outlined floating-icon text-red-500 text-[20px] animate-spin">
                    progress_activity
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-[14px] font-bold truncate ${isThisTrackActive ? 'text-red-400' : 'text-white'}`}>
                {track.title}
              </span>
              <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                {track.artist} • {track.album}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-zinc-400 font-mono">{track.duration}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
              {track.quality?.includes('320') ? '320k' : track.quality?.includes('FLAC') ? 'FLAC' : 'Hi-Res'}
            </span>
          </div>
        </div>

        {/* Lyric Snippet Highlight if matched in lyrics */}
        {track.lyricMatch && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-amber-300/90 font-medium">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider shrink-0">
              Matched in Lyrics
            </span>
            <span className="italic truncate">
              &quot;{track.lyricMatch.matchedLine}&quot;
            </span>
          </div>
        )}
      </div>
    );
  }
};
