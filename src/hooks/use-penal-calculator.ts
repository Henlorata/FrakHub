import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { PenalCodeItem, Tetel } from "@/types/penalcode";

// --- TÍPUSOK ---
export interface SelectedItem extends PenalCodeItem {
  uniqueId: string;
}

export interface CalculatorState {
  cart: SelectedItem[];
  suspectName: string;
  suspectId: string;
  isAccomplice: boolean;
  customFine: number;
  customJail: number;
  timestamp?: string;
}

const STORAGE_KEY_HISTORY = "sfsd_calculator_history";
const STORAGE_KEY_FAVORITES = "sfsd_favorites";

export function usePenalCalculator() {
  const [cart, setCart] = useState<SelectedItem[]>([]);
  const [suspectName, setSuspectName] = useState("");
  const [suspectId, setSuspectId] = useState("");
  const [isAccomplice, setIsAccomplice] = useState(false);

  const [manualFine, setManualFine] = useState<number>(0);
  const [manualJail, setManualJail] = useState<number>(0);

  const [history, setHistory] = useState<CalculatorState[]>(() => {
    try {
      const item = localStorage.getItem(STORAGE_KEY_HISTORY);
      return item ? JSON.parse(item) : [];
    } catch { return []; }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const item = localStorage.getItem(STORAGE_KEY_FAVORITES);
      return item ? JSON.parse(item) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  const stats = useMemo(() => {
    let minFine = 0;
    let maxFine = 0;
    let minJail = 0;
    let maxJail = 0;
    const warnings: string[] = [];

    cart.forEach((item) => {
      minFine += item.min_birsag || 0;
      maxFine += item.max_birsag || 0;

      const minJailVal = typeof item.min_fegyhaz === 'number' ? item.min_fegyhaz : 0;
      const maxJailVal = typeof item.max_fegyhaz === 'number' ? item.max_fegyhaz : 0;
      minJail += minJailVal;
      maxJail += maxJailVal;

      if (item.isWarning && item.megjegyzes) {
        const warningText = `${item.rovidites}: ${item.megjegyzes}`;
        if (!warnings.includes(warningText)) warnings.push(warningText);
      }
    });

    if (isAccomplice) {
      minFine = Math.floor(minFine / 2);
      maxFine = Math.floor(maxFine / 2);
      minJail = Math.floor(minJail / 2);
      maxJail = Math.floor(maxJail / 2);
    }

    return { minFine, maxFine, minJail, maxJail, warnings };
  }, [cart, isAccomplice]);

  useEffect(() => {
    setManualFine(stats.maxFine);
    setManualJail(stats.maxJail);
  }, [stats.maxFine, stats.maxJail]);

  // --- MŰVELETEK ---
  // Elfogadunk PenalCodeItem-et vagy Tetel-t is, és konvertáljuk
  const addItem = (item: PenalCodeItem | Tetel) => {
    const newItem: SelectedItem = {
      // Alapértelmezett értékek, ha Tetel-ként jönne
      id: (item as any).id || `gen-${Date.now()}-${Math.random()}`,
      kategoria_nev: (item as any).kategoria_nev || "Egyéb",
      isWarning: (item as any).isWarning || false,
      warningType: (item as any).warningType || "none",
      ...item,
      uniqueId: crypto.randomUUID()
    } as SelectedItem;

    setCart(prev => [...prev, newItem]);
    toast.success(`${item.rovidites || item.megnevezes} hozzáadva.`);
  };

  const removeItem = (uniqueId: string) => {
    setCart(prev => prev.filter(c => c.uniqueId !== uniqueId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    if (delta > 0) {
      const itemToClone = cart.find(c => c.id === itemId);
      if (itemToClone) {
        const newItem = { ...itemToClone, uniqueId: crypto.randomUUID() };
        setCart(prev => [...prev, newItem]);
      }
    } else {
      const indexToRemove = [...cart].reverse().findIndex(c => c.id === itemId);
      if (indexToRemove !== -1) {
        const realIndex = cart.length - 1 - indexToRemove;
        setCart(prev => prev.filter((_, i) => i !== realIndex));
      }
    }
  };

  const resetCalculator = () => {
    setCart([]);
    setSuspectName("");
    setSuspectId("");
    setIsAccomplice(false);
    setManualFine(0);
    setManualJail(0);
  };

  const toggleFavorite = (itemId: string) => {
    setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const commands = useMemo(() => {
    const fine = manualFine;
    const jail = manualJail;
    const id = suspectId.trim() || '[ID]';

    const groupedCounts: Record<string, number> = {};
    cart.forEach(item => {
      const key = item.rovidites || item.megnevezes;
      groupedCounts[key] = (groupedCounts[key] || 0) + 1;
    });

    const reasonStr = Object.entries(groupedCounts)
      .map(([name, count]) => `${name}${count > 1 ? ` (x${count})` : ''}`)
      .join(", ");

    let finalReason = reasonStr;
    if (isAccomplice) finalReason += " (Bűnrészesség)";
    if (!finalReason) finalReason = "Indoklás";

    return {
      ticket: `/ticket ${id} ${fine} ${finalReason}`,
      jail: `arrest ${id} ${jail} ${finalReason}`,
      mdc: `Vádak: ${finalReason} | Bírság: $${fine.toLocaleString()} | Börtön: ${jail} perc`
    };
  }, [cart, manualFine, manualJail, suspectId, isAccomplice]);

  const saveToHistory = () => {
    if (cart.length === 0) return;
    const newEntry: CalculatorState = {
      cart, suspectName, suspectId, isAccomplice,
      customFine: manualFine, customJail: manualJail,
      timestamp: new Date().toISOString()
    };

    if (history.length > 0) {
      const last = history[0];
      if (JSON.stringify(last.cart.map(c => c.id)) === JSON.stringify(cart.map(c => c.id)) && last.suspectId === suspectId) return;
    }

    const newHistory = [newEntry, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
  };

  const loadFromHistory = (entry: CalculatorState) => {
    setCart(entry.cart);
    setSuspectName(entry.suspectName);
    setSuspectId(entry.suspectId);
    setIsAccomplice(entry.isAccomplice);
    setManualFine(entry.customFine);
    setManualJail(entry.customJail);
  };

  return {
    cart, setCart,
    addItem, updateQuantity, removeItem, resetCalculator,
    suspectName, setSuspectName,
    suspectId, setSuspectId,
    isAccomplice, setIsAccomplice,
    manualFine, setManualFine,
    manualJail, setManualJail,
    stats,
    commands,
    saveToHistory,
    history,
    loadFromHistory,
    favorites, toggleFavorite
  };
}