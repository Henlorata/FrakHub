import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn} from "@/lib/utils";

/** A member's picture (or initial) at a fixed size. */
export function MemberAvatar({name, avatarUrl, size = 32, className}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: 24 | 28 | 32 | 40;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-white/10", className)} style={{width: size, height: size}}>
      <AvatarImage src={getOptimizedAvatarUrl(avatarUrl ?? null, size * 2) || undefined} alt=""/>
      <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">{name?.charAt(0) ?? "?"}</AvatarFallback>
    </Avatar>
  );
}
