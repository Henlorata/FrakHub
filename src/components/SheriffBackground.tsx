import React from 'react';
import {cn} from '@/lib/utils';

interface SheriffBackgroundProps {
  side?: 'left' | 'right';
}

export const SheriffBackground = ({side = 'right'}: SheriffBackgroundProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#020408]">

      {/* 1. ALAP HÁTTÉR (Rács) */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'linear-gradient(rgba(234, 179, 8, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(234, 179, 8, 0.15) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      {/* 2. AMBIENT FÉNYEK (Erősebbek) */}
      <div
        className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-blue-900/20 rounded-full blur-[120px] animate-float mix-blend-screen"></div>
      <div
        className="absolute bottom-0 right-0 w-[60vw] h-[60vw] bg-yellow-900/20 rounded-full blur-[120px] animate-float mix-blend-screen"
        style={{animationDelay: '2s'}}></div>

      {/* 3. HOLOGRAM RENDSZER (Pozícionálható) */}
      <div
        className={cn(
          "absolute bottom-[-20%] w-[1000px] h-[1000px] flex items-center justify-center pointer-events-none select-none opacity-50 transition-all duration-1000",
          side === 'right' ? "right-[-10%]" : "left-[-5%]"
        )}>

        {/* A. Külső Skála Gyűrű */}
        <div
          className="absolute w-[900px] h-[900px] border border-dashed border-yellow-500/40 rounded-full animate-spin-slow"></div>

        {/* B. Középső Tech Gyűrű */}
        <div
          className="absolute w-[700px] h-[700px] border-2 border-yellow-500/20 rounded-full animate-spin-reverse-slow border-t-transparent border-b-transparent"></div>

        {/* C. Célkereszt (Statikus) */}
        <div className="absolute w-[1000px] h-[1px] bg-yellow-500/20"></div>
        <div className="absolute h-[1000px] w-[1px] bg-yellow-500/20"></div>

        {/* D. LÉLEGZŐ MAG (Glow) - Ez adja a pulzáló hatást */}
        <div className="absolute w-[400px] h-[400px] bg-yellow-500/10 rounded-full blur-3xl animate-pulse-glow"></div>

        {/* E. SHERIFF CSILLAG (Forgó) */}
        <div className="absolute w-[500px] h-[500px] animate-spin-slow" style={{animationDuration: '120s'}}>
          <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.5"
               className="text-yellow-500 w-full h-full drop-shadow-[0_0_30px_rgba(234,179,8,0.6)]">
            {/* Csillag alap */}
            <path d="M100,5 L123,65 L186,65 L136,105 L153,170 L100,135 L47,170 L64,105 L14,65 L78,65 Z"
                  fill="rgba(234, 179, 8, 0.05)"/>

            {/* Belső körök */}
            <circle cx="100" cy="100" r="40" strokeWidth="1"/>
            <circle cx="100" cy="100" r="32" strokeWidth="0.5" strokeDasharray="3 3"/>

            {/* Vonalak a csúcsokhoz */}
            <path d="M100,5 L100,40 M186,65 L150,90 M153,170 L110,130 M47,170 L90,130 M14,65 L50,90" strokeWidth="0.5"
                  opacity="0.7"/>
          </svg>
        </div>
      </div>

      {/* 4. VIGNETTE (Kontraszt növelése) */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#020408]/50 to-[#020408] z-10"></div>
    </div>
  );
};