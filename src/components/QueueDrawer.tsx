import React, { useState, useRef } from 'react';
import { Track } from '../types';
import { TrackImage } from './TrackImage';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track;
  queue: Track[];
  onPlayFromQueue: (track: Track, index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue: (startIndex: number, endIndex: number) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  isInfiniteAutoPlay: boolean;
  onToggleInfiniteAutoPlay: () => void;
  radioTracks: Track[];
  currentVibe?: string;
  onSelectTrack: (track: Track) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  currentTrack,
  queue,
  onPlayFromQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onPlayNext,
  onAddToQueue,
  onClearQueue,
  onShuffleQueue,
  isInfiniteAutoPlay,
  onToggleInfiniteAutoPlay,
  radioTracks,
  currentVibe,
  onSelectTrack
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Touch swipe state per item
  const [swipingIndex, setSwipingIndex] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartXRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);

  // Active track menu for additional actions
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartXRef.current = e.touches[0].clientX;
    isSwipingRef.current = true;
    setSwipingIndex(index);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    if (!isSwipingRef.current || swipingIndex !== index) return;
    const diff = e.touches[0].clientX - touchStartXRef.current;
    // Only allow left swiping (negative offset)
    if (diff < 0) {
      setSwipeOffset(Math.max(-120, diff));
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = (_e: React.TouchEvent, index: number) => {
    if (!isSwipingRef.current || swipingIndex !== index) return;
    isSwipingRef.current = false;
    
    // If swiped more than 75px to the left, remove from queue
    if (swipeOffset < -75) {
      onRemoveFromQueue(index);
    }
    setSwipingIndex(null);
    setSwipeOffset(0);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onReorderQueue(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div 
      id="queue-drawer-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-lg flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="queue-drawer-content"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-auto liquid-glass-heavy rounded-t-[32px] max-h-[85vh] flex flex-col shadow-2xl border-t border-white/10 overflow-hidden"
      >
        {/* Top Drag Indicator Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1 shrink-0">
          <div className="w-12 h-1 rounded-full bg-white/25" />
        </div>

        {/* Drawer Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined floating-icon text-[var(--color-primary)] text-[22px]">
                queue_music
              </span>
              <h2 className="font-extrabold text-[17px] text-white tracking-tight">
                Up Next Queue
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-mono text-[11px] font-semibold">
                {queue.length}
              </span>
            </div>
            {currentVibe && (
              <span className="text-[11.5px] text-zinc-400 mt-0.5 truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Vibe: <strong className="text-zinc-200 font-semibold">{currentVibe}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Shuffle Queue Button */}
            {queue.length > 1 && (
              <button
                id="queue-shuffle-btn"
                title="Shuffle queue"
                onClick={onShuffleQueue}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/90 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[18px]">
                  shuffle
                </span>
              </button>
            )}

            {/* Clear Queue Button */}
            {queue.length > 0 && (
              <button
                id="queue-clear-btn"
                title="Clear queue"
                onClick={onClearQueue}
                className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-[11.5px] font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                Clear
              </button>
            )}

            {/* Close Button */}
            <button
              id="queue-close-btn"
              aria-label="Close queue"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined floating-icon text-[19px]">
                close
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Queue Content */}
        <div className="overflow-y-auto px-4 py-3 space-y-4 flex-1 no-scrollbar">

          {/* 1. Currently Playing Card */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] px-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] animate-pulse">volume_up</span>
              Now Playing
            </span>

            <div className="p-3 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/60 shadow-md">
                  <TrackImage 
                    src={currentTrack.coverUrl} 
                    videoId={currentTrack.videoId} 
                    alt={currentTrack.title} 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px] animate-pulse">
                      equalizer
                    </span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-bold text-white truncate">
                    {currentTrack.title}
                  </span>
                  <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                    {currentTrack.artist} {currentTrack.album ? `• ${currentTrack.album}` : ''}
                  </span>
                </div>
              </div>
              <span className="text-[12px] text-zinc-400 font-mono shrink-0 pl-2">
                {currentTrack.duration}
              </span>
            </div>
          </div>

          {/* 2. Manual Up Next Queue List */}
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Up Next ({queue.length})
              </span>
              <span className="text-[11px] text-zinc-500">
                Drag to reorder • Swipe to delete
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center flex flex-col items-center justify-center space-y-1.5 text-zinc-400">
                <span className="material-symbols-outlined text-[26px] text-zinc-500">playlist_remove</span>
                <span className="text-[13px] font-medium text-zinc-300">Your queue is empty</span>
                <span className="text-[11.5px] text-zinc-500 max-w-[260px]">
                  {isInfiniteAutoPlay 
                    ? 'Infinite Auto-Play Radio will automatically play similar tracks below.' 
                    : 'Add tracks using "Play Next" or "Add to Queue".'}
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {queue.map((track, idx) => {
                  const isBeingDragged = draggedIndex === idx;
                  const isDropTarget = dragOverIndex === idx;
                  const isCurrentlySwiping = swipingIndex === idx;

                  return (
                    <div
                      key={`queue-${track.id}-${idx}`}
                      className="relative overflow-hidden rounded-xl select-none"
                    >
                      {/* Swipe-to-Remove Red Background Reveal */}
                      <div className="absolute inset-0 bg-red-600/80 rounded-xl flex items-center justify-end px-5 text-white font-semibold text-[13px] gap-1">
                        <span>Remove</span>
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </div>

                      {/* Foreground Track Row */}
                      <div
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleTouchStart(e, idx)}
                        onTouchMove={(e) => handleTouchMove(e, idx)}
                        onTouchEnd={(e) => handleTouchEnd(e, idx)}
                        style={{
                          transform: isCurrentlySwiping ? `translateX(${swipeOffset}px)` : 'none',
                          transition: isCurrentlySwiping ? 'none' : 'transform 0.2s ease-out'
                        }}
                        className={`relative flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isBeingDragged 
                            ? 'opacity-40 scale-98 bg-white/20 border-white/40 shadow-2xl' 
                            : isDropTarget
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 scale-[1.01]'
                            : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.05]'
                        }`}
                        onClick={() => onPlayFromQueue(track, idx)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Tactile Drag Handle */}
                          <div 
                            title="Drag to reorder"
                            className="w-6 h-8 flex items-center justify-center text-zinc-500 hover:text-white cursor-grab active:cursor-grabbing shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-[19px]">
                              drag_indicator
                            </span>
                          </div>

                          {/* Index or Thumbnail */}
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/50">
                            <TrackImage 
                              src={track.coverUrl} 
                              videoId={track.videoId} 
                              alt={track.title} 
                              className="w-full h-full object-cover" 
                            />
                          </div>

                          <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="text-[13.5px] font-semibold text-white truncate">
                              {track.title}
                            </span>
                            <span className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                              {track.artist}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Move Up/Down, Play Next, Remove */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Reorder Buttons (helpful for mobile touch where HTML5 drag can be tricky) */}
                          <div className="flex items-center opacity-60 hover:opacity-100 transition-opacity">
                            {idx > 0 && (
                              <button
                                title="Move up"
                                onClick={() => onReorderQueue(idx, idx - 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[17px]">arrow_upward</span>
                              </button>
                            )}
                            {idx < queue.length - 1 && (
                              <button
                                title="Move down"
                                onClick={() => onReorderQueue(idx, idx + 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[17px]">arrow_downward</span>
                              </button>
                            )}
                          </div>

                          {/* Promote to Play Next (if not already at index 0) */}
                          {idx > 0 && (
                            <button
                              title="Play next after current song"
                              onClick={() => onPlayNext(track)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">playlist_play</span>
                            </button>
                          )}

                          {/* Direct Remove Button */}
                          <button
                            title="Remove from queue"
                            onClick={() => onRemoveFromQueue(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Infinite Auto-Play ("Radio" Takeover Algorithm) Section */}
          <div className="flex flex-col space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px] animate-pulse">
                  radio
                </span>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-white flex items-center gap-1.5">
                    Infinite Auto-Play Radio
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[9px] uppercase tracking-wide border border-emerald-500/30">
                      Seamless
                    </span>
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Plays similar tracks endlessly when queue ends
                  </span>
                </div>
              </div>

              {/* Auto-Play Toggle Switch */}
              <button
                id="toggle-infinite-autoplay"
                onClick={onToggleInfiniteAutoPlay}
                role="switch"
                aria-checked={isInfiniteAutoPlay}
                className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                  isInfiniteAutoPlay ? 'bg-[var(--color-primary)]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform transform ${
                    isInfiniteAutoPlay ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Upcoming Radio Candidates Preview */}
            {isInfiniteAutoPlay && radioTracks.length > 0 && (
              <div className="space-y-1.5 mt-1">
                <div className="px-1 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>Upcoming Radio Recommendations</span>
                  <span className="text-emerald-400 font-medium text-[10.5px]">Auto-Queued</span>
                </div>

                {radioTracks.slice(0, 8).map((radioTrack, rIdx) => (
                  <div
                    key={`radio-rec-${radioTrack.id}-${rIdx}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] transition-all cursor-pointer group"
                    onClick={() => onSelectTrack(radioTrack)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-black/40">
                        <TrackImage 
                          src={radioTrack.coverUrl} 
                          videoId={radioTrack.videoId} 
                          alt={radioTrack.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white truncate">
                          {radioTrack.title}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">
                          {radioTrack.artist}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-zinc-500 font-mono mr-1">
                        {radioTrack.duration}
                      </span>

                      {/* Play Next Button */}
                      <button
                        title="Play next"
                        onClick={() => onPlayNext(radioTrack)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[17px]">playlist_play</span>
                      </button>

                      {/* Add to Queue Button */}
                      <button
                        title="Add to queue"
                        onClick={() => onAddToQueue(radioTrack)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[17px]">playlist_add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
