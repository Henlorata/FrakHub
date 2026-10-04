import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {useAuth} from "@/context/AuthContext";
import {uniqueChannelName} from "@/lib/realtime";
import {
  NOTIFICATION_COLUMNS,
  type Notification,
  type NotificationCategory,
} from "@/types/supabase";

const PAGE_SIZE = 30;
const DESKTOP_KEY = "frakhub:desktop-notifications";
const BASE_TITLE = "SFSD Intranet";

interface NotificationsContextValue {
  /** Newest first; the first page plus everything that arrived live or was loaded later. */
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  markRead: (id: string, read?: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearRead: () => Promise<void>;
  /** Opens a notification: marks it read and follows its link. */
  open: (notification: Notification) => void;
  mutedCategories: NotificationCategory[] | null;
  loadPreferences: () => Promise<void>;
  setMutedCategories: (categories: NotificationCategory[]) => Promise<boolean>;
  desktopEnabled: boolean;
  setDesktopEnabled: (enabled: boolean) => Promise<boolean>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const byNewest = (a: Notification, b: Notification) => b.created_at.localeCompare(a.created_at);

const showToast = (notification: Notification, onOpen?: () => void) => {
  const options = {
    description: notification.message,
    action: onOpen ? {label: "Megnyitás", onClick: onOpen} : undefined,
  };
  switch (notification.type) {
    case "success":
      toast.success(notification.title, options);
      break;
    case "warning":
      toast.warning(notification.title, options);
      break;
    case "alert":
      toast.error(notification.title, options);
      break;
    default:
      toast.info(notification.title, options);
  }
};

/**
 * The signed-in member's notifications: one count query, one page of rows and a single
 * Realtime channel shared by the header bell, the notification page and the tab title.
 * New notifications pop up as toasts (and as desktop notifications when enabled and the
 * tab is in the background).
 */
export function NotificationsProvider({children}: {children: ReactNode}) {
  const {supabase, user} = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? null;

  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mutedCategories, setMuted] = useState<NotificationCategory[] | null>(null);
  const [desktopEnabled, setDesktopState] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DESKTOP_KEY) === "1"
      && typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  // Event handlers read the latest values through refs, so the Realtime channel does not
  // have to be re-created whenever they change.
  const itemsRef = useRef<Notification[]>([]);
  const desktopRef = useRef(desktopEnabled);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    desktopRef.current = desktopEnabled;
    navigateRef.current = navigate;
  }, [desktopEnabled, navigate]);

  const markRead = useCallback(async (id: string, read = true) => {
    const current = itemsRef.current.find((item) => item.id === id);
    if (!current || current.is_read === read) return;
    setItems((prev) => prev.map((item) => (item.id === id ? {...item, is_read: read} : item)));
    setUnreadCount((count) => Math.max(0, count + (read ? -1 : 1)));
    const {error} = await supabase.from("notifications").update({is_read: read}).eq("id", id);
    if (error) {
      setItems((prev) => prev.map((item) => (item.id === id ? {...item, is_read: !read} : item)));
      setUnreadCount((count) => Math.max(0, count + (read ? 1 : -1)));
      toast.error("Nem sikerült módosítani az értesítést.");
    }
  }, [supabase]);

  const open = useCallback((notification: Notification) => {
    if (!notification.is_read) void markRead(notification.id);
    if (notification.link) navigateRef.current(notification.link);
  }, [markRead]);

  const announce = useCallback((notification: Notification) => {
    const follow = notification.link ? () => open(notification) : undefined;
    showToast(notification, follow);
    if (desktopRef.current && document.hidden && typeof Notification !== "undefined"
        && Notification.permission === "granted") {
      const desktop = new Notification(notification.title, {body: notification.message, tag: notification.id, icon: "/favicon.svg"});
      desktop.onclick = () => {
        window.focus();
        open(notification);
        desktop.close();
      };
    }
  }, [open]);

  // Initial load: unread count and the first page, in parallel.
  const loadInitial = useCallback(async () => {
    if (!userId) return;
    const [countResult, listResult] = await Promise.all([
      supabase.from("notifications").select("id", {count: "exact", head: true}).eq("user_id", userId).eq("is_read", false),
      supabase.from("notifications").select(NOTIFICATION_COLUMNS).eq("user_id", userId)
        .order("created_at", {ascending: false}).limit(PAGE_SIZE),
    ]);
    if (!countResult.error) setUnreadCount(countResult.count ?? 0);
    if (!listResult.error) {
      const rows = (listResult.data ?? []) as Notification[];
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadInitial();
    let subscribedOnce = false;

    const channel = supabase
      .channel(uniqueChannelName(`notifications:${userId}`))
      .on("postgres_changes", {event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}`},
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Notification;
            if (itemsRef.current.some((item) => item.id === row.id)) return;
            setItems((prev) => [row, ...prev].sort(byNewest));
            if (!row.is_read) setUnreadCount((count) => count + 1);
            announce(row);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Notification;
            const previous = itemsRef.current.find((item) => item.id === row.id);
            if (previous) {
              if (previous.is_read !== row.is_read) setUnreadCount((count) => Math.max(0, count + (row.is_read ? -1 : 1)));
              setItems((prev) => prev.map((item) => (item.id === row.id ? row : item)).sort(byNewest));
            } else {
              setItems((prev) => [row, ...prev].sort(byNewest));
            }
            // A coalesced notification (same topic, still unread) was refreshed: show it again.
            if (!row.is_read && (!previous || previous.created_at !== row.created_at)) announce(row);
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as {id?: string}).id;
            const previous = itemsRef.current.find((item) => item.id === id);
            if (!previous) return;
            setItems((prev) => prev.filter((item) => item.id !== id));
            if (!previous.is_read) setUnreadCount((count) => Math.max(0, count - 1));
          }
        })
      .subscribe((status) => {
        // After a dropped connection, catch up on what was missed.
        if (status === "SUBSCRIBED") {
          if (subscribedOnce) void loadInitial();
          subscribedOnce = true;
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadInitial, announce]);

  // Unread count in the browser tab title.
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [unreadCount]);

  const loadMore = useCallback(async () => {
    if (!userId) return;
    const oldest = itemsRef.current[itemsRef.current.length - 1];
    let query = supabase.from("notifications").select(NOTIFICATION_COLUMNS).eq("user_id", userId)
      .order("created_at", {ascending: false}).limit(PAGE_SIZE);
    if (oldest) query = query.lt("created_at", oldest.created_at);
    const {data, error} = await query;
    if (error) {
      toast.error("A régebbi értesítések betöltése nem sikerült.");
      return;
    }
    const rows = (data ?? []) as Notification[];
    setItems((prev) => {
      const known = new Set(prev.map((item) => item.id));
      return [...prev, ...rows.filter((row) => !known.has(row.id))].sort(byNewest);
    });
    setHasMore(rows.length === PAGE_SIZE);
  }, [supabase, userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const previous = itemsRef.current;
    const previousCount = unreadCount;
    setItems((prev) => prev.map((item) => ({...item, is_read: true})));
    setUnreadCount(0);
    const {error} = await supabase.from("notifications").update({is_read: true}).eq("user_id", userId).eq("is_read", false);
    if (error) {
      setItems(previous);
      setUnreadCount(previousCount);
      toast.error("Nem sikerült olvasottra állítani az értesítéseket.");
    }
  }, [supabase, userId, unreadCount]);

  const remove = useCallback(async (id: string) => {
    const previous = itemsRef.current.find((item) => item.id === id);
    if (!previous) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (!previous.is_read) setUnreadCount((count) => Math.max(0, count - 1));
    const {error} = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      setItems((prev) => [...prev, previous].sort(byNewest));
      if (!previous.is_read) setUnreadCount((count) => count + 1);
      toast.error("Az értesítés törlése nem sikerült.");
    }
  }, [supabase]);

  const clearRead = useCallback(async () => {
    if (!userId) return;
    const previous = itemsRef.current;
    setItems((prev) => prev.filter((item) => !item.is_read));
    const {error} = await supabase.from("notifications").delete().eq("user_id", userId).eq("is_read", true);
    if (error) {
      setItems(previous);
      toast.error("Az olvasott értesítések törlése nem sikerült.");
    } else toast.success("Olvasott értesítések törölve.");
  }, [supabase, userId]);

  const loadPreferences = useCallback(async () => {
    if (!userId || mutedCategories !== null) return;
    const {data, error} = await supabase.from("notification_preferences")
      .select("muted_categories").eq("user_id", userId).maybeSingle();
    if (!error) setMuted((data?.muted_categories ?? []) as NotificationCategory[]);
  }, [supabase, userId, mutedCategories]);

  const setMutedCategories = useCallback(async (categories: NotificationCategory[]) => {
    if (!userId) return false;
    const previous = mutedCategories;
    setMuted(categories);
    const {error} = await supabase.from("notification_preferences").upsert({
      user_id: userId, muted_categories: categories, updated_at: new Date().toISOString(),
    });
    if (error) {
      setMuted(previous);
      toast.error("A beállítás mentése nem sikerült.");
      return false;
    }
    return true;
  }, [supabase, userId, mutedCategories]);

  const setDesktopEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      if (typeof Notification === "undefined") {
        toast.error("Ez a böngésző nem támogatja az asztali értesítéseket.");
        return false;
      }
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        toast.error("Az asztali értesítéseket a böngésző beállításaiban engedélyezheted.");
        return false;
      }
    }
    localStorage.setItem(DESKTOP_KEY, enabled ? "1" : "0");
    setDesktopState(enabled);
    return true;
  }, []);

  const value = useMemo<NotificationsContextValue>(() => ({
    items, unreadCount, loading, hasMore, loadMore, markRead, markAllRead, remove, clearRead, open,
    mutedCategories, loadPreferences, setMutedCategories, desktopEnabled, setDesktopEnabled,
  }), [items, unreadCount, loading, hasMore, loadMore, markRead, markAllRead, remove, clearRead, open,
    mutedCategories, loadPreferences, setMutedCategories, desktopEnabled, setDesktopEnabled]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used within a NotificationsProvider");
  return context;
}
