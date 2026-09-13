import { useState, FC } from 'react';

interface TrackImageProps {
  src?: string;
  alt?: string;
  className?: string;
  videoId?: string;
  loading?: 'lazy' | 'eager';
  showCornerGlow?: boolean;
}

export const TrackImage: FC<TrackImageProps> = ({
  src,
  alt = 'Music Artwork',
  className = 'w-full h-full object-cover',
  videoId,
  loading = 'lazy',
  showCornerGlow = false
}) => {
  const [hasError, setHasError] = useState(false);
  const [retryStage, setRetryStage] = useState(0);

  // Compute best image source based on fallback stages
  const getImageSource = () => {
    let target = src;
    if (retryStage === 1 && videoId) {
      target = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    } else if (retryStage === 2 && videoId) {
      target = `https://images.weserv.nl/?url=i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    } else if (retryStage >= 3) {
      return '/vd_music_logo.jpg';
    }

    if (target) {
      // YouTube hqdefault.jpg has 45px black letterbox strips on top and bottom.
      // mqdefault.jpg is 16:9 with NO black bars.
      return target.replace('/hqdefault.jpg', '/mqdefault.jpg');
    }
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    }
    return '/vd_music_logo.jpg';
  };

  const handleError = () => {
    if (retryStage < 2 && videoId) {
      setRetryStage((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-[#1f1f25] to-[#121216] border border-white/[0.06] ${className}`}>
        <span className="material-symbols-outlined floating-icon text-[var(--color-primary)] text-[24px] opacity-80 animate-pulse">
          music_note
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
      <img
        src={getImageSource()}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={handleError}
        className={`w-full h-full object-cover transform scale-110 transition-transform duration-300 ${className}`}
        loading={loading}
      />
      {/* Corner Glow Effect directly on the thumbnail corners */}
      {showCornerGlow && (
        <>
          <div className="absolute -top-2 -left-2 w-10 h-10 bg-[var(--color-primary)]/40 rounded-full blur-lg pointer-events-none" />
          <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-[var(--color-primary)]/50 rounded-full blur-lg pointer-events-none" />
        </>
      )}
    </div>
  );
};
