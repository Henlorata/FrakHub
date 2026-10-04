import {AlertTriangle, CalendarCheck, CalendarX, HelpCircle} from "lucide-react";
import {REGISTRATION_PILL, registrationStatus} from "@/lib/registry";
import {cn} from "@/lib/utils";

const ICONS = {ok: CalendarCheck, soon: AlertTriangle, expired: CalendarX, missing: HelpCircle};

/** Registration validity of a vehicle: green, amber when it expires soon, red when expired. */
export function RegistrationBadge({expiresOn, className}: {expiresOn: string | null; className?: string}) {
  const status = registrationStatus(expiresOn);
  const Icon = ICONS[status.state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1",
      REGISTRATION_PILL[status.state], (status.state === "expired" || status.state === "soon") && "motion-safe:animate-pulse", className)}>
      <Icon className="size-3"/>{status.label}
    </span>
  );
}
