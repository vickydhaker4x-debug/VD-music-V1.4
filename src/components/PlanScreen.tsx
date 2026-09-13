import React, { useState } from 'react';
import { OPENTUNE_LOGO_URL } from '../data/musicData';

interface PlanScreenProps {
  onComplete: (name: string) => void;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({ onComplete }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center liquid-glass-heavy p-6 animate-in fade-in duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-[var(--color-primary)]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-red-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
        <div className="w-20 h-20 mb-8 rounded-3xl overflow-hidden shadow-[0_0_24px_rgba(248,113,113,0.2)] liquid-glass border border-white/[0.08] p-1 flex items-center justify-center">
          <img 
            alt="VD Music" 
            src={OPENTUNE_LOGO_URL} 
            className="w-full h-full object-cover rounded-[20px]" 
          />
        </div>
        
        <h1 className="text-3xl font-bold text-[#e4e1e7] mb-2 tracking-tight">
          Welcome to VD Music
        </h1>
        <p className="text-[#a1a1aa] mb-8 text-[15px]">
          Before we start playing your favorite tunes, what should we call you?
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col text-left">
            <label htmlFor="user-name" className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2 ml-1">
              Your Name
            </label>
            <input
              id="user-name"
              type="text"
              placeholder="e.g. Vicky"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full liquid-glass border border-white/[0.08] rounded-2xl px-4 py-4 text-[#e4e1e7] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/50 transition-all text-[16px]"
              autoFocus
              maxLength={20}
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-4 mt-2 rounded-2xl bg-[var(--color-primary)] text-[#670211] font-bold text-[16px] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_20px_rgba(248,113,113,0.3)] floating-btn"
          >
            Let's Go
          </button>
        </form>
      </div>
    </div>
  );
};
