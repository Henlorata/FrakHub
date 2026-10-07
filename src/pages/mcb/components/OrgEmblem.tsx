import {createElement} from "react";
import {getOptimizedImageUrl} from "@/lib/cloudinary";
import {inkOn, ORG_KINDS, type OrgKind} from "@/lib/organizations";

/** An organisation's emblem: its logo, or its kind's icon on its colour. */
export function OrgEmblem({name, color, logoUrl, kind, size = 48}: {name: string; color: string | null; logoUrl: string | null; kind: OrgKind; size?: number}) {
  if (logoUrl) {
    return (
      <img src={getOptimizedImageUrl(logoUrl, size * 2)} alt={name} width={size} height={size}
           className="shrink-0 rounded-xl bg-black/30 object-contain ring-1 ring-white/10" style={{width: size, height: size}}/>
    );
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl ring-1 ring-white/15"
          style={{width: size, height: size, background: color ?? "#334155", color: inkOn(color),
            boxShadow: color ? `0 0 ${Math.round(size / 2)}px ${color}40` : undefined}}>
      {createElement((ORG_KINDS[kind] ?? ORG_KINDS.other).icon, {style: {width: size * 0.45, height: size * 0.45}})}
    </span>
  );
}
