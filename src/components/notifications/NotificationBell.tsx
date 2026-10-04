import {useState} from "react";
import {useNavigate} from "react-router";
import {Bell, BellOff, CheckCheck, Settings2} from "lucide-react";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Button} from "@/components/ui/button";
import {useNotifications} from "@/context/NotificationsContext";
import {NotificationItem} from "./NotificationItem";
import {cn} from "@/lib/utils";
import type {Notification} from "@/types/supabase";

const PREVIEW_COUNT = 8;

/** Header bell: unread badge and a popover with the latest notifications. */
export function NotificationBell() {
  const {items, unreadCount, loading, open, markRead, markAllRead} = useNotifications();
  // The bell rings when the unread count grows (a new notification arrived live).
  const [ringKey, setRingKey] = useState(0);
  const [previousCount, setPreviousCount] = useState(unreadCount);
  if (unreadCount !== previousCount) {
    if (unreadCount > previousCount) setRingKey((key) => key + 1);
    setPreviousCount(unreadCount);
  }
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const preview = items.slice(0, PREVIEW_COUNT);

  const handleOpen = (notification: Notification) => {
    setIsOpen(false);
    open(notification);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Értesítések (${unreadCount} olvasatlan)` : "Értesítések"}
          className={cn(
            "relative grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isOpen && "bg-white/5 text-white",
          )}
        >
          <Bell key={ringKey} className={cn("size-[18px]", ringKey > 0 && "animate-bell")}/>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(420px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Értesítések</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} olvasatlan` : "Nincs olvasatlan értesítésed"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" title="Összes olvasott" disabled={unreadCount === 0}
                    onClick={() => void markAllRead()} className="text-slate-400 hover:text-white">
              <CheckCheck className="size-4"/>
            </Button>
            <Button variant="ghost" size="icon-sm" title="Beállítások" className="text-slate-400 hover:text-white"
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/notifications?view=settings");
                    }}>
              <Settings2 className="size-4"/>
            </Button>
          </div>
        </div>

        <div className="max-h-[min(460px,70vh)] overflow-y-auto p-1.5">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({length: 3}, (_, i) => (
                <div key={i} className="flex gap-3 rounded-xl p-2">
                  <div className="size-9 animate-pulse rounded-xl bg-white/5"/>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-white/5"/>
                    <div className="h-3 w-full animate-pulse rounded bg-white/5"/>
                  </div>
                </div>
              ))}
            </div>
          ) : preview.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BellOff className="size-7 text-slate-600"/>
              <p className="text-sm text-slate-400">Minden csendes.</p>
              <p className="text-xs text-slate-500">Itt jelennek meg az előléptetések, akták, kérelmek és vizsgák hírei.</p>
            </div>
          ) : (
            preview.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} compact
                                onOpen={handleOpen}
                                onToggleRead={(item) => void markRead(item.id, !item.is_read)}/>
            ))
          )}
        </div>

        <div className="border-t p-1.5">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate("/notifications");
            }}
            className="w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Összes értesítés megtekintése
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
