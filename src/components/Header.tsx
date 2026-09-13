import React from 'react';
import { OPENTUNE_LOGO_URL } from '../data/musicData';
import { ActiveScreen } from '../types';

interface HeaderProps {
  activeScreen: ActiveScreen;
  userName?: string;
  onOpenAccountSync: () => void;
  onOpenHistory: () => void;
  onOpenEqualizer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  userName,
  onOpenAccountSync,
  onOpenHistory,
  onOpenEqualizer
}) => {
  const getScreenTitle = () => {
    switch (activeScreen) {
      case 'home':
        return 'Home';
      case 'explore':
        return 'Explore';
      case 'search':
        return 'Search';
      case 'library':
        return 'Library';
      case 'settings':
        return 'Settings';
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return '';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header 
      id="app-header"
      className="fixed top-0 w-full z-40 pt-safe liquid-glass-heavy"
    >
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3 max-w-4xl mx-auto">
        {/* Logo and Brand Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-[0_0_12px_rgba(248,113,113,0.35)] shrink-0 border border-white/[0.08] liquid-glass-heavy flex items-center justify-center group cursor-pointer">
            <img 
              alt="VD Music Logo" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
              src={OPENTUNE_LOGO_URL} 
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[19px] tracking-tight text-[#e4e1e7] truncate leading-tight">
              {activeScreen === 'home' && userName ? `Hey ${userName}` : 'VD Music'}
            </span>
            <span className="text-[11px] font-semibold text-[#a1a1aa] capitalize leading-none truncate">
              {getScreenTitle()}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Account Profile / Sync Button */}
          <button 
            id="header-account-btn"
            aria-label="Account & Sync" 
            onClick={onOpenAccountSync}
            className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-[#670211] flex items-center justify-center shadow-[0_0_14px_rgba(248,113,113,0.4)] hover:brightness-110 active:scale-90 transition-transform shrink-0 ml-1.5 cursor-pointer font-bold text-[12px] tracking-widest floating-btn"
            title="Account & Sync Cloud Instances"
          >
            {userName ? (
              <span>{getUserInitials(userName)}</span>
            ) : (
              <span className="material-symbols-outlined floating-icon text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                person
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
