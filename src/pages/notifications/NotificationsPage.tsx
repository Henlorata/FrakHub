import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "react-router";
import {isToday, isYesterday, isThisWeek} from "date-fns";
import {Bell, BellOff, CheckCheck, Inbox, Loader2, Monitor, Settings2, Trash2} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {NotificationItem} from "@/components/notifications/NotificationItem";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {useNotifications} from "@/context/NotificationsContext";
import {CATEGORY_ORDER, NOTIFICATION_CATEGORIES} from "@/lib/notification-meta";
import {cn} from "@/lib/utils";
import type {Notification, NotificationCategory} from "@/types/supabase";

type Filter = "all" | "unread" | NotificationCategory;

const dayGroup = (iso: string) => {
  const date = new Date(iso);
  if (isToday(date)) return "Ma";
  if (isYesterday(date)) return "Tegnap";
  if (isThisWeek(date, {weekStartsOn: 1})) return "Ezen a héten";
  return "Korábban";
};

export function NotificationsPage() {
  const {
    items, unreadCount, loading, hasMore, loadMore, markRead, markAllRead, remove, clearRead, open,
  } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "settings" ? "settings" : "inbox";
  const [filter, setFilter] = useState<Filter>("all");
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const setView = (next: "inbox" | "settings") => {
    const params = new URLSearchParams(searchParams);
    if (next === "settings") params.set("view", "settings");
    else params.delete("view");
    setSearchParams(params, {replace: true});
  };

  const counts = useMemo(() => {
    const byCategory = new Map<NotificationCategory, number>();
    items.forEach((item) => {
      if (!item.is_read) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
    });
    return byCategory;
  }, [items]);

  const visible = useMemo(() => items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "unread") return !item.is_read;
    return item.category === filter;
  }), [items, filter]);

  const groups = useMemo(() => {
    const result: {label: string; items: Notification[]}[] = [];
    visible.forEach((item) => {
      const label = dayGroup(item.created_at);
      const last = result[result.length - 1];
      if (last?.label === label) last.items.push(item);
      else result.push({label, items: [item]});
    });
    return result;
  }, [visible]);

  const readCount = items.filter((item) => item.is_read).length;
  const presentCategories = CATEGORY_ORDER.filter((category) => items.some((item) => item.category === category));

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        icon={Bell}
        eyebrow="Kommunikáció"
        title="Értesítések"
        description={unreadCount > 0 ? `${unreadCount} olvasatlan értesítésed van.` : "Minden értesítésedet elolvastad."}
        actions={view === "inbox" ? (
          <>
            <Button variant="outline" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              <CheckCheck/> Összes olvasott
            </Button>
            <Button variant="outline" onClick={() => setIsClearOpen(true)} disabled={readCount === 0}
                    className="text-red-300 hover:text-red-200">
              <Trash2/> Olvasottak törlése
            </Button>
            <Button variant="ghost" size="icon" title="Beállítások" onClick={() => setView("settings")}>
              <Settings2/>
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setView("inbox")}><Inbox/> Vissza az értesítésekhez</Button>
        )}
      />

      {view === "settings" ? <NotificationSettings/> : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-1 lg:sticky lg:top-20 lg:self-start">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")} icon={Inbox} label="Összes"
                          count={unreadCount}/>
            <FilterButton active={filter === "unread"} onClick={() => setFilter("unread")} icon={Bell} label="Olvasatlan"
                          count={unreadCount}/>
            {presentCategories.length > 0 && <div className="my-2 h-px bg-white/5"/>}
            {presentCategories.map((category) => {
              const meta = NOTIFICATION_CATEGORIES[category];
              return (
                <FilterButton key={category} active={filter === category} onClick={() => setFilter(category)}
                              icon={meta.icon} label={meta.label} count={counts.get(category) ?? 0}/>
              );
            })}
          </aside>

          <section className="panel overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary/70"/></div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={filter === "unread" ? CheckCheck : BellOff}
                title={filter === "unread" ? "Nincs olvasatlan értesítésed" : "Nincs megjeleníthető értesítés"}
                description="Itt jelennek meg az előléptetések, akták, kérelmek, vizsgák és hirdetmények hírei."
              />
            ) : (
              <div className="divide-y divide-white/5">
                {groups.map((group) => (
                  <div key={group.label} className="p-2">
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                    {group.items.map((notification) => (
                      <NotificationItem key={notification.id} notification={notification} onOpen={open}
                                        onToggleRead={(item) => void markRead(item.id, !item.is_read)}
                                        onRemove={(item) => void remove(item.id)}/>
                    ))}
                  </div>
                ))}
                {hasMore && (
                  <div className="p-3 text-center">
                    <Button variant="ghost" onClick={() => void handleLoadMore()} disabled={isLoadingMore}>
                      {isLoadingMore && <Loader2 className="animate-spin"/>} Régebbi értesítések
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <AlertDialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Olvasott értesítések törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Az összes elolvasott értesítésed törlődik. Az olvasatlanok megmaradnak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" onClick={() => void clearRead()}>
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterButton({active, onClick, icon: Icon, label, count}: {
  active: boolean; onClick: () => void; icon: typeof Bell; label: string; count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        active ? "bg-white/[0.07] font-medium text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
      )}
    >
      <Icon className="size-4 shrink-0"/>
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span className="ml-auto rounded-full bg-primary/15 px-2 text-[11px] font-semibold text-primary tabular-nums">{count}</span>
      )}
    </button>
  );
}

function NotificationSettings() {
  const {mutedCategories, loadPreferences, setMutedCategories, desktopEnabled, setDesktopEnabled} = useNotifications();

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const toggleCategory = (category: NotificationCategory, enabled: boolean) => {
    const current = mutedCategories ?? [];
    void setMutedCategories(enabled ? current.filter((c) => c !== category) : [...current, category]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="panel p-5">
        <h3 className="text-sm font-semibold text-white">Kategóriák</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Válaszd ki, milyen témákban kérsz értesítést. A rendszerüzenetek (pl. fiókot érintő változások) nem kapcsolhatók ki.
        </p>
        <div className="mt-4 divide-y divide-white/5">
          {CATEGORY_ORDER.map((category) => {
            const meta = NOTIFICATION_CATEGORIES[category];
            const enabled = !(mutedCategories ?? []).includes(category);
            const Icon = meta.icon;
            return (
              <label key={category} className={cn("flex items-center gap-4 py-3", meta.mutable && "cursor-pointer")}>
                <div className={cn("grid size-9 place-items-center rounded-xl ring-1", meta.tone)}><Icon className="size-4"/></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{CATEGORY_HINTS[category]}</p>
                </div>
                <Switch checked={enabled} disabled={!meta.mutable || mutedCategories === null}
                        onCheckedChange={(value) => toggleCategory(category, value)}/>
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel h-fit p-5">
        <div className="flex items-start gap-4">
          <div className="grid size-9 place-items-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <Monitor className="size-4"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">Asztali értesítések</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Felugró értesítés a rendszer értesítési sávjában, amikor az oldal a háttérben van nyitva.
            </p>
          </div>
          <Switch checked={desktopEnabled} onCheckedChange={(value) => void setDesktopEnabled(value)}/>
        </div>
      </section>
    </div>
  );
}

const CATEGORY_HINTS: Record<NotificationCategory, string> = {
  hr: "Előléptetés, beosztás, képesítések, kitüntetés, figyelmeztetés, szabadság.",
  mcb: "Akták, közreműködők, üzenetek, parancsok, említések.",
  exam: "Javítandó vizsgalapok, eredmények, vizsgahozzáférések.",
  academy: "Akadémiai beosztások.",
  logistics: "Járműigénylések.",
  finance: "Költségtérítési kérelmek.",
  announcement: "Új hirdetmények az irányítópulton.",
  event: "Új események, lemondás, időpont-változás, és emlékeztető az esemény napján.",
  system:"Fiókot és biztonságot érintő üzenetek, készültségi szint.",
};
