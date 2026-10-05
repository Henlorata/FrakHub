import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn} from "@/lib/utils";

/** Avatar of an exam candidate (guests have none: their initial is shown). */
export function CandidateAvatar({name, url, className}: {name: string; url: string | null | undefined; className?: string}) {
  return (
    <Avatar className={cn("size-10 ring-1 ring-white/10", className)}>
      <AvatarImage src={getOptimizedAvatarUrl(url ?? null, 96) || undefined} alt=""/>
      <AvatarFallback className="bg-slate-800 text-sm font-semibold text-slate-200">{name.charAt(0).toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );
}
