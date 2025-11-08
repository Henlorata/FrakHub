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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {Slider} from "@/components/ui/slider";
import {Textarea} from "@/components/ui/textarea";
import {Toaster} from "@/components/ui/sonner";
import {toast} from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ClipboardList,
  Copy,
  History,
  Package,
  Search,
  Star,
  X,
  DollarSign,
  Car,
  Target,
  ClipboardCheck,
  Save,
  Trash2,
} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {cn} from "@/lib/utils";

// --- Típusdefiníciók ---
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

// --- Adatok betöltése ---
const ALL_KATEGORIA_GROUPS = prepareData();
const ALL_KATEGORIA_NAMES = ALL_KATEGORIA_GROUPS.map(k => k.kategoria_nev);
const ALL_ITEMS_MAP = new Map<string, PenalCodeItem>();
ALL_KATEGORIA_GROUPS.forEach((kat) => {
  kat.items.forEach((itemOrGroup) => {
    if ("alpontok" in itemOrGroup) {
      itemOrGroup.alpontok.forEach((item) => {
        ALL_ITEMS_MAP.set(item.id, item);
      });
    } else {
      ALL_ITEMS_MAP.set(itemOrGroup.id, itemOrGroup);
    }
  });
});

// --- Hook a LocalStorage-hoz ---
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

// --- Segédfüggvény (Előzményekhez) ---
function getRelativeTime(timestamp: string) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  try {
    const rtf = new Intl.RelativeTimeFormat("hu", {numeric: "auto"});

    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, "second");
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return rtf.format(-diffInMinutes, "minute");
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return rtf.format(-diffInHours, "hour");
    }
    const diffInDays = Math.floor(diffInHours / 24);
    return rtf.format(-diffInDays, "day");
  } catch (e) {
    console.error("RelativeTimeFormat hiba:", e);
    return past.toLocaleString("hu-HU");
  }
}

// --- Kiemelő komponens ---
const HighlightText = ({text, highlight}: { text: string; highlight: string }) => {
  if (!highlight) {
    return <>{text}</>;
  }
  const escapedHighlight = highlight.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
  const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400 text-black px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};


// 1. Sablon Mentése Ablak
interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}

function SaveTemplateDialog({open, onOpenChange, onSave}: SaveTemplateDialogProps) {
  const [name, setName] = React.useState("");

  const handleSave = () => {
    onSave(name);
    setName("");
    onOpenChange(false);
  };

  React.useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mentés sablonként</DialogTitle>
          <DialogDescription>
            Adj egy nevet ennek a jegyzőkönyv-kombinációnak.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="templateName" className="text-sm font-medium">Sablon neve</label>
          <Input
            id="templateName"
            placeholder="pl. Alap közúti menekülés"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Mégse</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="w-4 h-4 mr-2"/> Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 2. Előzmények Ablak
interface HistoryModalProps {
  isDesktop: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistorySnapshot[];
  loadFromHistory: (snapshot: HistorySnapshot) => void;
}

function HistoryModal({isDesktop, open, onOpenChange, history, loadFromHistory}: HistoryModalProps) {
  const content = (
    <>
      {history.length === 0 ? (
        <p className="text-slate-400 text-center py-4">
          Nincsenek mentett előzmények.
        </p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
          {history.map((item) => (
            <div
              key={item.timestamp}
              className="flex justify-between items-center p-3 bg-slate-800 rounded-lg"
            >
              <div>
                <p className="font-medium">
                  {formatCurrency(item.finalFine)} / {item.finalJail} perc
                </p>
                <p
                  className="text-sm text-slate-400 truncate max-w-xs"
                  title={item.reasons}
                >
                  {item.reasons || "(Nincs ok)"}
                </p>
                <p className="text-xs text-slate-500">
                  {getRelativeTime(item.timestamp)}
                </p>
              </div>
              <Button onClick={() => loadFromHistory(item)}>Betöltés</Button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Előzmények">
            <History className="w-5 h-5"/>
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-md"
          aria-describedby="history-dialog-description"
        >
          <DialogHeader>
            <DialogTitle>Intézkedés Előzmények</DialogTitle>
            <DialogDescription id="history-dialog-description">
              Az utolsó 10 mentett intézkedés.
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Bezárás</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobil nézet
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full">
          <History className="w-4 h-4 mr-2"/> Előzmények
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="max-h-[90vh]"
        aria-describedby="history-drawer-description"
      >
        <DrawerHeader>
          <DialogTitle>Intézkedés Előzmények</DialogTitle>
          <DialogDescription id="history-drawer-description">
            Az utolsó 10 mentett intézkedés.
          </DialogDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4">{content}</div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Bezárás</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}


// 3. Sablonok Ablak
interface TemplateModalProps {
  isDesktop: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  loadFromTemplate: (template: Template) => void;
  deleteTemplate: (templateId: string) => void;
}

function TemplateModal({
                         isDesktop,
                         open,
                         onOpenChange,
                         templates,
                         loadFromTemplate,
                         deleteTemplate
                       }: TemplateModalProps) {
  const content = (
    <>
      {templates.length === 0 ? (
        <p className="text-slate-400 text-center py-4">
          Nincsenek mentett sablonjaid.
        </p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex justify-between items-center p-3 bg-slate-800 rounded-lg"
            >
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-sm text-slate-400">
                  {template.cart.length} tétel
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="icon" title="Sablon törlése"
                        onClick={() => deleteTemplate(template.id)}>
                  <Trash2 className="w-4 h-4"/>
                </Button>
                <Button onClick={() => loadFromTemplate(template)}>Hozzáadás</Button>
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
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Sablonok">
            <ClipboardCheck className="w-5 h-5"/>
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-md"
          aria-describedby="template-dialog-description"
        >
          <DialogHeader>
            <DialogTitle>Mentett Sablonok</DialogTitle>
            <DialogDescription id="template-dialog-description">
              Gyakori intézkedés-kombinációk hozzáadása a jegyzőkönyvhöz.
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Bezárás</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobil nézet
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full">
          <ClipboardCheck className="w-4 h-4 mr-2"/> Sablonok
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="max-h-[90vh]"
        aria-describedby="template-drawer-description"
      >
        <DrawerHeader>
          <DialogTitle>Mentett Sablonok</DialogTitle>
          <DialogDescription id="template-drawer-description">
            Gyakori intézkedés-kombinációk hozzáadása a jegyzőkönyvhöz.
          </DialogDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4">{content}</div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Bezárás</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}


// --- A FŐ KOMPONENS ---
export function PenalCodePage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFavoritesView, setIsFavoritesView] = React.useState(false);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [favorites, setFavorites] = useLocalStorage<string[]>(
    "frakhub_favorites",
    [],
  );
  const [history, setHistory] = useLocalStorage<HistorySnapshot[]>(
    "frakhub_history",
    [],
  );
  const MAX_HISTORY_ITEMS = 10;

  const [templates, setTemplates] = useLocalStorage<Template[]>(
    "frakhub_templates",
    [],
  );
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = React.useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);

  const [summary, setSummary] = React.useState<Summary>({
    minFine: 0,
    maxFine: 0,
    minJail: 0,
    maxJail: 0,
    specialJailNotes: [],
    warningItems: [],
  });

  const [selectedFine, setSelectedFine] = React.useState(0);
  const [selectedJail, setSelectedJail] = React.useState(0);
  const [targetId, setTargetId] = React.useState("");

  const [arrestOutput, setArrestOutput] = React.useState("");
  const [ticketReasons, setTicketReasons] = React.useState("");

  const [isArrestCopied, setIsArrestCopied] = React.useState(false);
  const [isReasonsCopied, setIsReasonsCopied] = React.useState(false);
  const [isFineCopied, setIsFineCopied] = React.useState(false);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  useMediaQuery("(min-width: 1280px)");


  // --- Logika ---
  const addToCart = (itemId: string) => {
    const existing = cart.find((c) => c.item.id === itemId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.item.id === itemId ? {...c, quantity: c.quantity + 1} : c,
        ),
      );
    } else {
      const itemToAdd = ALL_ITEMS_MAP.get(itemId);
      if (itemToAdd) {
        setCart([...cart, {item: itemToAdd, quantity: 1}]);
      }
    }
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    const existing = cart.find((c) => c.item.id === itemId);
    if (!existing) return;

    const newQuantity = existing.quantity + change;
    if (newQuantity <= 0) {
      setCart(cart.filter((c) => c.item.id !== itemId));
    } else {
      setCart(
        cart.map((c) =>
          c.item.id === itemId ? {...c, quantity: newQuantity} : c,
        ),
      );
    }
  };

  const clearCart = () => {
    setCart([]);
    setSelectedFine(0);
    setSelectedJail(0);
    setTargetId("");
  };

  const toggleFavorite = (itemId: string) => {
    if (favorites.includes(itemId)) {
      setFavorites(favorites.filter((id) => id !== itemId));
    } else {
      setFavorites([...favorites, itemId]);
    }
  };

  const filteredKategorias = React.useMemo(() => {
    let kategorias: KategoriaData[] = JSON.parse(
      JSON.stringify(ALL_KATEGORIA_GROUPS),
    );

    if (isFavoritesView) {
      kategorias = kategorias
        .map((kat: KategoriaData) => {
          const filteredItems = kat.items
            .map((itemOrGroup) => {
              if ("alpontok" in itemOrGroup) {
                const matchingAlpontok = itemOrGroup.alpontok.filter((item) =>
                  favorites.includes(item.id),
                );
                if (matchingAlpontok.length > 0) {
                  return {...itemOrGroup, alpontok: matchingAlpontok, _matchType: "children" as const};
                }
                return null;
              } else {
                return favorites.includes(itemOrGroup.id) ? itemOrGroup : null;
              }
            })
            .filter(Boolean) as (PenalCodeItem | FilteredPenalCodeGroup)[];

          return {...kat, items: filteredItems};
        })
        .filter((kat) => kat.items.length > 0);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const checkMatch = (text: string) => text.toLowerCase().includes(lowerSearch);
      const checkItem = (item: PenalCodeItem) =>
        checkMatch(item.megnevezes) ||
        checkMatch(item.rovidites) ||
        checkMatch(item.paragrafus) ||
        checkMatch(item.megjegyzes);

      kategorias = kategorias
        .map((kat) => {
          const filteredItems = kat.items
            .map((itemOrGroup) => {
              if ("alpontok" in itemOrGroup) {
                const groupMatch =
                  checkMatch(itemOrGroup.megnevezes) ||
                  checkMatch(itemOrGroup.paragrafus) ||
                  checkMatch(itemOrGroup.megjegyzes);

                const matchingAlpontok = itemOrGroup.alpontok.filter(checkItem);

                if (groupMatch) {
                  return {...itemOrGroup, _matchType: "group" as const};
                }
                if (matchingAlpontok.length > 0) {
                  return {...itemOrGroup, alpontok: matchingAlpontok, _matchType: "children" as const};
                }
                return null;
              } else {
                return checkItem(itemOrGroup) ? itemOrGroup : null;
              }
            })
            .filter(Boolean) as (PenalCodeItem | FilteredPenalCodeGroup)[];

          return {...kat, items: filteredItems};
        })
        .filter((kat) => kat.items.length > 0);
    }

    return kategorias as FilteredKategoriaData[];
  }, [searchTerm, isFavoritesView, favorites]);

  const filteredCategoryNames = React.useMemo(
    () => filteredKategorias.map((k) => k.kategoria_nev),
    [filteredKategorias],
  );

  const [openCategories, setOpenCategories] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (searchTerm) {
      setOpenCategories(filteredCategoryNames);
    } else {
      if (openCategories.length !== 1) {
        setOpenCategories([]);
      }
    }
  }, [searchTerm, filteredCategoryNames]);

  const handleCategoryJump = (categoryName: string) => {
    setOpenCategories([categoryName]);
    setSearchTerm("");
    setTimeout(() => {
      const elementId = `category-item-${categoryName.replace(/\s/g, "-")}`;
      const element = document.getElementById(elementId);
      if (element) {
        const headerOffset = 70;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, 100);
  };


  React.useEffect(() => {
    let minFine = 0,
      maxFine = 0,
      minJail = 0,
      maxJail = 0;
    const specialJailNotes: string[] = [];
    const warningItems: PenalCodeItem[] = [];

    const parseSpecialValue = (
      value: string | number | null | undefined,
      type: "jail" | "fine",
      item: PenalCodeItem,
      quantity: number
    ) => {
      if (typeof value === "number") return value;
      if (typeof value !== "string") return null;

      const trimmedValue = value.trim();

      if (trimmedValue.startsWith("+") && trimmedValue.endsWith("perc")) {
        const amount = parseInt(trimmedValue.substring(1).replace("perc", "").trim(), 10);
        if (!isNaN(amount)) {
          const totalAmount = amount * quantity;
          if (type === "jail") {
            minJail += totalAmount;
            maxJail += totalAmount;
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
      if (item.isWarning && !warningItems.find(w => w.id === item.id)) {
        warningItems.push(item);
      }

      const minB = parseSpecialValue(item.min_birsag, "fine", item, quantity);
      const maxB = parseSpecialValue(item.max_birsag, "fine", item, quantity);
      if (typeof minB === "number") minFine += minB * quantity;
      if (typeof maxB === "number") maxFine += maxB * quantity;

      const minJ = parseSpecialValue(item.min_fegyhaz, "jail", item, quantity);
      const maxJ = parseSpecialValue(item.max_fegyhaz, "jail", item, quantity);
      if (typeof minJ === "number") minJail += minJ * quantity;
      if (typeof maxJ === "number") maxJail += maxJ * quantity;
    });

    const newSummary = {
      minFine,
      maxFine,
      minJail,
      maxJail,
      specialJailNotes,
      warningItems,
    };
    setSummary(newSummary);

    if (cart.length === 0) {
      setSelectedFine(0);
      setSelectedJail(0);
    } else {
      setSelectedFine((current) =>
        Math.max(
          newSummary.minFine,
          Math.min(newSummary.maxFine || Infinity, current || newSummary.minFine),
        ),
      );
      setSelectedJail((current) =>
        Math.max(
          newSummary.minJail,
          Math.min(newSummary.maxJail || Infinity, current || newSummary.minJail),
        ),
      );
    }
  }, [cart]);

  React.useEffect(() => {
    const idPlaceholder = targetId.trim() === "" ? "[ID]" : targetId.trim();

    if (cart.length === 0) {
      setArrestOutput("");
      setTicketReasons("");
      return;
    }

    const allReasons = cart
      .map(({item, quantity}) =>
        `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`,
      )
      .join(", ");
    setTicketReasons(allReasons);

    const arrestCartItems = cart.filter(
      ({item}) =>
        (typeof item.min_fegyhaz === "number" && item.min_fegyhaz > 0) ||
        (typeof item.max_fegyhaz === "number" && item.max_fegyhaz > 0) ||
        (typeof item.min_fegyhaz === "string" && item.min_fegyhaz.startsWith("+")) ||
        (typeof item.max_fegyhaz === "string" && item.max_fegyhaz.startsWith("+")),
    );

    const arrestReasons = arrestCartItems
      .map(({item, quantity}) =>
        `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`,
      )
      .join(", ");

    let arrestCmd = "";
    if (selectedJail > 0 && arrestCartItems.length > 0) {
      arrestCmd = `arrest ${idPlaceholder} ${selectedJail} ${arrestReasons}`;
    }

    setArrestOutput(arrestCmd);
  }, [cart, selectedFine, selectedJail, targetId]);

  const saveToHistory = () => {
    if (cart.length === 0) return;

    const snapshot: HistorySnapshot = {
      cart: JSON.parse(JSON.stringify(cart)),
      finalFine: selectedFine,
      finalJail: selectedJail,
      reasons: ticketReasons,
      timestamp: new Date().toISOString(),
    };

    const isDuplicate = history.some(
      (item) =>
        item.reasons === snapshot.reasons &&
        item.finalFine === snapshot.finalFine &&
        item.finalJail === snapshot.finalJail,
    );

    if (!isDuplicate) {
      const newHistory = [snapshot, ...history].slice(0, MAX_HISTORY_ITEMS);
      setHistory(newHistory);
    }
  };

  const copyArrest = () => {
    if (!arrestOutput || selectedJail === 0) {
      toast.error("Nincs mit másolni", {
        description: "Nincs fegyházbüntetés, így arrest parancs sem generálódott.",
      });
      return;
    }
    const commandToCopy = arrestOutput.split("\n\n")[0];
    navigator.clipboard.writeText(commandToCopy);
    toast.success("✅ arrest parancs a vágólapra másolva!");
    saveToHistory();
    setIsArrestCopied(true);
    setTimeout(() => setIsArrestCopied(false), 2000);
  };

  const copyReasons = () => {
    if (!ticketReasons) {
      toast.error("Nincs mit másolni", {
        description: "A jegyzőkönyv üres.",
      });
      return;
    }
    navigator.clipboard.writeText(ticketReasons);
    toast.success("✅ Indokok a vágólapra másolva!");
    saveToHistory();
    setIsReasonsCopied(true);
    setTimeout(() => setIsReasonsCopied(false), 2000);
  };

  const copyFineAmount = () => {
    if (selectedFine === 0 && cart.length === 0) {
      toast.error("Nincs bírság összeg a másoláshoz.");
      return;
    }
    navigator.clipboard.writeText(selectedFine.toString());
    toast.success("✅ Bírság összege a vágólapra másolva!");
    saveToHistory();
    setIsFineCopied(true);
    setTimeout(() => setIsFineCopied(false), 2000);
  };

  const loadFromHistory = (snapshot: HistorySnapshot) => {
    setCart(snapshot.cart);
    setSelectedFine(snapshot.finalFine);
    setSelectedJail(snapshot.finalJail);
    setIsHistoryOpen(false);
    setIsMobileDrawerOpen(false);
    toast.info("Előzmény betöltve.");
  };

  const handleSaveTemplate = (name: string) => {
    if (cart.length === 0) {
      toast.error("Nem menthetsz el üres jegyzőkönyvet sablonként.");
      return;
    }
    const newTemplate: Template = {
      id: `template-${Date.now()}`,
      name: name,
      cart: JSON.parse(JSON.stringify(cart)),
    };
    setTemplates([...templates, newTemplate]);
    toast.success("Sablon sikeresen mentve!", {description: newTemplate.name});
    setIsSaveTemplateOpen(false);
  };

  const loadFromTemplate = (template: Template) => {
    setCart(currentCart => {
      const newCart = [...currentCart];
      template.cart.forEach(templateItem => {
        const existingIndex = newCart.findIndex(cartItem => cartItem.item.id === templateItem.item.id);
        if (existingIndex !== -1) {
          newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantity: newCart[existingIndex].quantity + templateItem.quantity
          };
        } else {
          newCart.push(templateItem);
        }
      });
      return newCart;
    });
    toast.info("Sablon hozzáadva a jegyzőkönyvhöz.", {description: template.name});
    setIsTemplateModalOpen(false);
    setIsMobileDrawerOpen(false);
  };

  const deleteTemplate = (templateId: string) => {
    setTemplates(templates.filter(t => t.id !== templateId));
    toast.error("Sablon törölve.");
  };


  const handleNumericInput = (value: string, type: "fine" | "jail") => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (isNaN(num)) return;
    if (type === "fine") {
      setSelectedFine(num);
    } else {
      setSelectedJail(num);
    }
  };

  const validateOnBlur = (value: string, type: "fine" | "jail") => {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;

    const maxFine = summary.maxFine > 0 ? summary.maxFine : Infinity;
    const maxJail = summary.maxJail > 0 ? summary.maxJail : Infinity;

    if (type === "fine") {
      if (num < summary.minFine) num = summary.minFine;
      if (num > maxFine) num = maxFine;
      setSelectedFine(num);
    } else {
      if (num < summary.minJail) num = summary.minJail;
      if (num > maxJail) num = maxJail;
      setSelectedJail(num);
    }
  };

  // --- Renderelési függvények ---
  const PenalCodeItemCard = ({
                               item,
                               className,
                             }: {
    item: PenalCodeItem;
    className?: string;
  }) => {
    const isInCart = cart.some((c) => c.item.id === item.id);
    const isFavorite = favorites.includes(item.id);

    return (
      <div
        className={cn(
          "p-4 rounded-lg",
          isInCart
            ? item.isWarning
              ? "bg-amber-900/50"
              : "bg-blue-900/50"
            : "bg-slate-800/50",
          className,
        )}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-blue-300">
              {item.fo_tetel_nev && (
                <span className="text-sm text-slate-400 font-normal block">
                  <HighlightText text={item.fo_tetel_paragrafus!} highlight={searchTerm}/>{" "}
                  <HighlightText text={item.fo_tetel_nev} highlight={searchTerm}/>
                </span>
              )}
              <span className="font-bold">
                <HighlightText text={item.paragrafus} highlight={searchTerm}/>
              </span>{" "}
              <HighlightText text={item.megnevezes} highlight={searchTerm}/>
              {item.isWarning && (
                <AlertTriangle className="inline w-4 h-4 ml-2 text-amber-400"/>
              )}
            </h3>
            <div className="text-sm mt-1 text-slate-200 space-y-1 md:space-y-0 md:space-x-4 flex flex-col md:flex-row">
              <span>
                Bírság:{" "}
                <strong>
                  {formatCurrency(item.min_birsag)} -{" "}
                  {formatCurrency(item.max_birsag)}
                </strong>
              </span>
              <span>
                Fegyház:{" "}
                <strong>
                  {formatJailTime(item.min_fegyhaz)} -{" "}
                  {formatJailTime(item.max_fegyhaz)}
                </strong>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">
              <HighlightText text={item.megjegyzes || ""} highlight={searchTerm}/>
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Button
              size="sm"
              variant={isInCart ? "secondary" : "default"}
              onClick={() => addToCart(item.id)}
              className="w-[100px] text-center"
            >
              {isInCart ? "Hozzáadva ✓" : "Hozzáadás"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-500 hover:text-yellow-300 data-[favorite=true]:text-yellow-400"
              data-favorite={isFavorite}
              onClick={() => toggleFavorite(item.id)}
            >
              <Star
                className="w-5 h-5"
                fill={isFavorite ? "currentColor" : "none"}
              />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderItemList = () => {
    if (filteredKategorias.length === 0) {
      return (
        <div className="text-center text-slate-400 py-12 px-4">
          <Search className="mx-auto h-12 w-12"/>
          <h3 className="mt-2 text-lg font-medium">Nincs találat</h3>
          <p className="mt-1 text-sm">
            {isFavoritesView
              ? "Nincsenek a keresésnek megfelelő kedvencek."
              : "Próbálj meg más kulcsszót használni."}
          </p>
        </div>
      );
    }

    return (
      <Accordion
        type="multiple"
        value={openCategories}
        onValueChange={setOpenCategories}
        className="w-full space-y-4"
      >
        {filteredKategorias.map((kategoria) => (
          <AccordionItem
            value={kategoria.kategoria_nev}
            key={kategoria.kategoria_nev}
            id={`category-item-${kategoria.kategoria_nev.replace(/\s/g, "-")}`}
            className="border-b-0 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden"
          >
            <AccordionTrigger
              className="text-xl font-semibold text-white px-4 hover:no-underline bg-slate-800/50 data-[state=open]:border-b border-slate-700">
              {kategoria.kategoria_nev}
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <div className="p-2 space-y-2">
                {kategoria.items.map((itemOrGroup) =>
                  "alpontok" in itemOrGroup ? (
                    <Accordion
                      type="single"
                      collapsible
                      key={itemOrGroup.id}
                      defaultValue={
                        searchTerm && itemOrGroup._matchType === "children"
                          ? itemOrGroup.id
                          : undefined
                      }
                      className="w-full bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <AccordionItem value={itemOrGroup.id} className="border-b-0">
                        <AccordionTrigger className="text-lg font-medium text-blue-200 px-4 hover:no-underline">
                          <div className="flex-1 text-left">
                            <span>
                              <strong>
                                <HighlightText text={itemOrGroup.paragrafus} highlight={searchTerm}/>
                              </strong>:{" "}
                              <HighlightText text={itemOrGroup.megnevezes} highlight={searchTerm}/>
                            </span>
                            {itemOrGroup.megjegyzes && (
                              <p className="text-xs text-slate-500 font-normal italic mt-1">
                                <HighlightText text={itemOrGroup.megjegyzes} highlight={searchTerm}/>
                              </p>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-2 px-2 space-y-2">
                          {itemOrGroup.alpontok.map((item) => (
                            <PenalCodeItemCard
                              item={item}
                              key={item.id}
                              className="bg-slate-700/70"
                            />
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : (
                    <PenalCodeItemCard item={itemOrGroup} key={itemOrGroup.id}/>
                  ),
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderSidebar = () => {
    const fineRangeString =
      summary.minFine === summary.maxFine
        ? formatCurrency(summary.minFine)
        : `${formatCurrency(summary.minFine)} - ${formatCurrency(summary.maxFine)}`;

    const jailRangeString =
      summary.minJail === summary.maxJail
        ? `${summary.minJail} perc`
        : `${summary.minJail} perc - ${summary.maxJail} perc`;

    const licenseWarnings = summary.warningItems.filter(
      (item) => item.warningType === "license_ban" || item.warningType === "license_registration_revoke"
    );
    const firearmWarnings = summary.warningItems.filter(
      (item) => item.warningType === "firearm_revoke"
    );

    const jailInputClasses = cn(
      "h-8 w-full",
      selectedJail >= 60 && "border-red-500 focus-visible:ring-red-500",
      selectedJail > 0 && selectedJail < 60 && "border-yellow-500 focus-visible:ring-yellow-500"
    );

    return (
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700 text-white @container">
          <CardHeader>
            <CardTitle>Jegyzőkönyv</CardTitle>
            <CardDescription>A kiválasztott tételek</CardDescription>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto space-y-3 divide-y divide-slate-800">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <ClipboardList className="w-16 h-16"/>
                <p className="mt-2 text-sm">A jegyzőkönyv üres.</p>
              </div>
            )}
            {cart.map(({item, quantity}) => (
              <div
                key={item.id}
                className="flex justify-between items-center pt-3"
              >
                <div className="flex-1 pr-2">
                  <p className="text-sm font-medium truncate">
                    {item.megnevezes}
                    {item.isWarning && (
                      <AlertTriangle className="inline w-4 h-4 ml-1 text-amber-400"/>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(item.min_birsag)} /{" "}
                    {formatJailTime(item.min_fegyhaz)}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => updateCartQuantity(item.id, -1)}
                  >
                    -
                  </Button>
                  <span className="text-sm font-bold w-4 text-center">
                    {quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => updateCartQuantity(item.id, 1)}
                  >
                    +
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-red-500"
                    onClick={() => updateCartQuantity(item.id, -quantity)}
                  >
                    <X className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          {cart.length > 0 && (
            <CardFooter className="flex-col @sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full @sm:w-auto"
                onClick={() => {
                  if (cart.length > 0) {
                    setIsSaveTemplateOpen(true);
                  } else {
                    toast.error("Előbb tegyél tételeket a jegyzőkönyvbe.");
                  }
                }}
              >
                <Save className="w-4 h-4 mr-2"/>
                Mentés sablonként
              </Button>
              <Button variant="outline" className="w-full @sm:flex-1" onClick={clearCart}>
                Jegyzőkönyv törlése
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="bg-slate-900 border-slate-700 text-white">
          <CardHeader>
            <CardTitle>Összesítés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {summary.warningItems.length > 0 && (
              <Alert
                variant="destructive"
                className="bg-amber-900 border-amber-700 text-amber-200"
              >
                <AlertTriangle className="h-4 w-4" color="#fcd34d"/>
                <AlertTitle>Különleges Figyelmeztetések</AlertTitle>
                <AlertDescription className="text-xs space-y-2 mt-2">
                  <div className={cn(
                    "w-full flex",
                    (licenseWarnings.length > 0 && firearmWarnings.length > 0)
                      ? "flex-row gap-4"
                      : "flex-col gap-2"
                  )}>
                    {licenseWarnings.length > 0 && (
                      <div className="flex-1 flex gap-2">
                        <Car className="w-4 h-4 mt-0.5 text-amber-100 shrink-0"/>
                        <div className="space-y-1">
                          <span className="font-bold text-amber-100 block">Közlekedés</span>
                          {licenseWarnings.map(item => {
                            const warningText = item.warningType === "license_registration_revoke"
                              ? "Jogosítvány ÉS forgalmi bevonása javasolt."
                              : "Jogosítvány bevonása lehetséges.";

                            return (
                              <div key={item.id}>
                                <strong>{item.megnevezes}:</strong> {warningText}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(licenseWarnings.length > 0 && firearmWarnings.length > 0) && (
                      <div className="w-px bg-amber-700 shrink-0"></div>
                    )}
                    {firearmWarnings.length > 0 && (
                      <div className="flex-1 flex gap-2">
                        <Target className="w-4 h-4 mt-0.5 text-amber-100 shrink-0"/>
                        <div className="space-y-1">
                          <span className="font-bold text-amber-100 block">Fegyverek</span>
                          {firearmWarnings.map(item => (
                            <div key={item.id}>
                              <strong>{item.megnevezes}:</strong> Fegyver/Engedély bevonása javasolt.
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Bírság (Min-Max):</span>
                <span className="font-medium">{fineRangeString}</span>
              </div>
              <Slider
                min={summary.minFine}
                max={summary.maxFine}
                step={1000}
                value={[selectedFine]}
                onValueChange={(val) => setSelectedFine(val[0])}
                disabled={cart.length === 0 || summary.minFine === summary.maxFine}
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">Kiszabott:</span>
                <Input
                  type="number"
                  className="h-8 w-full"
                  value={selectedFine}
                  min={summary.minFine}
                  max={summary.maxFine > 0 ? summary.maxFine : undefined}
                  step={1000}
                  onChange={(e) => handleNumericInput(e.target.value, "fine")}
                  onBlur={(e) => validateOnBlur(e.target.value, "fine")}
                  disabled={cart.length === 0}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={cart.length === 0 || summary.maxFine === 0}
                  onClick={() => setSelectedFine(summary.maxFine)}
                >
                  MAX
                </Button>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Fegyház (Min-Max):</span>
                <span className="font-medium">{jailRangeString}</span>
              </div>
              <Slider
                min={summary.minJail}
                max={summary.maxJail}
                step={1}
                value={[selectedJail]}
                onValueChange={(val) => setSelectedJail(val[0])}
                disabled={cart.length === 0 || summary.minJail === summary.maxJail}
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">Kiszabott:</span>
                <Input
                  type="number"
                  className={jailInputClasses}
                  value={selectedJail}
                  min={summary.minJail}
                  max={summary.maxJail > 0 ? summary.maxJail : undefined}
                  step={1}
                  onChange={(e) => handleNumericInput(e.target.value, "jail")}
                  onBlur={(e) => validateOnBlur(e.target.value, "jail")}
                  disabled={cart.length === 0}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={cart.length === 0 || summary.maxJail === 0}
                  onClick={() => setSelectedJail(summary.maxJail)}
                >
                  MAX
                </Button>
              </div>
            </div>

            {summary.specialJailNotes.length > 0 && (
              <Alert
                variant="default"
                className="bg-slate-800 border-slate-700 text-slate-300"
              >
                <AlertCircle className="h-4 w-4"/>
                <AlertTitle>Speciális tételek</AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="list-disc list-inside">
                    {summary.specialJailNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700 text-white">
          <CardHeader>
            <CardTitle>Parancsok és Indokok</CardTitle>
            <CardDescription>
              Másold az indokokat a /ticket parancshoz, vagy a teljes
              parancsot a fegyházbüntetéshez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5"/> /ticket (bírság) infó
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 shrink-0">
                  Bírság összege:
                </span>
                <Input
                  readOnly
                  value={formatCurrency(selectedFine)}
                  className="font-bold bg-slate-800"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-10 shrink-0"
                  onClick={copyFineAmount}
                  disabled={isFineCopied && cart.length > 0}
                  title="Bírság összegének másolása"
                >
                  {isFineCopied ? (
                    <Check className="w-4 h-4"/>
                  ) : (
                    <Copy className="w-4 h-4"/>
                  )}
                </Button>
              </div>
              <Textarea
                readOnly
                value={ticketReasons || "Nincsenek indokok."}
                className="h-20 bg-slate-800"
                placeholder="Indokok (Minden tétel)..."
              />
              <Button
                className="w-full"
                onClick={copyReasons}
                disabled={!ticketReasons || isReasonsCopied}
                variant={isReasonsCopied ? "secondary" : "outline"}
              >
                {isReasonsCopied ? (
                  <Check className="w-4 h-4 mr-2"/>
                ) : (
                  <Copy className="w-4 h-4 mr-2"/>
                )}
                {isReasonsCopied ? "Indokok másolva!" : "Csak az indokok másolása"}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="font-semibold flex items-center gap-2">
                <Package className="w-5 h-5"/> arrest parancs
              </label>
              <Input
                placeholder="Célpont ID"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              />
              <Textarea
                readOnly
                value={
                  arrestOutput || "Nincs fegyházbüntetéssel járó tétel kiválasztva."
                }
                className="h-24 bg-slate-800"
                placeholder="Indokok (Csak fegyházas tételek)..."
              />
              <Button
                className="w-full"
                onClick={copyArrest}
                disabled={!arrestOutput || selectedJail === 0 || isArrestCopied}
                variant={isArrestCopied ? "secondary" : "default"}
              >
                {isArrestCopied ? (
                  <Check className="w-4 h-4 mr-2"/>
                ) : (
                  <Copy className="w-4 h-4 mr-2"/>
                )}
                {isArrestCopied
                  ? "Parancs másolva!"
                  : "arrest parancs másolása"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-500 px-4 pt-2">
          <p>
            A rendszert készítette: <strong>Matuza Balázs</strong> //{" "}
            <strong>Martin Lothbrok</strong>
          </p>
          <p>
            Büntetőtörvénykönyv adatok: <strong>Tetsu</strong>
          </p>
        </div>
      </div>
    );
  };

  const renderLeftSidebar = () => (
    <div className="bg-slate-900 border border-slate-700 rounded-lg flex flex-col">
      <h3 className="text-base font-bold text-slate-300 p-4 border-b border-slate-700 flex-shrink-0">
        Kategóriák
      </h3>
      <div className="flex flex-col gap-2 p-4">
        {ALL_KATEGORIA_NAMES.map((name) => (
          <Button
            key={name}
            variant="ghost"
            className={cn(
              "w-full justify-start text-left h-auto text-base whitespace-normal",
              openCategories.length === 1 && openCategories[0] === name
                ? "text-blue-300 bg-slate-800"
                : "text-slate-300"
            )}
            onClick={() => handleCategoryJump(name)}
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  );


  return (
    <>
      <Toaster position="top-right" richColors theme="dark"/>

      <SaveTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        onSave={handleSaveTemplate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:items-start">
        <div
          className="hidden xl:block xl:sticky xl:top-[5.5rem] max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide">
          {renderLeftSidebar()}
        </div>

        {/* === KÖZÉPSŐ OSZLOP === */}
        <div className="lg:col-span-2">

          {/* Mobil/Tablet Kereső */}
          <div className="xl:hidden sticky top-[4rem] z-20 bg-slate-950 pt-4 pb-3 border-b border-slate-800 -mt-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"/>
                <Input
                  placeholder="Keresés..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant={isFavoritesView ? "default" : "outline"}
                size="icon"
                className={isFavoritesView ? "text-yellow-400" : ""}
                onClick={() => setIsFavoritesView(!isFavoritesView)}
              >
                <Star className="w-5 h-5"/>
              </Button>
              {isDesktop && (
                <>
                  <HistoryModal
                    isDesktop={isDesktop}
                    open={isHistoryOpen}
                    onOpenChange={setIsHistoryOpen}
                    history={history}
                    loadFromHistory={loadFromHistory}
                  />
                  <TemplateModal
                    isDesktop={isDesktop}
                    open={isTemplateModalOpen}
                    onOpenChange={setIsTemplateModalOpen}
                    templates={templates}
                    loadFromTemplate={loadFromTemplate}
                    deleteTemplate={deleteTemplate}
                  />
                </>
              )}
            </div>
            <div className="lg:hidden pt-3 flex flex-wrap gap-2">
              {ALL_KATEGORIA_NAMES.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "shrink-0 text-xs h-7",
                    openCategories.length === 1 && openCategories[0] === name && "bg-slate-700 text-white"
                  )}
                  onClick={() => handleCategoryJump(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>

          <div
            className="hidden xl:block sticky top-[4rem] z-20 bg-slate-950 pt-4 pb-3 border-b border-slate-800 -mt-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"/>
                <Input
                  placeholder="Keresés (név, rövidítés, paragrafus...)"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant={isFavoritesView ? "default" : "outline"}
                size="icon"
                className={isFavoritesView ? "text-yellow-400" : ""}
                onClick={() => setIsFavoritesView(!isFavoritesView)}
              >
                <Star className="w-5 h-5"/>
              </Button>
              <HistoryModal
                isDesktop={isDesktop}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                history={history}
                loadFromHistory={loadFromHistory}
              />
              <TemplateModal
                isDesktop={isDesktop}
                open={isTemplateModalOpen}
                onOpenChange={setIsTemplateModalOpen}
                templates={templates}
                loadFromTemplate={loadFromTemplate}
                deleteTemplate={deleteTemplate}
              />
            </div>
          </div>


          {/* A tényleges Btk. lista */}
          <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
            {renderItemList()}
          </div>
        </div>

        {/* === JOBB OSZLOP (JEGYZŐKÖNYV) === */}
        <div
          className="hidden lg:block lg:col-span-1 xl:col-span-1 lg:sticky lg:top-[5.5rem] max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide">
          {renderSidebar()}
        </div>
      </div>


      {!isDesktop && (
        <Drawer open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-30"
            >
              <ClipboardList className="w-6 h-6"/>
              {cart.length > 0 && (
                <span
                  className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent
            className="bg-slate-950 border-slate-800 text-white max-h-[90vh]"
            aria-describedby="cart-drawer-description"
          >
            <DrawerHeader>
              <DrawerTitle>Jegyzőkönyv & Összesítés</DrawerTitle>
              <DrawerDescription id="cart-drawer-description">
                Itt kezelheted a kosarad tartalmát és a kiszabandó büntetéseket.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-4">
              {renderSidebar()}
            </div>
            <DrawerFooter className="pt-4">
              <HistoryModal
                isDesktop={isDesktop}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                history={history}
                loadFromHistory={loadFromHistory}
              />
              <TemplateModal
                isDesktop={isDesktop}
                open={isTemplateModalOpen}
                onOpenChange={setIsTemplateModalOpen}
                templates={templates}
                loadFromTemplate={loadFromTemplate}
                deleteTemplate={deleteTemplate}
              />
              <DrawerClose asChild>
                <Button variant="outline">Bezárás</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}