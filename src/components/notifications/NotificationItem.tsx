import {formatDistanceToNowStrict} from "date-fns";
import {hu} from "date-fns/locale";
import {Check, ChevronRight, CircleDot, Trash2} from "lucide-react";
import {categoryMeta, NOTIFICATION_TYPES} from "@/lib/notification-meta";
import {cn} from "@/lib/utils";
import type {Notification} from "@/types/supabase";

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onToggleRead?: (notification: Notification) => void;
  onRemove?: (notification: Notification) => void;
  compact?: boolean;
}

export const relativeTime = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), {addSuffix: true, locale: hu});

/** One notification row: category tile, title, message, time and hover actions. */
export function NotificationItem({notification, onOpen, onToggleRead, onRemove, compact}: NotificationItemProps) {
  const category = categoryMeta(notification.category);
  const type = NOTIFICATION_TYPES[notification.type] ?? NOTIFICATION_TYPES.info;
  const Icon = category.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(notification);
        }
      }}
      className={cn(
        "group relative flex w-full cursor-pointer gap-3 rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-3 py-2.5" : "px-4 py-3.5",
        notification.is_read ? "hover:bg-white/[0.03]" : "bg-primary/[0.04] hover:bg-primary/[0.07]",
      )}
    >
      <div className={cn("relative grid shrink-0 place-items-center rounded-xl ring-1", compact ? "size-9" : "size-10", category.tone)}>
        <Icon className="size-[18px]"/>
        {notification.type !== "info" && (
          <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[var(--popover)]", type.dot)}/>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn("flex items-start justify-between gap-2", !notification.is_read && "pr-3.5")}>
          <p className={cn("text-sm leading-snug", notification.is_read ? "font-medium text-slate-300" : "font-semibold text-white")}>
            {notification.title}
          </p>
          <span className="shrink-0 pt-0.5 text-[11px] text-slate-500 tabular-nums">{relativeTime(notification.created_at)}</span>
        </div>
        <p className={cn("mt-0.5 text-[13px] leading-relaxed", compact ? "line-clamp-2" : "line-clamp-3",
          notification.is_read ? "text-slate-500" : "text-slate-400")}>
          {notification.message}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
          <span>{category.label}</span>
          {notification.link && (
            <span className="inline-flex items-center gap-0.5 text-primary/80 opacity-0 transition-opacity group-hover:opacity-100">
              Megnyitás <ChevronRight className="size-3"/>
            </span>
          )}
        </div>
      </div>

      {!notification.is_read && (
        <span className="absolute top-4 right-3 size-2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/60 transition-opacity group-hover:opacity-0"/>
      )}

      {(onToggleRead || onRemove) && (
        <div className="absolute top-2.5 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {onToggleRead && (
            <button
              type="button"
              title={notification.is_read ? "Megjelölés olvasatlanként" : "Megjelölés olvasottként"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleRead(notification);
              }}
              className="grid size-7 place-items-center rounded-lg bg-slate-900/90 text-slate-400 ring-1 ring-white/10 hover:text-white"
            >
              {notification.is_read ? <CircleDot className="size-3.5"/> : <Check className="size-3.5"/>}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              title="Törlés"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(notification);
              }}
              className="grid size-7 place-items-center rounded-lg bg-slate-900/90 text-slate-400 ring-1 ring-white/10 hover:text-red-400"
            >
              <Trash2 className="size-3.5"/>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
