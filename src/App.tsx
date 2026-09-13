import { useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Track, ActiveScreen, SettingsState, MusicMix, MusicVideoItem } from './types';
import { TRACKS, INITIAL_SETTINGS } from './data/musicData';
import { audioEngine } from './utils/audioPlayer';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { HomeScreen } from './components/HomeScreen';
import { ExploreScreen } from './components/ExploreScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { NowPlayingScreen } from './components/NowPlayingScreen';
import { AccountSyncModal } from './components/AccountSyncModal';
import { SearchScreen } from './components/SearchScreen';
import { LibraryScreen } from './components/LibraryScreen';
import { BackgroundPermissionModal } from './components/BackgroundPermissionModal';
import { BootSplashScreen } from './components/BootSplashScreen';
import { PlanScreen } from './components/PlanScreen';
import { MusicVideoModal } from './components/MusicVideoModal';
import { OnboardingModal } from './components/OnboardingModal';
import { personalizationService, PersonalizedHomeData } from './services/personalizationService';
import { offlineService } from './services/offlineService';
import { streamingEngine } from './services/streamingEngine';
import { mediaSessionService } from './services/mediaSessionService';
import { networkMonitorService } from './services/networkMonitorService';
import { offlineDatabaseService } from './services/offlineDatabaseService';
import { NetworkOfflineBanner } from './components/NetworkOfflineBanner';

export default function App() {
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('vd_user_name') || '';
    } catch {
      return '';
    }
  });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    return !personalizationService.isColdStartCompleted();
  });
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [activeVideo, setActiveVideo] = useState<MusicVideoItem | null>(null);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('vd_favorite_track_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {}
    return new Set<string>();
  });
  const [tracks, setTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('vd_favorite_track_ids');
      if (saved) {
        const favSet = new Set<string>(JSON.parse(saved));
        return TRACKS.map((t) => ({ ...t, isFavorite: favSet.has(t.id) }));
      }
    } catch {}
    return TRACKS;
  });
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [isAccountSyncOpen, setIsAccountSyncOpen] = useState<boolean>(false);
  const [showBackgroundPermission, setShowBackgroundPermission] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vd_background_playback_permission') === null;
    } catch {
      return false;
    }
  });
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem('vd_user_settings_v3');
      if (saved) {
        return { ...INITIAL_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {}
    return INITIAL_SETTINGS;
  });

  // Save settings whenever they update
  useEffect(() => {
    try {
      localStorage.setItem('vd_user_settings_v3', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Sync playback & streaming settings to AudioEngine
  useEffect(() => {
    audioEngine.configure({
      volumeNormalization: settings.volumeNormalization,
      skipSilence: settings.skipSilence,
      skipSponsor: settings.skipSponsor,
      audioQuality: settings.audioQuality,
      streamingInstance: settings.invidiousInstance,
      backgroundPlayback: settings.backgroundPlayback
    });
  }, [
    settings.volumeNormalization,
    settings.skipSilence,
    settings.skipSponsor,
    settings.audioQuality,
    settings.invidiousInstance,
    settings.backgroundPlayback
  ]);

  // YouTube Music / Spotify-Style Personalization State
  const [queue, setQueue] = useState<Track[]>([]);
  const [playbackHistory, setPlaybackHistory] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('vd_playback_history_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [personalizedHome, setPersonalizedHome] = useState<PersonalizedHomeData | null>(null);
  const [activeVibe, setActiveVibe] = useState<string>('Bollywood Melody & Romance');
  const [vibeToast, setVibeToast] = useState<{ title: string; vibe: string } | null>(null);

  const [isShuffle, setIsShuffle] = useState(true);
  const [repeatMode, setRepeatMode] = useState<'all' | 'one' | 'off'>('off');
  const [isInfiniteAutoPlay, setIsInfiniteAutoPlay] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vd_infinite_autoplay');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [radioTracks, setRadioTracks] = useState<Track[]>([]);

  const [isOfflineOnly, setIsOfflineOnly] = useState<boolean>(() => offlineService.isOfflineOnlyMode() || networkMonitorService.isOffline());
  const [offlineTracks, setOfflineTracks] = useState<Track[]>(() => offlineDatabaseService.getOfflineTracksSync());

  useEffect(() => {
    const handleUpdate = () => {
      setIsOfflineOnly(offlineService.isOfflineOnlyMode() || networkMonitorService.isOffline());
      setOfflineTracks(offlineDatabaseService.getOfflineTracksSync());
    };

    const unsubOff = offlineService.subscribe(handleUpdate);
    const unsubNet = networkMonitorService.subscribe(handleUpdate);

    return () => {
      unsubOff();
      unsubNet();
    };
  }, []);

  // When offline, active display tracks switch instantly to local database
  const activeDisplayTracks = isOfflineOnly && offlineTracks.length > 0 ? offlineTracks : tracks;

  // Update dynamic upcoming radio recommendations whenever currentTrack changes
  useEffect(() => {
    if (currentTrack) {
      const instantRadio = personalizationService.getInstantPersonalizedQueue(currentTrack, tracks, playbackHistory);
      setRadioTracks(instantRadio.slice(0, 8));
      personalizationService.generatePersonalizedQueue(currentTrack, tracks, playbackHistory).then((pTracks) => {
        if (pTracks && pTracks.length > 0) {
          setRadioTracks(pTracks.slice(0, 8));
        }
      });
    }
  }, [currentTrack?.id]);

  // Initialize personalized home and queue on startup
  useEffect(() => {
    const initialHome = personalizationService.generatePersonalizedHome(TRACKS[0], tracks);
    setPersonalizedHome(initialHome);
    setActiveVibe(initialHome.radioVibe);
    setQueue([]);
  }, []);

  // Subscribe to personalization engine changes (likes, dislikes, loops, cold-start)
  useEffect(() => {
    const unsub = personalizationService.subscribe(() => {
      setPersonalizedHome(personalizationService.generatePersonalizedHome(currentTrack, tracks));
    });
    return unsub;
  }, [currentTrack, tracks]);

  // Apply accent color and pure black mode to root document
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accentColor);
    if (settings.pureBlackAmoled) {
      document.documentElement.classList.add('pure-black');
      document.body.classList.add('pure-black');
    } else {
      document.documentElement.classList.remove('pure-black');
      document.body.classList.remove('pure-black');
    }
  }, [settings.accentColor, settings.pureBlackAmoled]);

  // Sleep timer countdown & auto-pause handler
  useEffect(() => {
    if (!settings.sleepTimerRemaining || settings.sleepTimerRemaining <= 0) return;

    const sleepTimerInterval = window.setInterval(() => {
      setSettings((prev) => {
        if (!prev.sleepTimerRemaining || prev.sleepTimerRemaining <= 1) {
          setIsPlaying(false);
          audioEngine.pause();
          return { ...prev, sleepTimerRemaining: null };
        }
        return { ...prev, sleepTimerRemaining: prev.sleepTimerRemaining - 1 };
      });
    }, 60000);

    return () => clearInterval(sleepTimerInterval);
  }, [settings.sleepTimerRemaining]);

  // Handle Android hardware back button and browser history
  useEffect(() => {
    let backButtonHandle: any = null;

    const setupBackButton = async () => {
      try {
        backButtonHandle = await CapApp.addListener('backButton', () => {
          if (isAccountSyncOpen) {
            setIsAccountSyncOpen(false);
          } else if (isNowPlayingOpen) {
            setIsNowPlayingOpen(false);
          } else if (activeScreen !== 'home') {
            setActiveScreen('home');
          } else {
            CapApp.exitApp();
          }
        });
      } catch {
        // Not running in Capacitor environment
      }
    };

    setupBackButton();

    const handlePopState = () => {
      if (isAccountSyncOpen) {
        setIsAccountSyncOpen(false);
      } else if (isNowPlayingOpen) {
        setIsNowPlayingOpen(false);
      } else if (activeScreen !== 'home') {
        setActiveScreen('home');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      if (backButtonHandle && backButtonHandle.remove) {
        backButtonHandle.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAccountSyncOpen, isNowPlayingOpen, activeScreen]);

  // Push history state whenever user enters a subview or modal
  useEffect(() => {
    window.history.pushState(
      { screen: activeScreen, nowPlaying: isNowPlayingOpen, accountSync: isAccountSyncOpen },
      ''
    );
  }, [activeScreen, isNowPlayingOpen, isAccountSyncOpen]);

  // Handle equalizer preset updates
  useEffect(() => {
    audioEngine.setPreset(settings.equalizerPreset);
  }, [settings.equalizerPreset]);

  const handleTogglePlay = () => {
    if (!currentTrack) {
      if (tracks.length > 0) {
        handleSelectTrack(tracks[0]);
      }
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      audioEngine.pause();
    } else {
      setIsPlaying(true);
      audioEngine.resume();
    }
  };

  const handleSelectTrack = async (track: Track, keepQueue = false) => {
    // 1. Record listen in personalization engine & update active vibe
    const { vibe } = personalizationService.recordTrackListen(track);
    setActiveVibe(vibe);

    // 2. Add current played track to device playback history (deduped, newest first with exact timestamp)
    const trackWithTimestamp: Track = {
      ...track,
      playedAt: Date.now()
    };
    const newHistory = [trackWithTimestamp, ...playbackHistory.filter((t) => t.id !== track.id)].slice(0, 100);
    setPlaybackHistory(newHistory);
    try {
      localStorage.setItem('vd_playback_history_v1', JSON.stringify(newHistory));
    } catch {}

    // Auto-sync Smart Downloads for offline caching based on user frequency
    offlineService.syncSmartDownloads(newHistory, tracks);

    // 3. Show dynamic personalization toast badge
    if (!keepQueue) {
      setVibeToast({ title: track.title, vibe });
      setTimeout(() => {
        setVibeToast(null);
      }, 3200);
    }

    const enrichedTrack = {
      ...trackWithTimestamp,
      isFavorite: favoriteTrackIds.has(track.id) || Boolean(track.isFavorite)
    };
    setCurrentTrack(enrichedTrack);
    setCurrentTimeSec(0);
    setIsPlaying(true);

    const activeQ = keepQueue ? queue : personalizationService.getInstantPersonalizedQueue(track, tracks, newHistory);

    if (!keepQueue) {
      // 4. Update personalized Home data
      const homeData = personalizationService.generatePersonalizedHome(track, tracks);
      setPersonalizedHome(homeData);

      // 5. Generate INSTANT dynamic Up Next queue (exact same artist/genre/vibe)
      setQueue(activeQ);

      // Background online recommendation enrichment
      personalizationService.generatePersonalizedQueue(track, tracks, newHistory).then((personalizedQ) => {
        if (personalizedQ && personalizedQ.length > 0) {
          setQueue(personalizedQ);
          // Keep pre-buffer standby deck synchronized with new queue head
          streamingEngine.prefetchNextInQueue(track, personalizedQ);
        }
      });
    }

    // 6. Play real song directly via Universal Audio Engine with Zero-Latency Pre-buffering
    audioEngine.play(
      track,
      (sec) => setCurrentTimeSec(Math.floor(sec)),
      () => handleNextTrack(),
      undefined,
      activeQ
    );
  };

  const handlePlayQueue = (trackList: Track[], startIndex = 0) => {
    if (!trackList || trackList.length === 0) return;
    const startTrack = trackList[startIndex] || trackList[0];
    const remaining = trackList.slice(startIndex + 1);
    handleSelectTrack(startTrack, true);
    setQueue(remaining);
  };

  const handleNextTrack = () => {
    // 1. Listen History Weighting: Record early skip penalty if skipped before 22s
    if (currentTrack && currentTimeSec < 22) {
      personalizationService.recordTrackSkip(currentTrack, currentTimeSec);
    }

    // 2. If repeating one track, record loop count bonus and replay
    if (repeatMode === 'one') {
      if (currentTrack) {
        personalizationService.recordTrackLoop(currentTrack);
      }
      audioEngine.seek(0);
      return;
    }

    // Filter out any disliked songs from the remaining queue
    const eligibleQueue = queue.filter((t) => !personalizationService.isDisliked(t.id));

    if (eligibleQueue.length > 0) {
      const nextTrack = eligibleQueue[0];
      const remainingQueue = eligibleQueue.slice(1);
      
      // If queue is running low and infinite auto-play is enabled, generate and append more tracks seamlessly
      if (isInfiniteAutoPlay && remainingQueue.length < 4) {
        personalizationService.generatePersonalizedQueue(nextTrack, tracks, [currentTrack, ...playbackHistory, ...remainingQueue]).then((moreTracks) => {
          if (moreTracks && moreTracks.length > 0) {
            setQueue((prevQueue) => {
              const existingIds = new Set(prevQueue.map((t) => t.id));
              if (currentTrack) existingIds.add(currentTrack.id);
              existingIds.add(nextTrack.id);
              const newTracks = moreTracks.filter((t) => !existingIds.has(t.id) && !personalizationService.isDisliked(t.id));
              return [...prevQueue, ...newTracks];
            });
          }
        });
      }
      
      setQueue(remainingQueue);
      handleSelectTrack(nextTrack, true);
    } else if (isInfiniteAutoPlay) {
      // Infinite Auto-Play Radio: When queue ends, seamlessly generate similar tracks
      const baseTrack = currentTrack || tracks[0];
      const radioNext = personalizationService.getInstantPersonalizedQueue(baseTrack, tracks, playbackHistory)
        .filter((t) => !personalizationService.isDisliked(t.id));
      if (radioNext.length > 0) {
        const nextTrack = radioNext[0];
        setQueue(radioNext.slice(1));
        handleSelectTrack(nextTrack, true);
        setVibeToast({
          title: 'Infinite Radio Auto-Play',
          vibe: `Playing songs like "${baseTrack.title}"`
        });
        setTimeout(() => setVibeToast(null), 2500);
      } else {
        const currentIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : -1;
        const nextIndex = (currentIndex + 1) % tracks.length;
        handleSelectTrack(tracks[nextIndex]);
      }
    } else {
      // Auto-play is off: check if repeat all is active or pause
      if (repeatMode === 'all') {
        const currentIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : -1;
        const nextIndex = (currentIndex + 1) % tracks.length;
        handleSelectTrack(tracks[nextIndex]);
      } else {
        setIsPlaying(false);
        audioEngine.pause();
      }
    }
  };

  const handlePrevTrack = () => {
    if (playbackHistory.length > 0) {
      const prevTrack = playbackHistory[0];
      setPlaybackHistory((prev) => prev.slice(1));
      if (currentTrack) setQueue((prev) => [currentTrack, ...prev]);
      handleSelectTrack(prevTrack, true);
    } else if (currentTrack) {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
      const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      handleSelectTrack(tracks[prevIndex]);
    } else {
      handleSelectTrack(tracks[0]);
    }
  };

  // Wire OS MediaSession Lockscreen Next / Prev / Favorite buttons to internal app state
  useEffect(() => {
    audioEngine.setExternalControls(
      () => handleNextTrack(),
      () => handlePrevTrack()
    );

    mediaSessionService.registerCallbacks({
      onNext: () => handleNextTrack(),
      onPrevious: () => handlePrevTrack(),
      onToggleFavorite: () => {
        if (currentTrack) {
          handleToggleFavorite(currentTrack.id);
        }
      }
    });
  }, [currentTrack, queue, playbackHistory]);

  const handlePlayFromQueue = (track: Track, index: number) => {
    const remainingQueue = queue.slice(index + 1);
    setQueue(remainingQueue);
    handleSelectTrack(track, true);
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReorderQueue = (startIndex: number, endIndex: number) => {
    setQueue((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(startIndex, 1);
      updated.splice(endIndex, 0, moved);
      return updated;
    });
  };

  const handlePlayNext = (track: Track) => {
    setQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [track, ...filtered];
    });
    setVibeToast({
      title: 'Playing Next',
      vibe: `"${track.title}" placed at top of queue`
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleAddToQueue = (track: Track) => {
    setQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [...filtered, track];
    });
    setVibeToast({
      title: 'Added to Queue',
      vibe: `"${track.title}" added to queue`
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleClearQueue = () => {
    setQueue([]);
    setVibeToast({
      title: 'Queue Cleared',
      vibe: 'All upcoming tracks removed'
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleShuffleQueue = () => {
    setQueue((prev) => [...prev].sort(() => Math.random() - 0.5));
    setVibeToast({
      title: 'Queue Shuffled',
      vibe: 'Upcoming tracks randomized'
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleToggleInfiniteAutoPlay = () => {
    setIsInfiniteAutoPlay((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vd_infinite_autoplay', JSON.stringify(next));
      } catch {}
      setVibeToast({
        title: next ? 'Infinite Auto-Play On' : 'Infinite Auto-Play Off',
        vibe: next ? 'Radio continues automatically when queue ends' : 'Playback stops when queue ends'
      });
      setTimeout(() => setVibeToast(null), 2400);
      return next;
    });
  };

  const handleSeek = (seconds: number) => {
    setCurrentTimeSec(seconds);
    audioEngine.seek(seconds);
  };

  const handlePlayMix = (mix: MusicMix) => {
    const mixTracks = tracks.filter((t) => mix.trackIds.includes(t.id));
    if (mixTracks.length > 0) {
      handleSelectTrack(mixTracks[0]);
      setQueue(mixTracks.slice(1));
    }
  };

  const handlePlayVideoAudioOnly = (video: MusicVideoItem) => {
    const matchingTrack = tracks.find((t) => t.videoId === video.videoId || t.id === video.trackId);
    if (matchingTrack) {
      handleSelectTrack(matchingTrack);
    } else {
      const syntheticTrack: Track = {
        id: `vid-track-${video.videoId}`,
        title: video.title,
        artist: video.artist,
        album: 'YouTube Music Video',
        duration: video.duration,
        durationSec: 220,
        coverUrl: video.thumbnailUrl,
        videoId: video.videoId,
        quality: '320kbps High-Res Audio'
      };
      handleSelectTrack(syntheticTrack);
    }
  };

  const handleToggleFavorite = (trackId: string) => {
    let isNowFav = false;

    setFavoriteTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
        isNowFav = false;
      } else {
        next.add(trackId);
        isNowFav = true;
      }
      try {
        localStorage.setItem('vd_favorite_track_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setTracks((prev) => {
      const exists = prev.some((t) => t.id === trackId);
      if (!exists && currentTrack?.id === trackId) {
        return [{ ...currentTrack, isFavorite: isNowFav }, ...prev];
      }
      return prev.map((t) => (t.id === trackId ? { ...t, isFavorite: isNowFav } : t));
    });

    if (currentTrack?.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: isNowFav } : null));
      mediaSessionService.updateFavoriteState(isNowFav);
    }

    // Weighting Algorithm: Record Like/Dislike in taste profile
    personalizationService.toggleLike(trackId, isNowFav);

    setPersonalizedHome((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quickPicks: prev.quickPicks.map((t) => (t.id === trackId ? { ...t, isFavorite: isNowFav } : t)),
        basedOnSection: {
          ...prev.basedOnSection,
          tracks: prev.basedOnSection.tracks.map((t) => (t.id === trackId ? { ...t, isFavorite: isNowFav } : t))
        }
      };
    });

    setVibeToast({
      title: isNowFav ? 'Added to Favorites' : 'Removed from Favorites',
      vibe: isNowFav ? 'Song saved in your library ❤️' : 'Song removed from library'
    });
    setTimeout(() => setVibeToast(null), 2400);
  };

  const handleToggleDislike = (trackId: string) => {
    personalizationService.toggleDislike(trackId);
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
    setPersonalizedHome(personalizationService.generatePersonalizedHome(currentTrack, tracks));
  };

  const handleClearHistory = () => {
    setPlaybackHistory([]);
    try {
      localStorage.removeItem('vd_playback_history_v1');
    } catch {}
    setVibeToast({
      title: 'History Cleared',
      vibe: 'Playback history removed from device'
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleRemoveFromHistory = (trackId: string) => {
    setPlaybackHistory((prev) => {
      const next = prev.filter((t) => t.id !== trackId);
      try {
        localStorage.setItem('vd_playback_history_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleUpdateSettings = (newSettings: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // MediaSession API Synchronization (Lock screen, notifications, and background media keys)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'VD Music',
        artwork: [
          { src: currentTrack.coverUrl || '/vd_music_logo.jpg', sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || '/vd_music_logo.jpg', sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || '/vd_music_logo.jpg', sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || '/vd_music_logo.jpg', sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
        audioEngine.resume();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
        audioEngine.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handlePrevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
          audioEngine.seek(details.seekTime);
          setCurrentTimeSec(Math.floor(details.seekTime));
        }
      });
    } catch (e) {
      console.warn('MediaSession sync issue:', e);
    }
  }, [currentTrack, isPlaying]);

  const handleAllowBackgroundPermission = async () => {
    try {
      localStorage.setItem('vd_background_playback_permission', 'granted');
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}
    await audioEngine.enableBackgroundPlayback();
    setSettings((prev) => ({ ...prev, backgroundPlayback: true }));
    setShowBackgroundPermission(false);
    setVibeToast({ title: 'Background Audio', vibe: 'Screen-Off Audio Enabled' });
    setTimeout(() => setVibeToast(null), 3000);
  };

  const handleDismissBackgroundPermission = () => {
    try {
      localStorage.setItem('vd_background_playback_permission', 'dismissed');
    } catch {}
    setShowBackgroundPermission(false);
  };

  return (
    <div className={`min-h-screen flex flex-col selection:bg-[var(--color-primary)]/20 selection:text-[var(--color-primary)] ${settings.pureBlackAmoled ? 'bg-black text-[#e4e1e7]' : 'bg-transparent text-[#e4e1e7]'}`}>
      {/* Global Transparent Glassmorphism Background */}
      {!settings.pureBlackAmoled && (
        <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-black">
          <img 
            src={currentTrack?.coverUrl || TRACKS[0].coverUrl} 
            alt="Global Background" 
            className="w-full h-full object-cover blur-[100px] opacity-40 scale-125 saturate-150 transition-all duration-1000 ease-in-out"
          />
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/95"></div>
        </div>
      )}

      {/* Top Header with Glass Backdrop */}
      <Header
        activeScreen={activeScreen}
        userName={userName}
        onOpenAccountSync={() => setIsAccountSyncOpen(true)}
        onOpenHistory={() => setActiveScreen('library')}
        onOpenEqualizer={() => setIsNowPlayingOpen(true)}
      />

      {/* Dynamic YouTube Music Personalization Toast */}
      {vibeToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-sm">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]/95 backdrop-blur-xl border border-[var(--color-primary)]/40 shadow-2xl shadow-black/80">
            <span className="material-symbols-outlined floating-icon text-[18px] text-[var(--color-primary)] animate-pulse shrink-0">
              auto_awesome
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                Tailoring Queue &amp; Home
              </span>
              <span className="text-[12px] text-[#e4e1e7] font-medium truncate">
                {vibeToast.title} • {vibeToast.vibe}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - calculated padding ensures top content is never hidden behind header */}
      <main className="flex-1 w-full pt-[calc(max(env(safe-area-inset-top,0px),36px)+64px)] pb-36">
        {/* Real-time Network Offline & Encrypted Vault Ribbon */}
        <NetworkOfflineBanner onOpenDownloads={() => setActiveScreen('library')} />

        {activeScreen === 'home' && (
          <HomeScreen
            tracks={activeDisplayTracks}
            favoriteTrackIds={favoriteTrackIds}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            personalizedData={personalizedHome || undefined}
            playbackHistory={playbackHistory}
            userName={userName}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onToggleFavorite={handleToggleFavorite}
            onOpenVideo={setActiveVideo}
            onPlayMix={handlePlayMix}
            onOpenColdStart={() => setIsOnboardingOpen(true)}
          />
        )}

        {activeScreen === 'explore' && (
          <ExploreScreen
            tracks={activeDisplayTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onOpenVideo={setActiveVideo}
          />
        )}

        {activeScreen === 'search' && (
          <SearchScreen
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onPlayMix={handlePlayMix}
            onPlayQueue={handlePlayQueue}
          />
        )}

        {activeScreen === 'library' && (
          <LibraryScreen
            tracks={activeDisplayTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            settings={settings}
            playbackHistory={playbackHistory}
            onClearHistory={handleClearHistory}
            onRemoveFromHistory={handleRemoveFromHistory}
            onSelectTrack={handleSelectTrack}
            onPlayQueue={handlePlayQueue}
            onTogglePlay={handleTogglePlay}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => setActiveScreen('home')}
            onOpenEqualizer={() => setIsNowPlayingOpen(true)}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTimeSec={currentTimeSec}
            onTogglePlay={handleTogglePlay}
            onNextTrack={handleNextTrack}
            onPrevTrack={handlePrevTrack}
            onToggleFavorite={handleToggleFavorite}
            onSeek={handleSeek}
          />
        )}
      </main>

      {/* Persistent Mini Player Dock */}
      {currentTrack && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTimeSec={currentTimeSec}
          onTogglePlay={handleTogglePlay}
          onNextTrack={handleNextTrack}
          onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        />
      )}

      {/* Bottom Navigation with Frosted Blur */}
      <BottomNav
        activeScreen={activeScreen}
        onSelectScreen={(screen) => setActiveScreen(screen)}
      />

      {/* Fullscreen Now Playing Overlay */}
      {isNowPlayingOpen && currentTrack && (
        <NowPlayingScreen
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTimeSec={currentTimeSec}
          settings={settings}
          queue={queue}
          currentVibe={activeVibe}
          isShuffle={isShuffle}
          onToggleShuffle={() => setIsShuffle(!isShuffle)}
          repeatMode={repeatMode}
          onToggleRepeat={() => {
            if (repeatMode === 'all') setRepeatMode('one');
            else if (repeatMode === 'one') setRepeatMode('off');
            else setRepeatMode('all');
          }}
          onSelectTrack={handleSelectTrack}
          onPlayFromQueue={handlePlayFromQueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onReorderQueue={handleReorderQueue}
          onPlayNext={handlePlayNext}
          onAddToQueue={handleAddToQueue}
          onClearQueue={handleClearQueue}
          onShuffleQueue={handleShuffleQueue}
          isInfiniteAutoPlay={isInfiniteAutoPlay}
          onToggleInfiniteAutoPlay={handleToggleInfiniteAutoPlay}
          radioTracks={radioTracks}
          onTogglePlay={handleTogglePlay}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          onSeek={handleSeek}
          onClose={() => setIsNowPlayingOpen(false)}
          onToggleFavorite={handleToggleFavorite}
          onToggleDislike={handleToggleDislike}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* Cold Start Recommendation Algorithm Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => {
          setIsOnboardingOpen(false);
          const homeData = personalizationService.generatePersonalizedHome(currentTrack, tracks);
          setPersonalizedHome(homeData);
          setVibeToast({
            title: 'Algorithm Calibrated',
            vibe: 'Generated custom Supermix, Discover Mix & New Releases!'
          });
          setTimeout(() => setVibeToast(null), 3000);
        }}
      />

      {/* Account & Sync Modal Overlay */}
      {isAccountSyncOpen && (
        <AccountSyncModal
          userName={userName}
          onClose={() => setIsAccountSyncOpen(false)}
          onOpenSettings={() => {
            setIsAccountSyncOpen(false);
            setActiveScreen('settings');
          }}
        />
      )}

      {/* First-Time Background & Screen-Off Playback Permission Modal */}
      <BackgroundPermissionModal
        isOpen={showBackgroundPermission}
        onAllow={handleAllowBackgroundPermission}
        onDismiss={handleDismissBackgroundPermission}
      />

      {/* YouTube Music Video Playback Modal */}
      {activeVideo && (
        <MusicVideoModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
          onPlayAudioOnly={handlePlayVideoAudioOnly}
        />
      )}

      {!userName && (
        <PlanScreen 
          onComplete={(name) => {
            setUserName(name);
            localStorage.setItem('vd_user_name', name);
          }}
        />
      )}

      {/* Animated App Boot Splash Screen */}
      <BootSplashScreen />
    </div>
  );
}
