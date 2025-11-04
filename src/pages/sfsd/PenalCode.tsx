import * as React from "react";
import {
  prepareData,
  formatCurrency,
  formatJailTime,
} from "@/lib/penalcode-processor";
import type {PenalCodeItem} from "@/types/penalcode";
import { useMediaQuery } from "@/hooks/use-media-query";

// Shadcn UI Komponensek
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
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
  ClipboardList, // JAVÍTÁS: Ikon cserélve (3. kérés)
  Copy,
  History,
  Search,
  Star,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

interface Summary {
  minFine: number;
  maxFine: number;
  minJail: number;
  maxJail:
    | number;
  specialJailNotes: string[];
  warningItems: string[];
}

// --- Adatok betöltése ---

const allItems = prepareData();
const allCategoryNames = Object.keys(allItems.reduce(
  (acc, item) => {
    if (!acc[item.kategoria_nev]) {
      acc[item.kategoria_nev] = [];
    }
    acc[item.kategoria_nev].push(item);
    return acc;
  },
  {} as Record<string, PenalCodeItem[]>,
));

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
    const rtf = new Intl.RelativeTimeFormat("hu", { numeric: "auto" });

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

// --- A FŐ KOMPONENS ---

export function PenalCodePage() {
  // Állapotok (State)
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
  const [commandOutput, setCommandOutput] = React.useState("");

  const [isCopied, setIsCopied] = React.useState(false);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // --- Logika ---

  // Kosár logikája
  const addToCart = (itemId: string) => {
    const existing = cart.find((c) => c.item.id === itemId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity + 1 } : c,
        ),
      );
    } else {
      const itemToAdd = allItems.find((item) => item.id === itemId);
      if (itemToAdd) {
        setCart([...cart, { item: itemToAdd, quantity: 1 }]);
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
          c.item.id === itemId ? { ...c, quantity: newQuantity } : c,
        ),
      );
    }
  };

  const clearCart = () => setCart([]);

  // Kedvencek logikája
  const toggleFavorite = (itemId: string) => {
    if (favorites.includes(itemId)) {
      setFavorites(favorites.filter((id) => id !== itemId));
    } else {
      setFavorites([...favorites, itemId]);
    }
  };

  // Keresés és szűrés logikája
  const filteredItems = React.useMemo(() => {
    let items = isFavoritesView
      ? allItems.filter((item) => favorites.includes(item.id))
      : allItems;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.megnevezes.toLowerCase().includes(lowerSearch) ||
          item.rovidites.toLowerCase().includes(lowerSearch) ||
          item.paragrafus.toLowerCase().includes(lowerSearch) ||
          item.megjegyzes.toLowerCase().includes(lowerSearch),
      );
    }

    return items.reduce(
      (acc, item) => {
        if (!acc[item.kategoria_nev]) {
          acc[item.kategoria_nev] = [];
        }
        acc[item.kategoria_nev].push(item);
        return acc;
      },
      {} as Record<string, PenalCodeItem[]>,
    );
  }, [searchTerm, isFavoritesView, favorites]);

  const filteredCategoryNames = React.useMemo(() => Object.keys(filteredItems), [filteredItems]);

  // Összesítő számítás
  React.useEffect(() => {
    let minFine = 0,
      maxFine = 0,
      minJail = 0,
      maxJail = 0;
    const specialJailNotes: string[] = [];
    const warningItems: string[] = [];

    cart.forEach(({ item, quantity }) => {
      if (item.isWarning && !warningItems.includes(item.megnevezes)) {
        warningItems.push(item.megnevezes);
      }
      if (typeof item.min_birsag === "number") minFine += item.min_birsag * quantity;
      if (typeof item.max_birsag === "number") maxFine += item.max_birsag * quantity;
      if (typeof item.min_fegyhaz === "number") minJail += item.min_fegyhaz * quantity;
      if (typeof item.max_fegyhaz === "number") maxJail += item.max_fegyhaz * quantity;

      if (typeof item.min_fegyhaz === "string") specialJailNotes.push(`${item.megnevezes}: ${item.min_fegyhaz} (x${quantity})`);
      if (typeof item.max_fegyhaz === "string" && item.max_fegyhaz !== item.min_fegyhaz) specialJailNotes.push(`${item.megnevezes}: ${item.max_fegyhaz} (x${quantity})`);
    });

    const newSummary = { minFine, maxFine, minJail, maxJail, specialJailNotes, warningItems };
    setSummary(newSummary);

    setSelectedFine(current => Math.max(newSummary.minFine, Math.min(newSummary.maxFine || Infinity, current || newSummary.minFine)));
    setSelectedJail(current => Math.max(newSummary.minJail, Math.min(newSummary.maxJail || Infinity, current || newSummary.minJail)));

  }, [cart]);

  // Parancs generátor
  React.useEffect(() => {
    const idPlaceholder = targetId.trim() === "" ? "[ID]" : targetId.trim();

    if (cart.length === 0) {
      setCommandOutput("");
      return;
    }

    const reasons = cart
      .map(({ item, quantity }) =>
        `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`,
      )
      .join(", ");

    let commands = [];
    if (selectedFine > 0) {
      commands.push(`/ticket ${idPlaceholder} ${selectedFine} ${reasons}`);
    }
    if (selectedJail > 0) {
      commands.push(`/jail ${idPlaceholder} ${selectedJail} ${reasons}`);
    }

    if (summary.specialJailNotes.length > 0) {
      if (commands.length > 0) commands.push("\n");
      commands.push("FIGYELEM: A fenti tételek speciális (szöveges) büntetést tartalmaznak!");
    }

    setCommandOutput(commands.join("\n"));
  }, [cart, selectedFine, selectedJail, targetId, summary.specialJailNotes]);

  // Előzmények mentése
  const saveToHistory = () => {
    const reasons = cart
      .map(({ item, quantity }) =>
        `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`,
      )
      .join(", ");

    const snapshot: HistorySnapshot = {
      cart: JSON.parse(JSON.stringify(cart)),
      finalFine: selectedFine,
      finalJail: selectedJail,
      reasons: reasons,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [snapshot, ...history].slice(0, MAX_HISTORY_ITEMS);
    setHistory(newHistory);
  };

  // Másolás gomb funkció
  const copyCommands = () => {
    if (!commandOutput) return;
    navigator.clipboard.writeText(commandOutput);
    toast.success("✅ Parancsok a vágólapra másolva!");
    saveToHistory();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Előzmény betöltése
  const loadFromHistory = (snapshot: HistorySnapshot) => {
    setCart(snapshot.cart);
    setSelectedFine(snapshot.finalFine);
    setSelectedJail(snapshot.finalJail);

    setIsHistoryOpen(false);
    setIsMobileDrawerOpen(false);

    toast.info("Előzmény betöltve.");
  };

  // Manuális input kezelők
  const handleNumericInput = (value: string, type: 'fine' | 'jail') => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (isNaN(num)) return;

    if (type === 'fine') {
      setSelectedFine(num);
    } else {
      setSelectedJail(num);
    }
  };

  const validateOnBlur = (value: string, type: 'fine' | 'jail') => {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;

    const maxFine = summary.maxFine > 0 ? summary.maxFine : Infinity;
    const maxJail = summary.maxJail > 0 ? summary.maxJail : Infinity;

    if (type === 'fine') {
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

  const renderItemList = () => {
    if (filteredCategoryNames.length === 0) {
      return (
        <div className="text-center text-slate-400 py-12">
          <Search className="mx-auto h-12 w-12" />
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
        defaultValue={searchTerm ? filteredCategoryNames : allCategoryNames}
        className="w-full space-y-4"
      >
        {filteredCategoryNames.map((kategoriaNev) => (
          <AccordionItem
            value={kategoriaNev}
            key={kategoriaNev}
            className="border-b-0 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden"
          >
            <AccordionTrigger className="text-xl font-semibold text-white px-4 hover:no-underline bg-slate-800/50 data-[state=open]:border-b border-slate-700">
              {kategoriaNev}
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              {/* JAVÍTÁS: 'divide-y' helyett 'space-y-2' és 'p-2' a szebb elválasztásért */}
              <div className="p-2 space-y-2">
                {filteredItems[kategoriaNev].map((item) => {
                  const isInCart = cart.some((c) => c.item.id === item.id);
                  const isFavorite = favorites.includes(item.id);

                  return (
                    // JAVÍTÁS: A paragrafusok mostantól lekerekített sarkú (rounded-lg) dobozok
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg ${isInCart ? (item.isWarning ? "bg-amber-900/50" : "bg-blue-900/50") : "bg-slate-800/50"}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-blue-300">
                            {item.megnevezes}
                            {item.isWarning && (
                              <AlertTriangle className="inline w-4 h-4 ml-2 text-amber-400" />
                            )}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {item.fo_tetel_nev ? `${item.fo_tetel_nev} (${item.paragrafus})` : item.paragrafus}
                          </p>
                          <div className="text-sm mt-1 text-slate-200 space-y-1 md:space-y-0 md:space-x-4 flex flex-col md:flex-row">
                            <span>Bírság: <strong>{formatCurrency(item.min_birsag)} - {formatCurrency(item.max_birsag)}</strong></span>
                            <span>Fegyház: <strong>{formatJailTime(item.min_fegyhaz)} - {formatJailTime(item.max_fegyhaz)}</strong></span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2 italic">{item.megjegyzes || ""}</p>
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
                            <Star className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderSidebar = () => (
    // JAVÍTÁS: A térköz (space-y-6) ide került át (1. kérés)
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader>
          <CardTitle>Jegyzőkönyv</CardTitle>
          <CardDescription>A kiválasztott tételek</CardDescription>
        </CardHeader>
        <CardContent className="max-h-64 overflow-y-auto space-y-3 divide-y divide-slate-800">
          {/* JAVÍTÁS: Ikon megjelenítése, ha a kosár üres (4. kérés) */}
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <ClipboardList className="w-16 h-16" />
              <p className="mt-2 text-sm">A jegyzőkönyv üres.</p>
            </div>
          )}
          {cart.map(({ item, quantity }) => (
            <div key={item.id} className="flex justify-between items-center pt-3">
              <div className="flex-1 pr-2">
                <p className="text-sm font-medium truncate">
                  {item.megnevezes}
                  {item.isWarning && (<AlertTriangle className="inline w-4 h-4 ml-1 text-amber-400" />)}
                </p>
                <p className="text-xs text-slate-400">{formatCurrency(item.min_birsag)} / {formatJailTime(item.min_fegyhaz)}</p>
              </div>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => updateCartQuantity(item.id, -1)}>-</Button>
                <span className="text-sm font-bold w-4 text-center">{quantity}</span>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => updateCartQuantity(item.id, 1)}>+</Button>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500" onClick={() => updateCartQuantity(item.id, -quantity)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
        {cart.length > 0 && (
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={clearCart}>Jegyzőkönyv törlése</Button>
          </CardFooter>
        )}
      </Card>

      {/* JAVÍTÁS: Eltávolítva az 'mt-6' innen (1. kérés) */}
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader>
          <CardTitle>Összesítés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.warningItems.length > 0 && (
            <Alert variant="destructive" className="bg-amber-900 border-amber-700 text-amber-200">
              <AlertTriangle className="h-4 w-4" color="#fcd34d" />
              <AlertTitle>Eltiltás/Bevonás Lehetséges</AlertTitle>
              <AlertDescription className="text-xs">
                A jegyzőkönyv figyelmeztetéssel járó tételeket tartalmaz.
              </AlertDescription>
            </Alert>
          )}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300">Bírság (Min-Max):</span>
              <span className="font-medium">{formatCurrency(summary.minFine)} - {formatCurrency(summary.maxFine)}</span>
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
                onChange={(e) => handleNumericInput(e.target.value, 'fine')}
                onBlur={(e) => validateOnBlur(e.target.value, 'fine')}
                disabled={cart.length === 0}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300">Fegyház (Min-Max):</span>
              <span className="font-medium">{summary.minJail} perc - {summary.maxJail} perc</span>
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
                className="h-8 w-full"
                value={selectedJail}
                min={summary.minJail}
                max={summary.maxJail > 0 ? summary.maxJail : undefined}
                step={1}
                onChange={(e) => handleNumericInput(e.target.value, 'jail')}
                onBlur={(e) => validateOnBlur(e.target.value, 'jail')}
                disabled={cart.length === 0}
              />
            </div>
          </div>
          {summary.specialJailNotes.length > 0 && (
            <Alert variant="default" className="bg-slate-800 border-slate-700 text-slate-300">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Speciális tételek</AlertTitle>
              <AlertDescription className="text-xs">
                <ul className="list-disc list-inside">
                  {summary.specialJailNotes.map((note, i) => <li key={i}>{note}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* JAVÍTÁS: Eltávolítva az 'mt-6' innen (1. kérés) */}
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader>
          <CardTitle>Parancs Generátor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Célpont ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          <Textarea readOnly value={commandOutput || "A parancsok itt fognak megjelenni..."} className="h-24 bg-slate-800" />
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={copyCommands}
            disabled={!commandOutput || isCopied}
            variant={isCopied ? "secondary" : "default"}
          >
            {isCopied ? ( <Check className="w-4 h-4 mr-2" /> ) : ( <Copy className="w-4 h-4 mr-2" /> )}
            {isCopied ? "Másolva!" : "Parancsok Másolása"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  // Reszponzív Előzmények Komponens
  const HistoryModal = () => {
    const content = (
      <>
        {history.length === 0 ? (
          <p className="text-slate-400 text-center py-4">Nincsenek mentett előzmények.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
            {history.map((item) => (
              <div key={item.timestamp} className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                <div>
                  <p className="font-medium">{formatCurrency(item.finalFine)} / {item.finalJail} perc</p>
                  <p className="text-sm text-slate-400 truncate max-w-xs" title={item.reasons}>{item.reasons || "(Nincs ok)"}</p>
                  <p className="text-xs text-slate-500">{getRelativeTime(item.timestamp)}</p>
                </div>
                <Button onClick={() => loadFromHistory(item)}>
                  Betöltés
                </Button>
              </div>
            ))}
          </div>
        )}
      </>
    );

    if (isDesktop) {
      return (
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <History className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" aria-describedby="history-dialog-description">
            <DialogHeader>
              <DialogTitle>Intézkedés Előzmények</DialogTitle>
              <DialogDescription id="history-dialog-description">
                Az utolsó 10 mentett intézkedés. Kattints a "Betöltés" gombra a kosár visszaállításához.
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
      <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" className="w-full">
            <History className="w-4 h-4 mr-2" /> Előzmények
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh]" aria-describedby="history-drawer-description">
          <DrawerHeader>
            <DrawerTitle>Intézkedés Előzmények</DrawerTitle>
            <DrawerDescription id="history-drawer-description">
              Az utolsó 10 mentett intézkedés.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4">
            {content}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Bezárás</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  };


  // --- JSX Visszatérés (Fő elrendezés) ---

  return (
    <>
      <Toaster position="top-right" richColors theme="dark" />

      {/* Fejléc (Kereső és Gombok) */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
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
          <Star className="w-5 h-5" />
        </Button>
        {isDesktop && <HistoryModal />}
      </div>

      {/* Törzs (Kétoszlopos elrendezés) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        {/* Bal oszlop: Tételek */}
        <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
          {renderItemList()}
        </div>

        {/* Jobb oszlop: Kosár (Csak desktop) */}
        {isDesktop && (
          // JAVÍTÁS: 'space-y-6' eltávolítva innen. Hozzáadva 'max-h' és 'overflow-y-auto' a görgetéshez.
          // JAVÍTÁS: Hozzáadva a 'scrollbar-hide' osztály (2. kérés)
          <div className="lg:col-span-1 lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide">
            {renderSidebar()}
          </div>
        )}
      </div>

      {/* Mobil nézet lebegő gomb és Drawer */}
      {!isDesktop && (
        <Drawer open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg lg:hidden"
            >
              {/* JAVÍTÁS: Ikon cserélve (3. kérés) */}
              <ClipboardList className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                   {cart.reduce((acc, item) => acc + item.quantity, 0)}
                 </span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-slate-950 border-slate-800 text-white max-h-[90vh]" aria-describedby="cart-drawer-description">
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
              <HistoryModal />
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