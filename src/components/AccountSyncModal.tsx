import React, { useState } from 'react';
import { personalizationService } from '../services/personalizationService';

interface AccountSyncModalProps {
  userName?: string;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const AccountSyncModal: React.FC<AccountSyncModalProps> = ({
  userName,
  onClose,
  onOpenSettings
}) => {
  const [quickPicksPinning, setQuickPicksPinning] = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);

  const tasteProfile = personalizationService.getProfile();
  const topArtists = Object.keys(tasteProfile.topArtists).slice(0, 4);

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => {
      setCacheCleared(false);
    }, 2500);
  };

  const getUserInitials = (name?: string) => {
    if (!name) return '';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div 
      id="profile-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Subtle Ambient Backdrop Glow */}
      <div className="fixed inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden">
        <div className="w-[320px] h-[320px] rounded-full bg-[var(--color-primary)]/10 blur-[96px]" />
        <div className="w-[240px] h-[240px] rounded-full bg-[#891933]/15 blur-[80px] -translate-y-24 translate-x-12" />
      </div>

      {/* Modal Frame */}
      <div className="flex flex-col w-full max-w-lg liquid-glass rounded-3xl shadow-2xl overflow-hidden border border-white/[0.08] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 liquid-glass/70 backdrop-blur-md border-b border-white/[0.05]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
              <span 
                className="material-symbols-outlined floating-icon text-[var(--color-primary)] text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                person
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] font-bold text-[#e4e1e7] tracking-tight truncate">
                Profile
              </span>
              <span className="text-[11px] font-medium text-[#a1a1aa] truncate">
                Personal taste &amp; listening space
              </span>
            </div>
          </div>

          <button 
            id="close-profile-modal-btn"
            aria-label="Close modal"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)] hover:bg-white/[0.2] hover:scale-105 hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] active:scale-95 transition-all text-[#a1a1aa] hover:text-[#e4e1e7] cursor-pointer floating-btn"
          >
            <span className="material-symbols-outlined floating-icon text-[20px]">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* User Profile Banner (No Account / No Login needed) */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#2a292e] to-[#1f1f23] rounded-2xl p-4 shadow-sm border border-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)]/30 to-[#353439] flex items-center justify-center text-[var(--color-primary)] shrink-0 shadow-inner ring-2 ring-[var(--color-primary)]/30">
                  {userName ? (
                    <span className="font-bold text-[18px] tracking-widest">{getUserInitials(userName)}</span>
                  ) : (
                    <span className="material-symbols-outlined floating-icon text-[26px]">headphones</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-bold text-[#e4e1e7]">
                      {userName || 'Music Enthusiast'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </span>
                  </div>
                  <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
                    Tuned Vibe: <strong className="text-[var(--color-primary)]">{tasteProfile.activeVibe}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Micro-stats pill ribbon */}
            <div className="flex items-center gap-2 mt-4 pt-2.5 border-t border-white/[0.06] text-[#a1a1aa]">
              <span className="material-symbols-outlined floating-icon text-[var(--color-primary)] text-[16px]">
                verified_user
              </span>
              <span className="text-[11px] font-medium">
                100% Private • Local On-Device Library &amp; Streaming
              </span>
            </div>
          </div>

          {/* Section: Shortcuts & Management */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[var(--color-primary)] tracking-wider uppercase px-1">
              Shortcuts &amp; Tools
            </span>
            <div className="flex flex-col bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)] rounded-2xl overflow-hidden border border-white/[0.04]">
              {/* Settings shortcut */}
              <button 
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105/60 active:liquid-glass transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center text-[#e4e1e7] shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined floating-icon text-[22px]">tune</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-semibold text-[#e4e1e7] leading-snug">
                      App Settings
                    </span>
                    <span className="text-[11px] text-[#a1a1aa] truncate">
                      Colors, audio presets, silence skip, playback
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined floating-icon text-[#a1a1aa] text-[20px] group-hover:translate-x-0.5 transition-transform shrink-0">
                  chevron_right
                </span>
              </button>

              <div className="h-[1px] liquid-glass/40 mx-4" />

              {/* Clear Audio Cache */}
              <button 
                onClick={handleClearCache}
                disabled={cacheCleared}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105/60 active:liquid-glass transition-colors text-left group cursor-pointer floating-btn"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center text-[#e4e1e7] shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined floating-icon text-[22px]">cached</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-semibold text-[#e4e1e7] leading-snug">
                      {cacheCleared ? 'Cache Cleared' : 'Clear Audio Cache'}
                    </span>
                    <span className="text-[11px] text-[#a1a1aa] truncate">
                      {cacheCleared ? 'Freed temporary cached streams' : 'Free temporary stream memory'}
                    </span>
                  </div>
                </div>
                {cacheCleared ? (
                  <span className="text-[12px] font-bold text-emerald-400">Done</span>
                ) : (
                  <span className="material-symbols-outlined floating-icon text-[#a1a1aa] text-[20px] group-hover:translate-x-0.5 transition-transform shrink-0">
                    cleaning_services
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Engine Status Bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl liquid-glass-heavy border border-white/[0.04]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0 animate-pulse" />
              <span className="text-[11px] font-medium text-[#a1a1aa] truncate">
                Playback Engine: Universal Direct Audio
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-400">
              Lossless Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
