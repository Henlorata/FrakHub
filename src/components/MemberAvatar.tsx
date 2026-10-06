import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn} from "@/lib/utils";

/** A member's picture (or initial) at a fixed size. */
export function MemberAvatar({name, avatarUrl, size = 32, className}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-white/10", className)} style={{width: size, height: size}}>
      <AvatarImage src={getOptimizedAvatarUrl(avatarUrl ?? null, size * 2) || undefined} alt=""/>
      <AvatarFallback className={cn("bg-slate-800 font-semibold text-slate-300", size >= 40 ? "text-sm" : "text-[10px]")}>
        {name?.charAt(0) ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}
