import {Check, DoorClosed, DoorOpen} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {ALERT_LEVEL_ORDER, ALERT_LEVELS} from "@/lib/alert-levels";
import {cn, isHighCommand} from "@/lib/utils";

/** Alert level pill in the header; high command can change it (and recruitment) from here. */
export function SystemStatusMenu() {
  const {profile} = useAuth();
  const {alertLevel, setAlertLevel, recruitmentOpen, toggleRecruitment} = useSystemStatus();
  const level = ALERT_LEVELS[alertLevel];
  const canManage = !!profile && (profile.system_role === "admin" || isHighCommand(profile) || !!profile.is_bureau_manager);

  const pill = (
    <span className={cn(
      "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium ring-1 transition-colors",
      level.badge, canManage && "cursor-pointer hover:brightness-125",
    )}>
      <span className="relative flex size-2">
        {alertLevel !== "normal" && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{backgroundColor: level.color}}/>}
        <span className="relative inline-flex size-2 rounded-full" style={{backgroundColor: alertLevel === "normal" ? "#22c55e" : level.color}}/>
      </span>
      <span className="hidden sm:inline">{level.label}</span>
    </span>
  );

  if (!canManage) return <span title={`Készültség: ${level.label}`} data-tour="status">{pill}</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-tour="status" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{pill}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" data-tour="status-menu">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Készültségi szint</DropdownMenuLabel>
        {ALERT_LEVEL_ORDER.map((id) => {
          const meta = ALERT_LEVELS[id];
          const Icon = meta.icon;
          return (
            <DropdownMenuItem key={id} onSelect={() => void setAlertLevel(id)} className="items-start gap-3 py-2">
              <Icon className={cn("mt-0.5 size-4", meta.text)}/>
              <div className="flex-1">
                <p className="text-sm text-white">{meta.label}</p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              {alertLevel === id && <Check className="mt-0.5 size-4 text-primary"/>}
            </DropdownMenuItem>
          );
        })}
        {profile?.system_role === "admin" && (
          <>
            <DropdownMenuSeparator/>
            <DropdownMenuItem onSelect={() => void toggleRecruitment()} className="gap-3 py-2">
              {recruitmentOpen ? <DoorOpen className="size-4 text-emerald-400"/> : <DoorClosed className="size-4 text-red-400"/>}
              <div className="flex-1">
                <p className="text-sm text-white">Tagfelvétel: {recruitmentOpen ? "nyitva" : "zárva"}</p>
                <p className="text-xs text-muted-foreground">Kattints a {recruitmentOpen ? "lezáráshoz" : "megnyitáshoz"}.</p>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
