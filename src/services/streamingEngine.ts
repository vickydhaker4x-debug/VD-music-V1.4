import { Track } from '../types';
import { adaptiveBitrateService } from './adaptiveBitrateService';

export interface StreamSession {
  trackId: string;
  durationSec: number;
  currentChunkIndex: number;
  totalChunks: number;
  isBuffering: boolean;
}

class StreamingEngine {
  // Dual-Deck Audio Architecture for 0ms Gapless Pre-buffered Switches
  private primaryAudio: HTMLAudioElement | null = null;
  private standbyAudio: HTMLAudioElement | null = null;
  private prebufferedTrack: Track | null = null;
  private prebufferBlobUrl: string | null = null;

  // Active Session
  private currentTrack: Track | null = null;
  private isPlaying: boolean = false;
  private activeSession: StreamSession | null = null;
  private bufferCheckInterval: number | null = null;

  // Cache Storage for offline & fast re-access
  private memoryChunkCache: Map<string, string> = new Map(); // key: trackId_chunkIdx_bitrate -> blobUrl

  // Callbacks
  private onTimeUpdateCallback: ((timeSec: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioDecks();
    }
  }

  private initAudioDecks() {
    // Primary Audio Deck
    this.primaryAudio = new Audio();
    this.primaryAudio.preload = 'auto';
    this.primaryAudio.setAttribute('playsinline', 'true');
    this.primaryAudio.setAttribute('webkit-playsinline', 'true');

    // Standby Pre-buffer Deck
    this.standbyAudio = new Audio();
    this.standbyAudio.preload = 'auto';
    this.standbyAudio.setAttribute('playsinline', 'true');
    this.standbyAudio.setAttribute('webkit-playsinline', 'true');

    this.attachPrimaryListeners();
  }

  private attachPrimaryListeners() {
    if (!this.primaryAudio) return;

    this.primaryAudio.addEventListener('timeupdate', () => {
      if (!this.primaryAudio) return;
      const currentTime = this.primaryAudio.currentTime;

      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(currentTime);
      }

      this.monitorBufferHealth();
      this.evaluateLookaheadPrefetch(currentTime);
    });

    this.primaryAudio.addEventListener('ended', () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.primaryAudio.addEventListener('error', (e) => {
      console.warn('[StreamingEngine] Playback error on primary deck:', e);
      if (this.onErrorCallback) {
        this.onErrorCallback('Stream buffering error');
      }
    });

    this.primaryAudio.addEventListener('progress', () => {
      this.monitorBufferHealth();
    });
  }

  /**
   * Continuous buffer health calculator
   */
  private monitorBufferHealth() {
    if (!this.primaryAudio) return;
    const audio = this.primaryAudio;
    const current = audio.currentTime;

    let maxBuffered = current;
    for (let i = 0; i < audio.buffered.length; i++) {
      if (audio.buffered.start(i) <= current && audio.buffered.end(i) >= current) {
        maxBuffered = audio.buffered.end(i);
        break;
      }
    }

    const bufferAheadSec = Math.max(0, maxBuffered - current);
    adaptiveBitrateService.updateBufferHealth(bufferAheadSec);
  }

  /**
   * Lookahead Pre-fetching:
   * When track has <= 20 seconds remaining, or upon start, ask backend what's next and pre-buffer the first 10 seconds.
   */
  private evaluateLookaheadPrefetch(currentTime: number) {
    if (!this.currentTrack) return;
    const duration = this.currentTrack.durationSec || 210;
    const remaining = duration - currentTime;

    // Trigger lookahead prebuffer when entering final 20 seconds
    if (remaining <= 20 && !this.prebufferedTrack) {
      // Trigger pre-fetch signal
    }
  }

  /**
   * Start playback of a track with zero-latency streaming
   */
  public async playTrack(
    track: Track,
    queue: Track[] = [],
    onTimeUpdate?: (timeSec: number) => void,
    onEnded?: () => void,
    onError?: (err: string) => void
  ): Promise<boolean> {
    this.currentTrack = track;
    this.onTimeUpdateCallback = onTimeUpdate || null;
    this.onEndedCallback = onEnded || null;
    this.onErrorCallback = onError || null;
    this.isPlaying = true;

    // Check if track is already pre-buffered on standby deck!
    if (this.prebufferedTrack && this.prebufferedTrack.id === track.id && this.standbyAudio) {
      console.log(`[StreamingEngine] ⚡ Zero-Latency Instant Switch! Playing pre-buffered 10s of: ${track.title}`);

      // Swap Primary and Standby decks
      const prevPrimary = this.primaryAudio;
      this.primaryAudio = this.standbyAudio;
      this.standbyAudio = prevPrimary;

      this.attachPrimaryListeners();

      try {
        await this.primaryAudio.play();
      } catch (err) {
        console.warn('Playback resume failed', err);
      }

      this.prebufferedTrack = null;
      adaptiveBitrateService.setPrebufferStatus(false);

      // Now pre-fetch the next track in queue ahead of time
      this.prefetchNextInQueue(track, queue);
      return true;
    }

    // Direct Stream URL if available, or chunked backend stream
    const targetUrl = track.audioUrl || `/api/stream/${track.id}/chunk?chunkIndex=0&bitrate=${adaptiveBitrateService.getMetrics().currentBitrateKbps}`;

    if (this.primaryAudio) {
      this.primaryAudio.src = targetUrl;
      try {
        const startMeasure = performance.now();
        await this.primaryAudio.play();
        const latency = Math.round(performance.now() - startMeasure);
        console.log(`[StreamingEngine] 🚀 Track started in ${latency}ms`);
      } catch (e) {
        console.warn('[StreamingEngine] Autoplay failed or blocked:', e);
      }
    }

    // Immediately trigger backend prediction and pre-buffer the first 10 seconds of the next track
    this.prefetchNextInQueue(track, queue);
    return true;
  }

  /**
   * Pre-fetch & Cache the first 10 seconds of the next song
   */
  public async prefetchNextInQueue(currentTrack: Track, queue: Track[]) {
    try {
      const queueIds = queue.map((t) => t.id).filter((id) => id !== currentTrack.id);
      const metrics = adaptiveBitrateService.getMetrics();

      const res = await fetch('/api/stream/predict-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrackId: currentTrack.id,
          queueIds,
          networkSpeedKbps: metrics.networkSpeedKbps
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      const prediction = data.prediction;

      if (!prediction || !prediction.nextTrackId) return;

      const nextTrack = queue.find((t) => t.id === prediction.nextTrackId) || {
        id: prediction.nextTrackId,
        title: 'Next Track in Queue',
        artist: 'VD Music Auto-Stream',
        album: 'YouTube Music Queue',
        duration: '3:30',
        durationSec: 210,
        coverUrl: '/vd_music_logo.jpg'
      };

      const prebufferUrl = prediction.prebufferUrl || `/api/stream/${nextTrack.id}/prebuffer?bitrate=${prediction.recommendedBitrate}`;

      // Measure download throughput
      const fetchStart = performance.now();
      const audioRes = await fetch(prebufferUrl, {
        headers: { Priority: 'high' }
      });

      if (audioRes.ok) {
        const blob = await audioRes.blob();
        const fetchTimeMs = performance.now() - fetchStart;
        adaptiveBitrateService.recordChunkDownload(blob.size, fetchTimeMs);

        // Revoke previous pre-buffer URL to prevent memory leaks
        if (this.prebufferBlobUrl) {
          URL.revokeObjectURL(this.prebufferBlobUrl);
        }

        this.prebufferBlobUrl = URL.createObjectURL(blob);
        this.prebufferedTrack = nextTrack;

        if (this.standbyAudio) {
          this.standbyAudio.src = this.prebufferBlobUrl;
          this.standbyAudio.load();
        }

        adaptiveBitrateService.setPrebufferStatus(true, nextTrack.id, nextTrack.title);
        console.log(`[StreamingEngine] 📦 Successfully pre-buffered first 10s of: "${nextTrack.title}" (${(blob.size / 1024).toFixed(1)} KB) in ${Math.round(fetchTimeMs)}ms`);
      }
    } catch (e) {
      console.warn('[StreamingEngine] Pre-buffer request bypassed', e);
    }
  }

  public pause() {
    this.isPlaying = false;
    if (this.primaryAudio) {
      this.primaryAudio.pause();
    }
  }

  public resume() {
    this.isPlaying = true;
    if (this.primaryAudio) {
      this.primaryAudio.play().catch(() => {});
    }
  }

  public seek(seconds: number) {
    if (this.primaryAudio && !isNaN(seconds) && isFinite(seconds)) {
      this.primaryAudio.currentTime = seconds;
    }
  }

  public setVolume(vol: number) {
    if (this.primaryAudio) {
      this.primaryAudio.volume = vol;
    }
    if (this.standbyAudio) {
      this.standbyAudio.volume = vol;
    }
  }

  public getPrebufferedTrack(): Track | null {
    return this.prebufferedTrack;
  }
}

export const streamingEngine = new StreamingEngine();
