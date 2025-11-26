import * as React from "react";
import {
  prepareData,
  formatCurrency,
  formatJailTime,
} from "@/lib/penalcode-processor";
import type {
  PenalCodeItem,
  KategoriaData,
  PenalCodeGroup,
} from "@/types/penalcode";
import {useMediaQuery} from "@/hooks/use-media-query";
import { useAuth } from "@/context/AuthContext";

// UI Komponensek
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {Slider} from "@/components/ui/slider";
import {Textarea} from "@/components/ui/textarea";
import {toast} from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  Copy,
  History,
  Search,
  Star,
  X,
  DollarSign,
  Target,
  ClipboardCheck,
  Save,
  Trash2,
  Gavel,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {Badge} from "@/components/ui/badge";

// --- Típusok ---

interface CartItem {
  item: PenalCodeItem;
  quantity: number;
}

interface HistorySnapshot {
  cart: CartItem[];
  finalFine: number;
  finalJail: number;
  reasons: string;
  timestamp: string;
}

interface Template {
  id: string;
  name: string;
  cart: CartItem[];
  savedFine: number;
  savedJail: number;
}

interface Summary {
  minFine: number;
  maxFine: number;
  minJail: number;
  maxJail: number;
  specialJailNotes: string[];
  warningItems: PenalCodeItem[];
}

type FilteredPenalCodeGroup = PenalCodeGroup & { _matchType?: "group" | "children" };
type FilteredKategoriaData = {
  kategoria_nev: string;
  items: (PenalCodeItem | FilteredPenalCodeGroup)[];
}

// --- Adatok ---
const ALL_KATEGORIA_GROUPS = prepareData();
const ALL_KATEGORIA_NAMES = ALL_KATEGORIA_GROUPS.map(k => k.kategoria_nev);
const ALL_ITEMS_MAP = new Map<string, PenalCodeItem>();
ALL_KATEGORIA_GROUPS.forEach((kat) => {
  kat.items.forEach((itemOrGroup) => {
    if ("alpontok" in itemOrGroup) {
      itemOrGroup.alpontok.forEach((item) => ALL_ITEMS_MAP.set(item.id, item));
    } else {
      ALL_ITEMS_MAP.set(itemOrGroup.id, itemOrGroup);
    }
  });
});

// --- Hook ---
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
}

// --- Segédfüggvények ---
function getRelativeTime(timestamp: string) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  try {
    const rtf = new Intl.RelativeTimeFormat("hu", {numeric: "auto"});
    if (diffInSeconds < 60) return rtf.format(-diffInSeconds, "second");
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return rtf.format(-diffInMinutes, "minute");
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return rtf.format(-diffInHours, "hour");
    const diffInDays = Math.floor(diffInHours / 24);
    return rtf.format(-diffInDays, "day");
  } catch (e) {
    return past.toLocaleString("hu-HU");
  }
}

const HighlightText = ({text, highlight}: { text: string; highlight: string }) => {
  if (!highlight) return <>{text}</>;
  const escapedHighlight = highlight.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
  const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-500/40 text-white px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

// --- Formázott Input ---
interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
}

function FormattedNumberInput({ value, onValueChange, min = 0, max = Infinity, className, ...props }: FormattedNumberInputProps) {
  const [displayValue, setDisplayValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDisplayValue(value > 0 ? value.toLocaleString("hu-HU") : "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\s/g, "").replace(/\D/g, "");
    if (rawValue === "") {
      setDisplayValue("");
      onValueChange(0);
      return;
    }
    const numValue = parseInt(rawValue, 10);
    setDisplayValue(numValue.toLocaleString("hu-HU"));
    onValueChange(numValue);
  };

  const handleBlur = () => {
    let numValue = parseInt(displayValue.replace(/\s/g, ""), 10);
    if (isNaN(numValue)) numValue = 0;
    let validated = numValue;
    if (validated < min) validated = min;
    if (validated > max) validated = max;
    setDisplayValue(validated > 0 ? validated.toLocaleString("hu-HU") : "");
    onValueChange(validated);
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn("font-mono text-right", className)}
      placeholder="0"
      {...props}
    />
  );
}

// --- Modálisok ---
function SaveTemplateDialog({open, onOpenChange, onSave}: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (n: string) => void }) {
  const [name, setName] = React.useState("");
  const handleSave = () => { onSave(name); setName(""); onOpenChange(false); };
  React.useEffect(() => { if (open) setName(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mentés sablonként</DialogTitle>
          <DialogDescription>A sablon menti a jelenlegi kosarat és a beállított összegeket is.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="templateName" className="text-sm font-medium">Sablon neve</label>
          <Input id="templateName" placeholder="pl. Alap közúti menekülés" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950 border-slate-700" />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Mégse</Button></DialogClose>
          <Button onClick={handleSave} disabled={!name.trim()} className="bg-yellow-600 text-black hover:bg-yellow-700"><Save className="w-4 h-4 mr-2"/> Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryModal({isDesktop, open, onOpenChange, history, loadFromHistory}: { isDesktop: boolean; open: boolean; onOpenChange: (o: boolean) => void; history: HistorySnapshot[]; loadFromHistory: (s: HistorySnapshot) => void }) {
  const content = (
    <>
      {history.length === 0 ? (
        <p className="text-slate-400 text-center py-4">Nincsenek mentett előzmények.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto p-1 pr-2 scrollbar-hide">
          {history.map((item) => (
            <div key={item.timestamp} className="flex justify-between items-center p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors group">
              <div className="overflow-hidden mr-2">
                <p className="font-medium text-slate-200">{formatCurrency(item.finalFine)} / {item.finalJail} perc</p>
                <p className="text-xs text-slate-400 truncate" title={item.reasons}>{item.reasons || "(Nincs ok)"}</p>
                <p className="text-[10px] text-slate-500 mt-1">{getRelativeTime(item.timestamp)}</p>
              </div>
              <Button onClick={() => loadFromHistory(item)} size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">Betöltés</Button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Intézkedés Előzmények</DialogTitle>
            <DialogDescription>Az utolsó 10 mentett intézkedés.</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }
  return null;
}

function TemplateModal({isDesktop, open, onOpenChange, templates, loadFromTemplate, deleteTemplate}: { isDesktop: boolean; open: boolean; onOpenChange: (o: boolean) => void; templates: Template[]; loadFromTemplate: (t: Template) => void; deleteTemplate: (id: string) => void }) {
  const content = (
    <>
      {templates.length === 0 ? (
        <p className="text-slate-400 text-center py-4">Nincsenek mentett sablonjaid.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto p-1 pr-2 scrollbar-hide">
          {templates.map((template) => (
            <div key={template.id} className="flex justify-between items-center p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors group">
              <div>
                <p className="font-medium text-slate-200">{template.name}</p>
                <p className="text-xs text-slate-400">
                  {template.cart.length} tétel {template.savedFine > 0 && <span className="text-slate-500">| {formatCurrency(template.savedFine)}</span>}
                </p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => deleteTemplate(template.id)}><Trash2 className="w-4 h-4"/></Button>
                <Button onClick={() => loadFromTemplate(template)} size="sm" variant="secondary" className="h-8">Hozzáadás</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mentett Sablonok</DialogTitle>
            <DialogDescription>Gyakori intézkedés-kombinációk.</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }
  return null;
}

// --- FŐ KOMPONENS ---
export function CalculatorPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFavoritesView, setIsFavoritesView] = React.useState(false);
  const [isCategorySidebarVisible, setIsCategorySidebarVisible] = useLocalStorage<boolean>("sfsd_cat_sidebar_v4", true);

  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [favorites, setFavorites] = useLocalStorage<string[]>("sfsd_favorites", []);
  const [history, setHistory] = useLocalStorage<HistorySnapshot[]>("sfsd_history", []);
  const [templates, setTemplates] = useLocalStorage<Template[]>("sfsd_templates", []);

  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = React.useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  const [summary, setSummary] = React.useState<Summary>({
    minFine: 0, maxFine: 0, minJail: 0, maxJail: 0, specialJailNotes: [], warningItems: [],
  });

  const [selectedFine, setSelectedFine] = React.useState(0);
  const [selectedJail, setSelectedJail] = React.useState(0);
  const [targetId, setTargetId] = React.useState("");
  const [arrestOutput, setArrestOutput] = React.useState("");
  const [ticketReasons, setTicketReasons] = React.useState("");

  const [isArrestCopied, setIsArrestCopied] = React.useState(false);
  const [isReasonsCopied, setIsReasonsCopied] = React.useState(false);
  const [isFineCopied, setIsFineCopied] = React.useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const MAX_HISTORY_ITEMS = 10;

  const { user, supabase } = useAuth();

  // SPAM VÉDELEM: Utolsó logolt akció tárolása
  const lastLogRef = React.useRef<{type: string, details: string, time: number} | null>(null);

  // --- Logoló Segédfüggvény (60mp Spam védelemmel) ---
  const logActionToDb = async (type: 'ticket' | 'arrest', details: string) => {
    if (!user) return;

    const now = Date.now();
    // 60 másodperces védelem (10000 helyett 60000)
    if (lastLogRef.current &&
      lastLogRef.current.type === type &&
      lastLogRef.current.details === details &&
      (now - lastLogRef.current.time) < 75000) {
      console.log("Spam prevention: duplicate log ignored.");
      return;
    }

    lastLogRef.current = { type, details, time: now };

    supabase.from('action_logs').insert({
      user_id: user.id,
      action_type: type,
      details: details
    }).then(({ error }) => {
      if (error) console.error("Log error:", error);
    });
  };

  // --- Logika ---
  const addToCart = (itemId: string) => {
    const existing = cart.find((c) => c.item.id === itemId);
    if (existing) {
      setCart(cart.map((c) => c.item.id === itemId ? {...c, quantity: c.quantity + 1} : c));
    } else {
      const itemToAdd = ALL_ITEMS_MAP.get(itemId);
      if (itemToAdd) setCart([...cart, {item: itemToAdd, quantity: 1}]);
    }
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    const existing = cart.find((c) => c.item.id === itemId);
    if (!existing) return;
    const newQuantity = existing.quantity + change;
    if (newQuantity <= 0) setCart(cart.filter((c) => c.item.id !== itemId));
    else setCart(cart.map((c) => c.item.id === itemId ? {...c, quantity: newQuantity} : c));
  };

  const clearCart = () => {
    setCart([]); setSelectedFine(0); setSelectedJail(0); setTargetId("");
  };

  const toggleFavorite = (itemId: string) => {
    if (favorites.includes(itemId)) setFavorites(favorites.filter((id) => id !== itemId));
    else setFavorites([...favorites, itemId]);
  };

  // --- Szűrés és Keresés ---
  const filteredKategorias = React.useMemo(() => {
    let kategorias: KategoriaData[] = JSON.parse(JSON.stringify(ALL_KATEGORIA_GROUPS));

    if (isFavoritesView) {
      kategorias = kategorias.map((kat) => {
        const filteredItems = kat.items.map((itemOrGroup) => {
          if ("alpontok" in itemOrGroup) {
            const matchingAlpontok = itemOrGroup.alpontok.filter((item) => favorites.includes(item.id));
            if (matchingAlpontok.length > 0) return {...itemOrGroup, alpontok: matchingAlpontok, _matchType: "children" as const};
            return null;
          } else {
            return favorites.includes(itemOrGroup.id) ? itemOrGroup : null;
          }
        }).filter(Boolean) as (PenalCodeItem | FilteredPenalCodeGroup)[];
        return {...kat, items: filteredItems};
      }).filter((kat) => kat.items.length > 0);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const checkMatch = (text: string) => text.toLowerCase().includes(lowerSearch);
      const checkItem = (item: PenalCodeItem) => checkMatch(item.megnevezes) || checkMatch(item.rovidites) || checkMatch(item.paragrafus) || checkMatch(item.megjegyzes);

      kategorias = kategorias.map((kat) => {
        const filteredItems = kat.items.map((itemOrGroup) => {
          if ("alpontok" in itemOrGroup) {
            const groupMatch = checkMatch(itemOrGroup.megnevezes) || checkMatch(itemOrGroup.paragrafus) || checkMatch(itemOrGroup.megjegyzes);
            const matchingAlpontok = itemOrGroup.alpontok.filter(checkItem);

            if (matchingAlpontok.length > 0) {
              return {...itemOrGroup, alpontok: matchingAlpontok, _matchType: "children" as const};
            }
            if (groupMatch) {
              return {...itemOrGroup, _matchType: "group" as const};
            }
            return null;
          } else {
            return checkItem(itemOrGroup) ? itemOrGroup : null;
          }
        }).filter(Boolean) as (PenalCodeItem | FilteredPenalCodeGroup)[];
        return {...kat, items: filteredItems};
      }).filter((kat) => kat.items.length > 0);
    }
    return kategorias as FilteredKategoriaData[];
  }, [searchTerm, isFavoritesView, favorites]);

  const [openCategories, setOpenCategories] = React.useState<string[]>([]);
  const [openSubCategories, setOpenSubCategories] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (searchTerm) {
      setOpenCategories(filteredKategorias.map((k) => k.kategoria_nev));
      const subCatsToOpen: string[] = [];
      filteredKategorias.forEach(kat => {
        kat.items.forEach(item => {
          if ("alpontok" in item && item._matchType === "children") {
            subCatsToOpen.push(item.id);
          }
        });
      });
      setOpenSubCategories(subCatsToOpen);
    } else {
      if (openCategories.length !== 1) setOpenCategories([]);
      setOpenSubCategories([]);
    }
  }, [searchTerm, filteredKategorias]);

  const handleCategoryJump = (categoryName: string) => {
    setOpenCategories([categoryName]);
    setSearchTerm("");
    setTimeout(() => {
      const element = document.getElementById(`category-item-${categoryName.replace(/\s/g, "-")}`);
      if (element) {
        const headerOffset = 160;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      }
    }, 100);
  };

  // --- Összesítés és Parancsok ---
  React.useEffect(() => {
    let minFine = 0, maxFine = 0, minJail = 0, maxJail = 0;
    const specialJailNotes: string[] = [];
    const warningItems: PenalCodeItem[] = [];

    const parseSpecialValue = (value: string | number | null | undefined, type: "jail" | "fine", item: PenalCodeItem, quantity: number) => {
      if (typeof value === "number") return value;
      if (typeof value !== "string") return null;
      const trimmedValue = value.trim();
      if (trimmedValue.startsWith("+") && trimmedValue.endsWith("perc")) {
        const amount = parseInt(trimmedValue.substring(1).replace("perc", "").trim(), 10);
        if (!isNaN(amount)) {
          const totalAmount = amount * quantity;
          if (type === "jail") {
            minJail += totalAmount; maxJail += totalAmount;
            const note = `${item.megnevezes}: ${trimmedValue} (x${quantity})`;
            if (!specialJailNotes.includes(note)) specialJailNotes.push(note);
            return null;
          }
        }
      }
      const note = `${item.megnevezes}: ${trimmedValue} (x${quantity})`;
      if (!specialJailNotes.includes(note)) specialJailNotes.push(note);
      return null;
    };

    cart.forEach(({item, quantity}) => {
      if (item.isWarning && !warningItems.find(w => w.id === item.id)) warningItems.push(item);
      const minB = parseSpecialValue(item.min_birsag, "fine", item, quantity);
      const maxB = parseSpecialValue(item.max_birsag, "fine", item, quantity);
      if (typeof minB === "number") minFine += minB * quantity;
      if (typeof maxB === "number") maxFine += maxB * quantity;
      const minJ = parseSpecialValue(item.min_fegyhaz, "jail", item, quantity);
      const maxJ = parseSpecialValue(item.max_fegyhaz, "jail", item, quantity);
      if (typeof minJ === "number") minJail += minJ * quantity;
      if (typeof maxJ === "number") maxJail += maxJ * quantity;
    });

    const newSummary = { minFine, maxFine, minJail, maxJail, specialJailNotes, warningItems };
    setSummary(newSummary);

    if (cart.length === 0) {
      setSelectedFine(0); setSelectedJail(0);
    } else {
      setSelectedFine((curr) => {
        if (curr === 0) return newSummary.maxFine;
        return Math.max(newSummary.minFine, curr);
      });
      setSelectedJail((curr) => {
        if (curr === 0) return newSummary.maxJail;
        return Math.max(newSummary.minJail, curr);
      });
    }
  }, [cart]);

  React.useEffect(() => {
    const idPlaceholder = targetId.trim() === "" ? "[ID]" : targetId.trim();
    if (cart.length === 0) { setArrestOutput(""); setTicketReasons(""); return; }

    const allReasons = cart.map(({item, quantity}) => `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`).join(", ");
    setTicketReasons(allReasons);

    const arrestCartItems = cart.filter(({item}) =>
      (typeof item.min_fegyhaz === "number" && item.min_fegyhaz > 0) ||
      (typeof item.max_fegyhaz === "number" && item.max_fegyhaz > 0) ||
      (typeof item.min_fegyhaz === "string" && item.min_fegyhaz.startsWith("+")) ||
      (typeof item.max_fegyhaz === "string" && item.max_fegyhaz.startsWith("+")));

    const arrestReasons = arrestCartItems.map(({item, quantity}) => `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`).join(", ");

    let arrestCmd = "";
    const validJail = Math.min(selectedJail, summary.maxJail > 0 ? summary.maxJail : Infinity);
    if (validJail > 0 && arrestCartItems.length > 0) {
      arrestCmd = `arrest ${idPlaceholder} ${validJail} ${arrestReasons}`;
    }
    setArrestOutput(arrestCmd);
  }, [cart, selectedFine, selectedJail, targetId, summary.maxJail]);

  const saveToHistory = () => {
    if (cart.length === 0) return;
    const validFine = Math.min(selectedFine, summary.maxFine > 0 ? summary.maxFine : Infinity);
    const validJail = Math.min(selectedJail, summary.maxJail > 0 ? summary.maxJail : Infinity);
    const snapshot: HistorySnapshot = {
      cart: JSON.parse(JSON.stringify(cart)), finalFine: validFine, finalJail: validJail, reasons: ticketReasons, timestamp: new Date().toISOString(),
    };
    const isDuplicate = history.length > 0 && history[0].reasons === snapshot.reasons && history[0].finalFine === snapshot.finalFine && history[0].finalJail === snapshot.finalJail;
    if (!isDuplicate) {
      setHistory([snapshot, ...history].slice(0, MAX_HISTORY_ITEMS));
    }
  };

  const copyArrest = () => {
    if (!arrestOutput) { toast.error("Nincs mit másolni"); return; }
    navigator.clipboard.writeText(arrestOutput);
    toast.success("✅ arrest parancs másolva!");
    saveToHistory();
    setIsArrestCopied(true);
    setTimeout(() => setIsArrestCopied(false), 2000);

    logActionToDb('arrest', `${summary.minJail} perc - Indokok: ${ticketReasons}`);
  };

  const copyReasons = () => {
    if (!ticketReasons) { toast.error("Nincs mit másolni"); return; }
    navigator.clipboard.writeText(ticketReasons);
    toast.success("✅ Indokok másolva!");

    // JAVÍTÁS: Egyesített logolás (Összeg + Indok)
    const validFine = Math.min(selectedFine, summary.maxFine > 0 ? summary.maxFine : Infinity);
    logActionToDb('ticket', `Bírság: ${formatCurrency(validFine)} - Indok: ${ticketReasons}`);

    saveToHistory(); setIsReasonsCopied(true); setTimeout(() => setIsReasonsCopied(false), 2000);
  };

  const copyFineAmount = () => {
    if (cart.length === 0) { toast.error("Nincs összeg."); return; }
    const validFine = Math.min(selectedFine, summary.maxFine > 0 ? summary.maxFine : Infinity);
    navigator.clipboard.writeText(validFine.toString());
    toast.success("✅ Bírság összege másolva!");

    // JAVÍTÁS: Egyesített logolás (Összeg + Indok)
    logActionToDb('ticket', `Bírság: ${formatCurrency(validFine)} - Indok: ${ticketReasons}`);

    saveToHistory(); setIsFineCopied(true); setTimeout(() => setIsFineCopied(false), 2000);
  };

  const copyTicketCmd = () => {
    navigator.clipboard.writeText("/ticket");
    toast.success("✅ /ticket parancs másolva!");
  }

  const loadFromHistory = (snapshot: HistorySnapshot) => {
    setCart(snapshot.cart); setSelectedFine(snapshot.finalFine); setSelectedJail(snapshot.finalJail);
    setIsHistoryOpen(false); setIsMobileDrawerOpen(false); toast.info("Előzmény betöltve.");
  };

  const handleSaveTemplate = (name: string) => {
    if (cart.length === 0) { toast.error("Üres jegyzőkönyvet nem menthetsz."); return; }
    setTemplates([...templates, { id: `template-${Date.now()}`, name, cart: JSON.parse(JSON.stringify(cart)), savedFine: selectedFine, savedJail: selectedJail }]);
    toast.success("Sablon mentve!");
  };

  const loadFromTemplate = (template: Template) => {
    setCart(currentCart => {
      const newCart = [...currentCart];
      template.cart.forEach(templateItem => {
        const existingIndex = newCart.findIndex(cartItem => cartItem.item.id === templateItem.item.id);
        if (existingIndex !== -1) newCart[existingIndex] = { ...newCart[existingIndex], quantity: newCart[existingIndex].quantity + templateItem.quantity };
        else newCart.push(templateItem);
      });
      return newCart;
    });
    if (template.savedFine > 0) setSelectedFine(template.savedFine);
    if (template.savedJail > 0) setSelectedJail(template.savedJail);
    toast.info("Sablon hozzáadva."); setIsTemplateModalOpen(false); setIsMobileDrawerOpen(false);
  };

  const deleteTemplate = (templateId: string) => {
    setTemplates(templates.filter(t => t.id !== templateId)); toast.success("Sablon törölve.");
  };

  // --- Renderelő Komponensek ---
  const PenalCodeItemCard = ({item}: { item: PenalCodeItem }) => {
    const isInCart = cart.some((c) => c.item.id === item.id);
    const isFavorite = favorites.includes(item.id);

    return (
      <div className={cn(
        "p-3 rounded-md border transition-all duration-200 group relative overflow-hidden",
        isInCart ? (item.isWarning ? "bg-amber-950/20 border-amber-900/50" : "bg-blue-950/20 border-blue-900/50")
          : "bg-slate-900/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/60"
      )}>
        {isInCart && <div className={cn("absolute left-0 top-0 bottom-0 w-1", item.isWarning ? "bg-amber-600" : "bg-blue-600")} />}

        <div className="flex justify-between items-start gap-3 pl-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col mb-1">
              {item.fo_tetel_nev && (
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-0.5 flex items-center gap-1">
                  {item.fo_tetel_paragrafus && <span className="text-slate-600"><HighlightText text={item.fo_tetel_paragrafus} highlight={searchTerm}/></span>}
                  <HighlightText text={item.fo_tetel_nev} highlight={searchTerm}/>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="font-mono text-yellow-500 font-bold text-sm shrink-0 mt-0.5"><HighlightText text={item.paragrafus} highlight={searchTerm}/></span>
                <h3 className="font-bold text-slate-100 text-base leading-tight break-words"><HighlightText text={item.megnevezes} highlight={searchTerm}/></h3>
                {item.isWarning && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse mt-0.5"/>}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-300 mt-1.5">
              {(item.min_birsag || item.max_birsag) && (
                <span className="flex items-center gap-1.5 bg-slate-950/50 px-1.5 py-0.5 rounded text-xs border border-slate-800"><DollarSign className="w-3 h-3 text-green-500"/> {formatCurrency(item.min_birsag)} - {formatCurrency(item.max_birsag)}</span>
              )}
              {(item.min_fegyhaz || item.max_fegyhaz) && (
                <span className="flex items-center gap-1.5 bg-slate-950/50 px-1.5 py-0.5 rounded text-xs border border-slate-800"><Target className="w-3 h-3 text-red-500"/> {formatJailTime(item.min_fegyhaz)} - {formatJailTime(item.max_fegyhaz)}</span>
              )}
            </div>
            {item.megjegyzes && <p className="text-xs text-slate-500 mt-2 italic truncate max-w-[90%]"><HighlightText text={item.megjegyzes} highlight={searchTerm}/></p>}
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant={isInCart ? "secondary" : "ghost"}
              onClick={() => addToCart(item.id)}
              className={cn(
                "h-8 w-24 text-xs font-medium transition-all border",
                isInCart
                  ? "bg-blue-600/20 text-blue-200 border-blue-500/30 hover:bg-blue-600/30"
                  : "border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600"
              )}
            >
              {isInCart ? "Hozzáadva" : "Hozzáad"}
            </Button>
            <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-full", isFavorite ? "text-yellow-400" : "text-slate-700 hover:text-yellow-500 hover:bg-slate-800")} onClick={() => toggleFavorite(item.id)}>
              <Star className={cn("w-4 h-4", isFavorite && "fill-yellow-400")}/>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderItemList = () => {
    if (filteredKategorias.length === 0) {
      return <div className="text-center text-slate-500 py-12"><Search className="mx-auto h-12 w-12 mb-4 opacity-20"/><p className="text-lg font-medium">Nincs találat a keresésre.</p></div>;
    }

    return (
      <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
        {filteredKategorias.map((kategoria) => (
          <AccordionItem value={kategoria.kategoria_nev} key={kategoria.kategoria_nev} id={`category-item-${kategoria.kategoria_nev.replace(/\s/g, "-")}`} className="border-none bg-slate-900/20 rounded-xl border border-slate-800/50 overflow-hidden shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-slate-800/40 transition-colors group text-left">
              <span className="text-lg font-semibold text-slate-200 group-hover:text-white transition-colors break-words leading-snug">{kategoria.kategoria_nev}</span>
            </AccordionTrigger>
            <AccordionContent className="pt-0 pb-3 px-3 bg-slate-950/30">
              <div className="grid grid-cols-1 gap-2 pt-3">
                {kategoria.items.map((itemOrGroup) => "alpontok" in itemOrGroup ? (
                  <Accordion
                    type="multiple"
                    key={itemOrGroup.id}
                    value={openSubCategories.includes(itemOrGroup.id) ? [itemOrGroup.id] : []}
                    onValueChange={(val) => {
                      if (val.length > 0) setOpenSubCategories([...openSubCategories, itemOrGroup.id]);
                      else setOpenSubCategories(openSubCategories.filter(id => id !== itemOrGroup.id));
                    }}
                    className="w-full"
                  >
                    <AccordionItem value={itemOrGroup.id} className="border border-slate-800/60 bg-slate-900/40 rounded-lg mb-2 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 hover:no-underline transition-colors text-left">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="text-yellow-600 border-yellow-900/20 font-mono bg-yellow-500/5 px-2 py-0.5 mt-0.5">{itemOrGroup.paragrafus}</Badge>
                          <span className="text-base break-words leading-snug"><HighlightText text={itemOrGroup.megnevezes} highlight={searchTerm}/></span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1 space-y-2 bg-black/20 border-t border-slate-800/30">
                        {itemOrGroup.alpontok.map(sub => <PenalCodeItemCard key={sub.id} item={sub}/>)}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  <PenalCodeItemCard key={itemOrGroup.id} item={itemOrGroup}/>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderRightSidebar = () => {
    const licenseWarnings = summary.warningItems.filter(i => i.warningType.includes("license"));
    const firearmWarnings = summary.warningItems.filter(i => i.warningType.includes("firearm"));

    return (
      <div className="space-y-6 pr-3">
        {/* JEGYZŐKÖNYV (Változatlan, csak hivatkozom rá) */}
        <Card className="bg-slate-900/80 border-slate-700/50 shadow-xl backdrop-blur-sm flex flex-col max-h-[45vh]">
          <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-800/60 bg-slate-900/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-400"/>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300">Jegyzőkönyv</CardTitle>
              </div>
              {cart.length > 0 && <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{cart.reduce((acc, i) => acc + i.quantity, 0)} tétel</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-hide min-h-0 bg-slate-950/30">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <ClipboardList className="w-12 h-12 mb-3 opacity-10"/>
                <span className="text-xs font-medium">A jegyzőkönyv jelenleg üres.</span>
                <span className="text-[10px] text-slate-700 mt-1">Adj hozzá tételeket a listából.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/40">
                {cart.map(({item, quantity}) => (
                  <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-800/30 transition-colors group">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5 tracking-tight">
                        {item.fo_tetel_nev || item.kategoria_nev}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-200 truncate leading-tight">{item.megnevezes}</span>
                        {item.isWarning && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0"/>}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                        <span>${formatCurrency(item.min_birsag)}</span>
                        <span className="text-slate-600">|</span>
                        <span>{item.min_fegyhaz} p</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-900 rounded border border-slate-700 h-7">
                        <button className="px-2 hover:bg-slate-800 text-slate-400 h-full transition-colors" onClick={() => updateCartQuantity(item.id, -1)}>-</button>
                        <span className="text-xs font-mono font-bold w-6 text-center text-white border-x border-slate-800 h-full flex items-center justify-center bg-slate-800/50">{quantity}</span>
                        <button className="px-2 hover:bg-slate-800 text-slate-400 h-full transition-colors" onClick={() => updateCartQuantity(item.id, 1)}>+</button>
                      </div>
                      <button className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors" onClick={() => updateCartQuantity(item.id, -quantity)}>
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {cart.length > 0 && (
            <div className="p-2 border-t border-slate-800/60 bg-slate-900/80 flex gap-2 backdrop-blur-md">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-slate-700 hover:bg-slate-800" onClick={() => setIsSaveTemplateOpen(true)}><Save className="w-3 h-3 mr-1.5"/> Sablon</Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={clearCart}><Trash2 className="w-3 h-3"/></Button>
            </div>
          )}
        </Card>

        {/* 2. ÖSSZESÍTÉS & PARANCSOK */}
        <Card className="bg-slate-900/80 border-slate-700/50 shadow-xl backdrop-blur-sm">
          <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-800/60 bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-yellow-500"/>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300">Kiszabás</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
            {/* Figyelmeztetések (Marad) */}
            {summary.warningItems.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
                <div className="flex items-center gap-2 text-amber-500 mb-2 relative z-10">
                  <AlertTriangle className="w-4 h-4"/>
                  <span className="text-xs font-bold uppercase tracking-wide">Figyelmeztetések</span>
                </div>
                <div className={cn(
                  "text-xs text-amber-200/80 relative z-10",
                  (licenseWarnings.length > 0 && firearmWarnings.length > 0) ? "grid grid-cols-2 gap-3" : "space-y-2"
                )}>
                  {licenseWarnings.length > 0 && (
                    <div className={cn((licenseWarnings.length > 0 && firearmWarnings.length > 0) && "pr-2 border-r border-amber-800/30")}>
                      <strong className="text-amber-100 block mb-1 opacity-90">Közlekedés</strong>
                      <ul className="space-y-0.5">
                        {licenseWarnings.map(i => <li key={i.id} className="pl-2 border-l-2 border-amber-600/50">{i.megnevezes}</li>)}
                      </ul>
                    </div>
                  )}
                  {firearmWarnings.length > 0 && (
                    <div className={cn((licenseWarnings.length > 0 && firearmWarnings.length > 0) && "pl-1")}>
                      <strong className="text-red-100 block mb-1 opacity-90">Fegyverek</strong>
                      <ul className="space-y-0.5">
                        {firearmWarnings.map(i => <li key={i.id} className="pl-2 border-l-2 border-red-600/50">{i.megnevezes}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Csúszkák */}
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Bírság ($)</span>
                  <span className="font-mono text-green-400 bg-green-950/30 px-1.5 rounded border border-green-900/30">{formatCurrency(summary.minFine)} - {formatCurrency(summary.maxFine)}</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Slider
                    className="flex-1"
                    min={summary.minFine} max={summary.maxFine} step={1000}
                    value={[selectedFine]} onValueChange={(v) => setSelectedFine(v[0])}
                    disabled={cart.length === 0 || summary.minFine === summary.maxFine}
                  />
                  <FormattedNumberInput
                    className="w-28 h-9 text-right font-mono text-sm bg-slate-950 border-slate-700 focus-visible:ring-green-500/50"
                    value={selectedFine}
                    onValueChange={setSelectedFine}
                    min={summary.minFine}
                    max={summary.maxFine > 0 ? summary.maxFine : undefined}
                    disabled={cart.length === 0}
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Fegyház (perc)</span>
                  <span className="font-mono text-red-400 bg-red-950/30 px-1.5 rounded border border-red-900/30">{summary.minJail} - {summary.maxJail} p</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Slider
                    className={cn("flex-1", selectedJail >= 60 ? "[&_.bg-primary]:bg-red-600" : "")}
                    min={summary.minJail} max={summary.maxJail} step={1}
                    value={[selectedJail]} onValueChange={(v) => setSelectedJail(v[0])}
                    disabled={cart.length === 0 || summary.minJail === summary.maxJail || summary.maxJail === 0}
                  />
                  <FormattedNumberInput
                    className={cn("w-28 h-9 text-right font-mono text-sm bg-slate-950 border-slate-700", selectedJail >= 60 ? "text-red-400 border-red-900/50 focus-visible:ring-red-500/50" : "")}
                    value={selectedJail}
                    onValueChange={setSelectedJail}
                    min={summary.minJail}
                    max={summary.maxJail > 0 ? summary.maxJail : undefined}
                    disabled={cart.length === 0}
                  />
                </div>
              </div>
            </div>

            {/* --- PARANCSOK (ÁTALAKÍTVA) --- */}
            <div className="space-y-4 pt-4 border-t border-slate-800/60">

              {/* TICKET (Bírság) - Nincs ID input, csak másoló gombok */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ticket (Bírság)</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-slate-500 hover:text-white border border-slate-700" onClick={copyTicketCmd}>
                    /ticket parancs
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-green-900/50 text-xs h-9" onClick={copyFineAmount} disabled={cart.length === 0}>
                    {isFineCopied ? <Check className="w-3 h-3 mr-1.5 text-green-500"/> : <Copy className="w-3 h-3 mr-1.5"/>}
                    Összeg másolása
                  </Button>
                  <Button variant="outline" className="bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-blue-900/50 text-xs h-9" onClick={copyReasons} disabled={!ticketReasons}>
                    {isReasonsCopied ? <Check className="w-3 h-3 mr-1.5 text-green-500"/> : <Copy className="w-3 h-3 mr-1.5"/>}
                    Indoklás másolása
                  </Button>
                </div>
                <Textarea
                  readOnly
                  className="mt-2 h-16 text-[11px] leading-tight font-mono bg-slate-950 border-slate-800 text-slate-400 resize-none focus-visible:ring-0"
                  value={ticketReasons || "Nincsenek indokok."}
                />
              </div>

              {/* ARREST (Letartóztatás) - Ez maradt a régi */}
              <div className={cn("relative group pt-4 border-t border-slate-800/40 transition-opacity duration-300", (!arrestOutput) ? "opacity-50 grayscale" : "opacity-100")}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Arrest (Fegyház)</span>
                  <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-7 w-20 px-2 bg-slate-950 border-slate-700 font-mono text-center text-xs" placeholder="ID"/>
                </div>
                <div className="relative">
                  <Textarea
                    readOnly
                    className="h-20 text-[11px] leading-tight font-mono bg-slate-950 border-slate-800 text-slate-400 resize-none focus-visible:ring-0"
                    value={arrestOutput || "Nincs fegyházbüntetés."}
                  />
                  <div className="absolute top-2 right-2">
                    <Button
                      size="sm"
                      className={cn(
                        "h-7 px-3 text-xs border transition-all shadow-md",
                        isArrestCopied ? "bg-green-900/80 border-green-700 text-green-100" : "bg-red-600 hover:bg-red-500 border-transparent text-white shadow-red-900/20"
                      )}
                      onClick={copyArrest}
                      disabled={!arrestOutput}
                    >
                      {isArrestCopied ? <><Check className="w-3 h-3 mr-1.5"/> Másolva</> : <><Copy className="w-3 h-3 mr-1.5"/> Másolás</>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pb-8 lg:pb-0 pt-4 opacity-60 hover:opacity-100 transition-opacity">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">San Fierro Sheriff's Dept. Intranet v2.0</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Data: <span className="text-slate-500 font-medium">Tetsu</span> • Dev: <span className="text-slate-500 font-medium">Martin Lothbrok</span>
          </p>
        </div>
      </div>
    );
  };

  // --- LAYOUT ---

  return (
    <>
      {/* JAVÍTÁS: Nincs Toaster itt, mert az App.tsx-ben már van! */}

      <SaveTemplateDialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen} onSave={handleSaveTemplate}/>

      {/* FŐ KONTÉNER */}
      <div className="container mx-auto max-w-[1600px] flex flex-col h-full px-4 lg:px-6">
        {/* ... (A layout többi része változatlan) ... */}
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <Gavel className="w-6 h-6 text-yellow-500"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Büntetés Kalkulátor</h1>
              <p className="text-sm text-slate-400 hidden md:block">Válaszd ki a tételeket a listából a kalkulációhoz.</p>
            </div>
          </div>
        </div>

        {/* GRID LAYOUT */}
        <div className={cn(
          "grid gap-8 items-start relative",
          "grid-cols-1 lg:grid-cols-[1fr_400px]",
          isCategorySidebarVisible ? "xl:grid-cols-[280px_1fr_450px]" : "xl:grid-cols-[1fr_460px]"
        )}>

          {/* 1. BAL OSZLOP (Kategóriák) */}
          {isCategorySidebarVisible && (
            <div className="hidden xl:flex flex-col sticky top-6 h-fit max-h-[calc(100vh-3rem)] overflow-y-auto scrollbar-hide bg-slate-900/40 rounded-xl border border-slate-800/50 backdrop-blur-sm transition-all duration-300">
              <div className="p-4 border-b border-slate-800/50 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <ClipboardList className="w-3 h-3"/> Kategóriák
                </h3>
              </div>
              <div className="p-2 space-y-1 flex-1">
                {ALL_KATEGORIA_NAMES.map((name) => (
                  <Button
                    key={name}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left h-auto py-2.5 px-3 text-sm font-normal transition-all duration-200 border border-transparent break-words whitespace-normal leading-snug",
                      openCategories.includes(name)
                        ? "bg-slate-800/80 text-white border-slate-700/50 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    )}
                    onClick={() => handleCategoryJump(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 2. KÖZÉPSŐ OSZLOP (Lista) */}
          <div className="min-w-0 flex flex-col gap-6 pb-20 lg:pb-0 w-full">
            {/* LEBEGŐ KERESŐ (Glassmorphism) */}
            <div className="sticky top-4 z-30 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md shadow-2xl flex items-center gap-2 p-2 transition-all duration-300 hover:bg-slate-950/90 hover:border-white/20">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
                <Input
                  placeholder="Keresés (név, paragrafus)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 pl-10 bg-transparent border-none focus-visible:ring-0 placeholder:text-slate-500 text-slate-200"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </div>
              <div className="w-px h-6 bg-white/10 mx-1"/>
              <div className="flex items-center gap-1 pr-2">
                <Button size="icon" variant={isFavoritesView ? "secondary" : "ghost"} onClick={() => setIsFavoritesView(!isFavoritesView)} className={cn("h-9 w-9 rounded-lg transition-colors", isFavoritesView && "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20")} title="Kedvencek"><Star className={cn("w-4 h-4", isFavoritesView && "fill-yellow-500")}/></Button>
                <HistoryModal isDesktop={isDesktop} open={isHistoryOpen} onOpenChange={setIsHistoryOpen} history={history} loadFromHistory={loadFromHistory} />
                <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-white rounded-lg hover:bg-white/5" onClick={() => setIsHistoryOpen(true)} title="Előzmények"><History className="w-4 h-4"/></Button>
                <TemplateModal isDesktop={isDesktop} open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen} templates={templates} loadFromTemplate={loadFromTemplate} deleteTemplate={deleteTemplate} />
                <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-white rounded-lg hover:bg-white/5" onClick={() => setIsTemplateModalOpen(true)} title="Sablonok"><ClipboardCheck className="w-4 h-4"/></Button>
                <div className="hidden xl:block w-px h-6 bg-white/10 mx-1"/>
                <Button size="icon" variant="ghost" className="hidden xl:flex h-9 w-9 text-slate-400 hover:text-white rounded-lg hover:bg-white/5" onClick={() => setIsCategorySidebarVisible(!isCategorySidebarVisible)} title={isCategorySidebarVisible ? "Kategóriák elrejtése" : "Kategóriák megjelenítése"}>
                  {isCategorySidebarVisible ? <PanelLeftClose className="w-4 h-4"/> : <PanelLeftOpen className="w-4 h-4"/>}
                </Button>
              </div>
            </div>

            {/* LISTA TARTALOM */}
            <div className="space-y-4">
              {renderItemList()}
            </div>
          </div>

          {/* 3. JOBB OSZLOP (Sticky Calculator) */}
          <div className="hidden lg:flex flex-col sticky top-6 h-[calc(100vh-2rem)] pl-2">
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide pb-10">
              {renderRightSidebar()}
            </div>
          </div>

        </div>
      </div>

      {/* MOBIL DRAWER */}
      {!isDesktop && (
        <Drawer open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
          <DrawerTrigger asChild>
            <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 bg-yellow-500 text-black hover:bg-yellow-400 border-4 border-slate-950 transition-transform active:scale-95">
              <ClipboardList className="w-6 h-6"/>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white border-2 border-slate-950 animate-in zoom-in">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-slate-950 border-t border-slate-800 max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-800 mt-3 mb-4 opacity-50" />
            <div className="flex-1 overflow-y-auto px-4 pb-8 scrollbar-hide">
              {renderRightSidebar()}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}