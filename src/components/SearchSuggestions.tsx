import React, { useEffect, useState, useMemo } from 'react';
import { Track } from '../types';
import { TRACKS } from '../data/musicData';
import { fetchSearchSuggestions } from '../utils/pipedApi';

interface SearchSuggestionsProps {
  query: string;
  onSelectSong?: (track: Track) => void;
  onSelectQuery: (query: string) => void;
  onInsertQuery: (query: string) => void;
  recentSearches: string[];
  onRemoveRecentSearch: (item: string) => void;
  onClearRecentSearches: () => void;
  isVisible: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  onSelectQuery,
  onInsertQuery,
  recentSearches,
  onRemoveRecentSearch,
  onClearRecentSearches,
  isVisible
}) => {
  const [onlineSuggestions, setOnlineSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState<boolean>(false);

  const trimmedQuery = query.trim().toLowerCase();

  // 1. Generate text suggestions from local catalog based on word matches
  const localSuggestions = useMemo(() => {
    if (!trimmedQuery || trimmedQuery.length === 0) return [];

    const suggestions = new Set<string>();
    
    // Split the query into words to match "single single word"
    const queryWords = trimmedQuery.split(/\s+/);

    TRACKS.forEach((track) => {
      const title = track.title;
      const titleLower = title.toLowerCase();
      const artist = track.artist;
      const artistLower = artist.toLowerCase();

      // Check if title or artist contains the query words
      const matchesTitle = queryWords.every(w => titleLower.includes(w));
      const matchesArtist = queryWords.every(w => artistLower.includes(w));

      if (matchesTitle) suggestions.add(title);
      if (matchesArtist) suggestions.add(artist);
      if (matchesTitle && matchesArtist) suggestions.add(`${title} ${artist}`);
    });

    return Array.from(suggestions).slice(0, 5); // Limit local text suggestions
  }, [trimmedQuery]);

  // 2. Fetch online autocomplete queries
  useEffect(() => {
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setOnlineSuggestions([]);
      return;
    }

    let isMounted = true;
    const fetchSuggestions = async () => {
      setIsFetchingSuggestions(true);
      try {
        const results = await fetchSearchSuggestions(trimmedQuery);
        if (isMounted) {
          setOnlineSuggestions(results.slice(0, 5));
        }
      } catch (err) {
        // Silent catch
      } finally {
        if (isMounted) setIsFetchingSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  if (!isVisible) return null;

  // Combine and deduplicate suggestions
  const combinedSuggestions = Array.from(new Set([...localSuggestions, ...onlineSuggestions])).slice(0, 8);

  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="text-white font-bold">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  // If query is empty, show recent searches
  if (!query.trim()) {
    if (recentSearches.length === 0) return null;

    return (
      <div className="w-full liquid-glass/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150 z-20">
        <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.04]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
            <span className="material-symbols-outlined floating-icon text-[15px]">history</span>
            Recent Searches
          </span>
          <button
            onClick={onClearRecentSearches}
            className="text-[11px] text-[#71717a] hover:text-[#e4e1e7] transition-colors cursor-pointer floating-btn"
          >
            Clear all
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {recentSearches.slice(0, 6).map((item) => (
            <div
              key={item}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 rounded-xl transition-colors group cursor-pointer"
              onClick={() => onSelectQuery(item)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined floating-icon text-[#71717a] group-hover:text-[var(--color-primary)] text-[18px]">
                  history
                </span>
                <span className="text-[13px] text-[#e4e1e7] truncate group-hover:text-white">
                  {item}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertQuery(item);
                  }}
                  title="Insert into search"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/[0.06] cursor-pointer"
                >
                  <span className="material-symbols-outlined floating-icon text-[16px]">north_west</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecentSearch(item);
                  }}
                  title="Remove from history"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-rose-400 hover:bg-white/[0.06] cursor-pointer"
                >
                  <span className="material-symbols-outlined floating-icon text-[16px]">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (combinedSuggestions.length === 0 && !isFetchingSuggestions) return null;

  return (
    <div 
      id="search-live-suggestions"
      className="w-full liquid-glass/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 z-20"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.04]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
            <span className="material-symbols-outlined floating-icon text-[15px]">search</span>
            Search Suggestions
          </span>
        </div>
        <div className="flex flex-col gap-0.5 mt-1">
          {combinedSuggestions.map((item) => (
            <div
              key={item}
              onClick={() => onSelectQuery(item)}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 rounded-xl transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined floating-icon text-[#71717a] group-hover:text-[var(--color-primary)] text-[18px]">
                  search
                </span>
                <span className="text-[13px] text-[#e4e1e7] truncate group-hover:text-white">
                  {highlightMatch(item, trimmedQuery)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertQuery(item);
                }}
                title="Insert into search"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/[0.06] cursor-pointer transition-colors shrink-0"
              >
                <span className="material-symbols-outlined floating-icon text-[16px]">north_west</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
