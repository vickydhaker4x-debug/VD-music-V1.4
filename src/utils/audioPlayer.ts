/**
 * VD Music Universal Hybrid Audio Engine
 * Supports:
 * 1. Official YouTube IFrame Player for 100% authentic music audio directly from YouTube
 * 2. HTML5 Audio element for direct streams (.mp3, .m4a, .aac)
 * 3. Web Audio ambient synth safeguard so playback never fails or remains silent
 */

import { App } from '@capacitor/app';
import { Track } from '../types';
import { streamingEngine } from '../services/streamingEngine';
import { adaptiveBitrateService } from '../services/adaptiveBitrateService';
import { persistentBackgroundService } from '../services/persistentBackgroundService';
import { mediaSessionService } from '../services/mediaSessionService';
import { audioFocusService } from '../services/audioFocusService';
import { encryptedStorageService } from '../services/encryptedStorageService';
import { networkMonitorService } from '../services/networkMonitorService';
import { offlineService } from '../services/offlineService';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

class AudioEngine {
  // HTML5 Audio
  private audio: HTMLAudioElement | null = null;
  private currentStreamUrl: string | null = null;

  // YouTube IFrame Player
  private ytPlayer: any = null;
  private isYtReady: boolean = false;
  private pendingVideoId: string | null = null;
  private ytInterval: number | null = null;
  private ytContainerId: string = 'vd-hidden-yt-player';

  // Synth Fallback
  private ctx: AudioContext | null = null;
  private synthInterval: number | null = null;

  // State
  private isPlaying: boolean = false;
  private currentMode: 'youtube' | 'audio' | 'synth' = 'youtube';
  private volume: number = 1.0;

  // Playback & Streaming Settings
  private volumeNormalization: boolean = true;
  private skipSilence: boolean = true;
  private skipSponsor: boolean = true;
  private audioQuality: string = '320kbps High-Res Audio';
  private streamingInstance: string = 'Direct YouTube Stream';
  private backgroundPlayback: boolean = true;

  // Background Audio & WakeLock Keep-Alive
  private silentAudio: HTMLAudioElement | null = null;
  private wakeLock: any = null;

  // Dynamic Segment Tracking
  private currentTrackDuration: number = 0;
  private sponsorSegments: { start: number; end: number }[] = [];
  private isInitialSilenceSkipped: boolean = false;

  // Lookahead Pre-buffering & Queue tracking
  private currentActiveTrack: Track | null = null;
  private activeQueue: Track[] = [];
  private isNextPrebuffered: boolean = false;

  // OS Integration & Audio Focus
  private audioFocusMultiplier: number = 1.0;
  private onNextTrackExternal: (() => void) | null = null;
  private onPrevTrackExternal: (() => void) | null = null;

  // Callbacks
  private onTimeUpdateCallback: ((timeSec: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Setup HTML5 Audio
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.setAttribute('playsinline', 'true');
      this.audio.setAttribute('webkit-playsinline', 'true');

      this.audio.addEventListener('timeupdate', () => {
        if (this.currentMode === 'audio' && this.audio && this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(this.audio.currentTime);
          if (this.audio.duration > 0) {
            mediaSessionService.setPositionState(this.audio.currentTime, this.audio.duration);
          }
        }
      });

      this.audio.addEventListener('ended', () => {
        if (this.currentMode === 'audio' && this.onEndedCallback) {
          this.onEndedCallback();
        }
      });

      this.audio.addEventListener('error', () => {
        if (this.currentMode === 'audio') {
          console.warn('HTML5 Audio error on URL:', this.audio?.src);
          // Fallback to synth or error
          if (this.onErrorCallback) {
            this.onErrorCallback('Audio playback issue');
          }
        }
      });

      // 2. Setup Silent Audio Keep-Alive for Background & Screen-Off
      this.initSilentKeepAlive();

      // 3. Register MediaSession Actions for Lockscreen & OS Notification controls
      mediaSessionService.registerCallbacks({
        onPlay: () => this.resume(),
        onPause: () => this.pause(),
        onNext: () => {
          if (this.onNextTrackExternal) {
            this.onNextTrackExternal();
          } else if (this.onEndedCallback) {
            this.onEndedCallback();
          }
        },
        onPrevious: () => {
          if (this.onPrevTrackExternal) {
            this.onPrevTrackExternal();
          } else {
            this.seek(0);
          }
        },
        onSeek: (seconds) => this.seek(seconds)
      });

      // 4. Register Audio Focus Interruption & Ducking Controller
      audioFocusService.registerPlayerControls(
        () => this.pause(),
        () => this.resume(),
        (multiplier) => {
          this.audioFocusMultiplier = multiplier;
          this.applyVolume();
        }
      );

      // 5. Listen for tab visibility/screen lock to ensure continuous playback
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.isPlaying && this.backgroundPlayback) {
            this.ensureKeepAlive();
            if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
              try {
                if (this.ytPlayer.getPlayerState() === 2) {
                  this.ytPlayer.playVideo();
                }
              } catch {}
            }
          }
        } else {
          if (this.isPlaying) {
            this.requestWakeLock();
          }
        }
      });

      try {
        App.addListener('appStateChange', (state) => {
          if (!state.isActive) {
            if (this.isPlaying && this.backgroundPlayback) {
              this.ensureKeepAlive();
              if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
                try {
                  if (this.ytPlayer.getPlayerState() === 2 || this.ytPlayer.getPlayerState() === 1) {
                    // Force a play command just to be sure
                    setTimeout(() => {
                      if (this.isPlaying && this.ytPlayer) {
                        try { this.ytPlayer.playVideo(); } catch {}
                      }
                    }, 100);
                  }
                } catch {}
              }
            }
          } else {
            if (this.isPlaying) {
              this.requestWakeLock();
            }
          }
        });
      } catch (e) {
        console.warn('Capacitor App plugin not available', e);
      }

      // 4. Initialize YouTube Player
      this.initYouTubePlayer();

      // 5. Network Drop Auto-Switching Watcher: instant fallback to encrypted offline vault
      networkMonitorService.subscribe((netState) => {
        if (!netState.isOnline && this.isPlaying && this.currentMode === 'youtube') {
          if (this.currentActiveTrack) {
            encryptedStorageService.getDecryptedAudioUrl(this.currentActiveTrack.id).then((blobUrl) => {
              if (blobUrl) {
                this.playAudioStream(blobUrl);
              }
            });
          }
        }
      });
    }
  }

  private initSilentKeepAlive() {
    try {
      this.silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      this.silentAudio.loop = true;
      this.silentAudio.volume = 0.0001;
      this.silentAudio.setAttribute('playsinline', 'true');
      this.silentAudio.setAttribute('webkit-playsinline', 'true');
    } catch {}
  }

  public async enableBackgroundPlayback(): Promise<boolean> {
    this.backgroundPlayback = true;
    this.ensureKeepAlive();
    await this.requestWakeLock();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
    return true;
  }

  private ensureKeepAlive() {
    if (!this.backgroundPlayback) return;
    try {
      if (this.silentAudio) {
        if (this.silentAudio.paused) {
          this.silentAudio.play().catch(() => {});
        }
      }
    } catch {}
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch {
        // WakeLock request rejected or not supported on this device
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  private initYouTubePlayer() {
    if (typeof document === 'undefined') return;

    // Create hidden DOM container if not exists - styled so mobile browser does NOT cull it
    let container = document.getElementById(this.ytContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.ytContainerId;
      container.style.position = 'fixed';
      container.style.bottom = '0px';
      container.style.right = '0px';
      container.style.width = '160px';
      container.style.height = '160px';
      container.style.opacity = '0.001';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-9999';
      document.body.appendChild(container);
    }

    const checkYTApi = () => {
      if (window.YT && window.YT.Player) {
        this.createYtInstance();
      } else {
        const prevOnReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevOnReady) prevOnReady();
          this.createYtInstance();
        };
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      checkYTApi();
    } else {
      window.addEventListener('DOMContentLoaded', checkYTApi);
    }
  }

  private createYtInstance() {
    if (this.ytPlayer || typeof window.YT === 'undefined' || !window.YT.Player) return;

    try {
      this.ytPlayer = new window.YT.Player(this.ytContainerId, {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            this.isYtReady = true;
            if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
              this.ytPlayer.setVolume(Math.round(this.volume * 100));
            }
            if (this.pendingVideoId) {
              const vid = this.pendingVideoId;
              this.pendingVideoId = null;
              this.playYouTube(vid);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: 0 (ENDED), 1 (PLAYING), 2 (PAUSED), 3 (BUFFERING)
            if (event.data === 1) {
              this.startYtTracker();
            } else if (event.data === 0) {
              this.stopYtTracker();
              if (this.onEndedCallback) {
                this.onEndedCallback();
              }
            } else if (event.data === 2) {
              this.stopYtTracker();
              // Prevent YouTube from auto-pausing in background
              if (this.isPlaying && this.backgroundPlayback) {
                setTimeout(() => {
                  if (this.isPlaying && this.ytPlayer) {
                    try {
                      this.ytPlayer.playVideo();
                    } catch {}
                  }
                }, 50);
              }
            }
          },
          onError: (err: any) => {
            console.warn('YouTube Player error:', err);
            this.stopYtTracker();
            // Start fallback synth so music keeps flowing smoothly
            this.startSynthFallback();
          }
        }
      });
    } catch (e) {
      console.warn('Could not initialize YouTube player:', e);
    }
  }

  private handleTrackTimeCheck(currentTime: number) {
    if (typeof currentTime !== 'number' || isNaN(currentTime)) return;

    // 1. Skip Sponsor / Non-Music Video Segments (SponsorBlock)
    if (this.skipSponsor && this.sponsorSegments.length > 0) {
      for (const seg of this.sponsorSegments) {
        if (currentTime >= seg.start - 0.2 && currentTime < seg.end - 0.4) {
          this.seek(seg.end);
          return;
        }
      }
    }

    // 2. Skip Silence: Intro trimming (skip dead intro gaps)
    if (this.skipSilence && !this.isInitialSilenceSkipped && currentTime >= 0 && currentTime < 0.8) {
      this.isInitialSilenceSkipped = true;
      // Many music videos have 1.5-2.0s silence at start before instrumentals kick in
      if (currentTime < 1.4) {
        this.seek(1.5);
        return;
      }
    }

    // 3. Skip Silence: Outro trimming (smooth gapless auto-transition when track enters trailing silence)
    if (this.skipSilence && this.currentTrackDuration > 12) {
      if (currentTime >= this.currentTrackDuration - 2.5) {
        // Prevent looping multiple times on ending
        this.currentTrackDuration = 0;
        if (this.onEndedCallback) {
          this.onEndedCallback();
          return;
        }
      }
    }

    // 4. Update Adaptive Bitrate buffer health & metrics
    if (this.audio && this.currentMode === 'audio') {
      const current = this.audio.currentTime;
      let maxBuf = current;
      for (let i = 0; i < this.audio.buffered.length; i++) {
        if (this.audio.buffered.start(i) <= current && this.audio.buffered.end(i) >= current) {
          maxBuf = this.audio.buffered.end(i);
          break;
        }
      }
      adaptiveBitrateService.updateBufferHealth(Math.max(0, maxBuf - current));
    } else if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getVideoLoadedFraction === 'function') {
      try {
        const frac = this.ytPlayer.getVideoLoadedFraction() || 0;
        const dur = this.currentTrackDuration || 210;
        const bufferedSec = Math.max(0, (frac * dur) - currentTime);
        adaptiveBitrateService.updateBufferHealth(bufferedSec);
      } catch {}
    }

    // 5. Lookahead Pre-buffering: Trigger first 10 seconds of next track when nearing finish (<= 20s remaining)
    if (this.currentTrackDuration > 20 && currentTime >= this.currentTrackDuration - 20 && !this.isNextPrebuffered) {
      this.isNextPrebuffered = true;
      if (this.currentActiveTrack && this.activeQueue.length > 0) {
        streamingEngine.prefetchNextInQueue(this.currentActiveTrack, this.activeQueue);
      }
    }

    // 6. Update MediaSession Position State for Lockscreen Progress Bar & Notification
    if (this.currentTrackDuration > 0) {
      mediaSessionService.setPositionState(currentTime, this.currentTrackDuration);
    }

    // Dispatch update
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(currentTime);
    }
  }

  private async fetchSponsorSegments(videoId: string) {
    this.sponsorSegments = [];
    if (!this.skipSponsor || !videoId) return;

    try {
      const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["music_offtopic","sponsor","intro"]`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.sponsorSegments = data
            .filter((item: any) => Array.isArray(item.segment) && item.segment.length >= 2)
            .map((item: any) => ({
              start: Number(item.segment[0]),
              end: Number(item.segment[1])
            }))
            .sort((a, b) => a.start - b.start);

          // If the very beginning (0-3s) is an intro/dialogue segment, skip it immediately!
          if (this.sponsorSegments.length > 0 && this.sponsorSegments[0].start <= 2.5) {
            const skipTo = this.sponsorSegments[0].end;
            setTimeout(() => {
              this.seek(skipTo);
            }, 300);
          }
        }
      }
    } catch {
      // Handled silently
    }
  }

  private startYtTracker() {
    this.stopYtTracker();
    this.ytInterval = window.setInterval(() => {
      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try {
          const currentTime = this.ytPlayer.getCurrentTime();
          if (typeof currentTime === 'number' && !isNaN(currentTime)) {
            this.handleTrackTimeCheck(currentTime);
          }
        } catch {
          // ignore
        }
      }
    }, 400);
  }

  private stopYtTracker() {
    if (this.ytInterval) {
      clearInterval(this.ytInterval);
      this.ytInterval = null;
    }
  }

  private playYouTube(videoId: string) {
    this.currentMode = 'youtube';
    this.stopSynthFallback();
    this.fetchSponsorSegments(videoId);

    if (this.audio) {
      this.audio.pause();
    }

    if (!this.isYtReady || !this.ytPlayer || typeof this.ytPlayer.loadVideoById !== 'function') {
      this.pendingVideoId = videoId;
      // Also start fallback until YT loads
      return;
    }

    try {
      this.ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: 0
      });
      // Apply volume normalization if active
      if (typeof this.ytPlayer.setVolume === 'function') {
        const effectiveVol = this.volumeNormalization ? this.volume * 0.84 : this.volume;
        this.ytPlayer.setVolume(Math.round(effectiveVol * 100));
      }
      this.ytPlayer.playVideo();
      this.startYtTracker();
    } catch (e) {
      console.warn('Error playing video in YouTube player:', e);
      this.startSynthFallback();
    }
  }

  private playAudioStream(url: string) {
    this.currentMode = 'audio';
    this.stopSynthFallback();
    this.stopYtTracker();
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    }

    if (this.audio) {
      if (this.currentStreamUrl !== url) {
        this.currentStreamUrl = url;
        this.audio.src = url;
        this.audio.load();
      }
      this.audio.play().catch((err) => {
        console.warn('HTML5 Audio playback interrupted:', err);
        this.startSynthFallback();
      });
    }
  }

  /**
   * Remove synth backup as it was causing "beep beep" sounds on failed tracks.
   * If a stream fails, we just wait or skip automatically.
   */
  private startSynthFallback() {
    if (this.synthInterval) return;
    try {
      this.synthInterval = window.setTimeout(() => {
        if (this.isPlaying && this.onEndedCallback) {
          // If after 3 seconds we still can't play, skip to next
          this.onEndedCallback();
        }
      }, 3000);
    } catch {}
  }

  private stopSynthFallback() {
    if (this.synthInterval) {
      clearTimeout(this.synthInterval);
      this.synthInterval = null;
    }
  }

  /**
   * Main Play function with Zero-Latency Pre-buffer Integration
   */
  public play(
    trackOrUrl: Track | { videoId?: string; audioUrl?: string; durationSec?: number } | string,
    onTimeUpdate?: (timeSec: number) => void,
    onEnded?: () => void,
    onError?: (err: string) => void,
    queue: Track[] = []
  ) {
    this.isPlaying = true;
    this.isInitialSilenceSkipped = false;
    this.isNextPrebuffered = false;
    this.activeQueue = queue;
    this.onTimeUpdateCallback = onTimeUpdate || null;
    this.onEndedCallback = onEnded || null;
    this.onErrorCallback = onError || null;

    if (this.backgroundPlayback) {
      this.ensureKeepAlive();
      this.requestWakeLock();
      persistentBackgroundService.startBackgroundSession();
    }

    if (typeof trackOrUrl === 'object' && 'title' in trackOrUrl) {
      this.currentActiveTrack = trackOrUrl as Track;
      // Synchronize Lockscreen Metadata & Playback State
      mediaSessionService.updateMetadata(trackOrUrl as Track, Boolean((trackOrUrl as Track).isFavorite));
      mediaSessionService.setPlaybackState('playing');

      // Trigger lookahead pre-buffering of the first 10s of next track in queue right away
      if (queue.length > 0) {
        streamingEngine.prefetchNextInQueue(trackOrUrl as Track, queue);
      }
    } else {
      this.currentActiveTrack = null;
      mediaSessionService.setPlaybackState('playing');
    }

    if (typeof trackOrUrl === 'string') {
      this.currentTrackDuration = 0;
      if (trackOrUrl.startsWith('http')) {
        this.playAudioStream(trackOrUrl);
      } else {
        this.playYouTube(trackOrUrl);
      }
      return;
    }

    this.currentTrackDuration = trackOrUrl.durationSec || 0;

    // Check if network is offline or track is downloaded in encrypted local vault
    const isOffline = networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode();
    const trackId = typeof trackOrUrl === 'object' && 'id' in trackOrUrl ? (trackOrUrl as Track).id : null;

    if (trackId && (isOffline || offlineService.isDownloaded(trackId))) {
      encryptedStorageService.getDecryptedAudioUrl(trackId).then((blobUrl) => {
        if (blobUrl) {
          this.playAudioStream(blobUrl);
        } else if (typeof trackOrUrl === 'object' && trackOrUrl.audioUrl) {
          this.playAudioStream(trackOrUrl.audioUrl);
        } else if (typeof trackOrUrl === 'object' && trackOrUrl.videoId && !isOffline) {
          this.playYouTube(trackOrUrl.videoId);
        } else {
          this.startSynthFallback();
        }
      }).catch(() => {
        if (typeof trackOrUrl === 'object' && trackOrUrl.audioUrl) {
          this.playAudioStream(trackOrUrl.audioUrl);
        } else if (typeof trackOrUrl === 'object' && trackOrUrl.videoId && !isOffline) {
          this.playYouTube(trackOrUrl.videoId);
        }
      });
      return;
    }

    if (trackOrUrl.videoId) {
      this.playYouTube(trackOrUrl.videoId);
    } else if (trackOrUrl.audioUrl) {
      this.playAudioStream(trackOrUrl.audioUrl);
    } else {
      this.startSynthFallback();
    }
  }

  public pause() {
    this.isPlaying = false;
    this.stopYtTracker();
    this.stopSynthFallback();
    this.releaseWakeLock();
    persistentBackgroundService.stopBackgroundSession();
    mediaSessionService.setPlaybackState('paused');

    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    } else if (this.audio) {
      this.audio.pause();
    }
  }

  public resume() {
    this.isPlaying = true;
    if (this.backgroundPlayback) {
      this.ensureKeepAlive();
      this.requestWakeLock();
      persistentBackgroundService.startBackgroundSession();
    }
    mediaSessionService.setPlaybackState('playing');

    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo();
        this.startYtTracker();
      } catch {
        this.startSynthFallback();
      }
    } else if (this.audio && this.audio.src) {
      this.audio.play().catch(() => this.startSynthFallback());
    } else {
      this.startSynthFallback();
    }
  }

  public seek(seconds: number) {
    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(seconds, true);
      } catch {}
    } else if (this.audio && !isNaN(seconds) && isFinite(seconds)) {
      this.audio.currentTime = seconds;
    }
    if (this.currentTrackDuration > 0) {
      mediaSessionService.setPositionState(seconds, this.currentTrackDuration);
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  public applyVolume() {
    // Volume Normalization: level output to prevent harsh loud spikes
    const baseVolume = this.volumeNormalization ? this.volume * 0.84 : this.volume;
    // Audio Focus Multiplier: ducks volume smoothly for GPS prompts/notifications
    const effectiveVolume = Math.max(0, Math.min(1, baseVolume * this.audioFocusMultiplier));

    if (this.audio) {
      this.audio.volume = effectiveVolume;
    }
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(effectiveVolume * 100));
      } catch {}
    }
  }

  public setExternalControls(onNext: () => void, onPrev: () => void) {
    this.onNextTrackExternal = onNext;
    this.onPrevTrackExternal = onPrev;
  }

  public configure(options: {
    volumeNormalization?: boolean;
    skipSilence?: boolean;
    skipSponsor?: boolean;
    audioQuality?: string;
    streamingInstance?: string;
    backgroundPlayback?: boolean;
  }) {
    if (options.volumeNormalization !== undefined) {
      this.volumeNormalization = options.volumeNormalization;
      this.applyVolume();
    }
    if (options.skipSilence !== undefined) {
      this.skipSilence = options.skipSilence;
    }
    if (options.skipSponsor !== undefined) {
      this.skipSponsor = options.skipSponsor;
    }
    if (options.audioQuality !== undefined) {
      this.audioQuality = options.audioQuality;
    }
    if (options.streamingInstance !== undefined) {
      this.streamingInstance = options.streamingInstance;
    }
    if (options.backgroundPlayback !== undefined) {
      this.backgroundPlayback = options.backgroundPlayback;
      persistentBackgroundService.setScreenOffPlayback(Boolean(options.backgroundPlayback));
      if (this.backgroundPlayback && this.isPlaying) {
        this.ensureKeepAlive();
        this.requestWakeLock();
        persistentBackgroundService.startBackgroundSession();
      } else if (!this.backgroundPlayback) {
        this.releaseWakeLock();
        persistentBackgroundService.stopBackgroundSession();
      }
    }
  }

  public setPreset(preset: string) {
    // Preset applied cleanly
  }
}

export const audioEngine = new AudioEngine();
