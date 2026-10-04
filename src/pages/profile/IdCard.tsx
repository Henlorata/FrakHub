import * as React from "react";
import {Fingerprint, QrCode, Shield} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn, getDepartmentLabel} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {Profile} from "@/types/supabase";

interface IdCardTheme {
  bg: string;
  border: string;
  text: string;
  logo?: string;
}

const themeFor = (profile: Profile): IdCardTheme => {
  if (profile.is_bureau_manager) {
    return {bg: "bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81]", border: "border-purple-500/50", text: "text-purple-300"};
  }
  if (profile.division === "SEB") {
    return {bg: "bg-gradient-to-br from-[#0f172a] via-[#1a0505] to-black", border: "border-red-600/50", text: "text-red-400", logo: "/seb.png"};
  }
  if (profile.division === "MCB") {
    return {bg: "bg-gradient-to-br from-[#0f172a] via-[#050f1a] to-black", border: "border-sky-500/50", text: "text-sky-300", logo: "/mcb.png"};
  }
  return {bg: "bg-gradient-to-br from-[#0f172a] via-[#051a0f] to-black", border: "border-emerald-600/50", text: "text-emerald-400"};
};

/** Service ID card with a subtle 3D tilt and a light that follows the pointer. */
export function IdCard({profile, joinedOn, onLeave}: {profile: Profile; joinedOn: string | null; onLeave: boolean}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const shineRef = React.useRef<HTMLDivElement>(null);
  const theme = themeFor(profile);
  const avatarSrc = getOptimizedAvatarUrl(profile.avatar_url, 320);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !shineRef.current || window.innerWidth < 1024) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -4;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 4;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
    shineRef.current.style.background = `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255,255,255,0.14), transparent 60%)`;
  };
  const handleLeave = () => {
    if (!cardRef.current || !shineRef.current) return;
    cardRef.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
    shineRef.current.style.background = "transparent";
  };

  return (
    <div ref={cardRef} onMouseMove={handleMove} onMouseLeave={handleLeave}
         className={cn("relative w-full select-none overflow-hidden rounded-2xl border-2 p-6 shadow-2xl transition-transform duration-300 ease-out will-change-transform",
           theme.border, theme.bg)}>
      <div ref={shineRef} className="pointer-events-none absolute inset-0 z-20 rounded-2xl mix-blend-overlay transition-all duration-300"/>
      <div className="tex-carbon pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"/>

      <div className="relative z-10 mb-5 flex items-start justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded border border-white/10 bg-black/40 p-2.5 shadow-inner"><Shield className={cn("size-8", theme.text)}/></div>
          <div className="leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">San Fierro</div>
            <div className="text-xl font-black uppercase tracking-tighter text-white">Sheriff's Dept</div>
            <div className={cn("mt-0.5 text-xs font-bold uppercase tracking-[0.25em]", theme.text)}>{getDepartmentLabel(profile.division)}</div>
          </div>
        </div>
        {theme.logo && <img src={theme.logo} alt="" className="size-14 object-contain opacity-90 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"/>}
      </div>

      <div className="relative z-10 flex items-center gap-5">
        <div className="group relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded border border-white/20 bg-black shadow-2xl">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 transition-opacity duration-300 group-hover:opacity-0">
            <Fingerprint className={cn("size-16 opacity-80 motion-safe:animate-pulse", theme.text)}/>
            <div className="absolute inset-x-0 h-0.5 bg-white/50 shadow-[0_0_15px_rgba(255,255,255,0.8)] motion-safe:animate-[scan-vertical_2.5s_ease-in-out_infinite]"/>
          </div>
          <Avatar className="absolute inset-0 size-full rounded-none opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <AvatarImage src={avatarSrc || ""} className="object-cover"/>
            <AvatarFallback className="rounded-none bg-slate-800 text-3xl font-bold text-slate-500">{profile.full_name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Név</div>
            <div className="text-xl font-black uppercase leading-none tracking-tight text-white wrap-anywhere">{profile.full_name}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rendfokozat</div>
              <div className={cn("text-xs font-bold uppercase", theme.text)}>{profile.faction_rank}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Jelvény</div>
              <div className="inline-block rounded bg-white/10 px-2 font-mono text-base font-black tracking-[0.2em] text-white">#{profile.badge_number}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {profile.is_bureau_manager && <Badge className="border-none bg-purple-600 text-white">MANAGER</Badge>}
            {profile.is_bureau_commander && <Badge className="border-none bg-blue-600 text-white">COMMANDER</Badge>}
            {(profile.qualifications || []).map((q) => (
              <Badge key={q} variant="outline" className="border-slate-600 bg-black/20 text-slate-300">{q}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-end justify-between border-t border-white/10 pt-4 opacity-80">
        <div className="flex items-center gap-2.5">
          <QrCode className="size-7 text-white/80"/>
          <div className="font-mono text-[10px] leading-tight text-slate-400">
            Csatlakozott: {formatDate(joinedOn ?? profile.created_at)}<br/>Előléptetve: {formatDate(profile.last_promotion_date)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("size-2.5 rounded-full motion-safe:animate-pulse", onLeave ? "bg-sky-400" : "bg-green-500 shadow-[0_0_8px_#22c55e]")}/>
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-white">{onLeave ? "Szabadságon" : "Aktív"}</span>
        </div>
      </div>
    </div>
  );
}
