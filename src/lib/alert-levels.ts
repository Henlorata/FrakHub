import {Activity, AlertTriangle, Shield, Siren, type LucideIcon} from "lucide-react";
import type {AlertLevelId} from "@/context/SystemStatusContext";

export interface AlertLevelMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Hex colour of the status line and indicators. */
  color: string;
  text: string;
  badge: string;
}

export const ALERT_LEVELS: Record<AlertLevelId, AlertLevelMeta> = {
  normal: {
    label: "Normál", description: "Általános szolgálati rend.", icon: Shield, color: "#eab308",
    text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  },
  traffic: {
    label: "Fokozott ellenőrzés", description: "Kiemelt közlekedési és járőr ellenőrzések.", icon: Activity, color: "#eab308",
    text: "text-yellow-400", badge: "bg-yellow-500/10 text-yellow-300 ring-yellow-500/30",
  },
  border: {
    label: "Határellenőrzés", description: "Határellenőrzés, fokozott készültség.", icon: AlertTriangle, color: "#f97316",
    text: "text-orange-400", badge: "bg-orange-500/10 text-orange-300 ring-orange-500/30",
  },
  tactical: {
    label: "Taktikai riadó", description: "Minden egység azonnali bevetésre kész.", icon: Siren, color: "#ef4444",
    text: "text-red-400", badge: "bg-red-500/10 text-red-300 ring-red-500/30",
  },
};

export const ALERT_LEVEL_ORDER: AlertLevelId[] = ["normal", "traffic", "border", "tactical"];
