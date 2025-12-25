import {cn} from '@/lib/utils';

interface SheriffBackgroundProps {
  side?: 'left' | 'right';
}

export const SheriffBackground = ({side = 'right'}: SheriffBackgroundProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#020408]">

      {/* ALAP HÁTTÉR */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'linear-gradient(rgba(234, 179, 8, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(234, 179, 8, 0.15) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      {/* AMBIENT FÉNYEK */}
      <div
        className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-blue-900/20 rounded-full blur-[120px] animate-float mix-blend-screen"></div>
      <div
        className="absolute bottom-0 right-0 w-[60vw] h-[60vw] bg-yellow-900/20 rounded-full blur-[120px] animate-float mix-blend-screen"
        style={{animationDelay: '2s'}}></div>

      {/* HOLOGRAM RENDSZER */}
      <div
        className={cn(
          "absolute bottom-[-20%] w-[1000px] h-[1000px] flex items-center justify-center pointer-events-none select-none opacity-50",
          side === 'right' ? "right-[-10%]" : "left-[-5%]"
        )}>

        {/* Külső Skála Gyűrű */}
        <div
          className="absolute w-[900px] h-[900px] border border-dashed border-yellow-500/40 rounded-full animate-spin-slow"></div>

        {/* Középső Tech Gyűrű */}
        <div
          className="absolute w-[700px] h-[700px] border-2 border-yellow-500/20 rounded-full animate-spin-reverse-slow border-t-transparent border-b-transparent"></div>

        {/* Célkereszt (Statikus) */}
        <div className="absolute w-[1000px] h-[1px] bg-yellow-500/20"></div>
        <div className="absolute h-[1000px] w-[1px] bg-yellow-500/20"></div>

        {/* LÉLEGZŐ MAG */}
        <div className="absolute w-[400px] h-[400px] bg-yellow-500/10 rounded-full blur-3xl animate-pulse-glow"></div>

        {/* SHERIFF CSILLAG */}
        <div className="absolute w-[500px] h-[500px] animate-spin-slow" style={{animationDuration: '120s'}}>
          <svg viewBox="0 0 200 200"
               fill="none"
               stroke="currentColor"
               strokeWidth="1.5"
               className="text-yellow-500 w-full h-full drop-shadow-[0_0_30px_rgba(234,179,8,0.6)]">

            <path
              d="
                M100 20
                L118 72
                L174 72
                L128 106
                L146 160
                L100 128
                L54 160
                L72 106
                L26 72
                L82 72
                Z"
              fill="rgba(234, 179, 8, 0.05)"
            />

            <circle cx="100" cy="100" r="40" strokeWidth="1"/>
            <circle cx="100" cy="100" r="32" strokeWidth="0.5" strokeDasharray="3 3"/>

            <path
              d="
                M100 100 L100 20
                M100 100 L174 72
                M100 100 L146 160
                M100 100 L54 160
                M100 100 L26 72
              "
              strokeWidth="0.5"
              opacity="0.7"
            />
          </svg>

        </div>
      </div>

      {/* IGNETTE */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#020408]/50 to-[#020408] z-10"></div>
    </div>
  );
};