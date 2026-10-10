import {useSyncExternalStore} from "react";

/**
 * Light rendering ("Kímélő megjelenítés", `html.lite` in index.css): the same look without what
 * keeps a phone's graphics chip busy on every frame: the frosted blur behind the panels (they are
 * nearly opaque anyway), the backdrop's moving glows, stars and grain, the light running along the
 * department star (which still turns, as one layer) and the front page's redrawn details. On by
 * itself on touch screens without a mouse (phones, tablets); each device can choose on the
 * profile's Fiók tab, kept in this browser only.
 */
export type DisplayMode = "auto" | "full" | "lite";

const KEY = "frakhub.display";
const TOUCH = "(hover: none) and (pointer: coarse)";
const listeners = new Set<() => void>();

function stored(): DisplayMode {
  try {
    const value = localStorage.getItem(KEY);
    return value === "full" || value === "lite" ? value : "auto";
  } catch {
    return "auto";
  }
}

let mode: DisplayMode = typeof localStorage === "undefined" ? "auto" : stored();

const touchScreen = () => typeof matchMedia === "function" && matchMedia(TOUCH).matches;

/** Whether this device draws the light version (with the given choice). */
export const isLite = (choice: DisplayMode = mode) => choice === "lite" || (choice === "auto" && touchScreen());

function apply() {
  document.documentElement.classList.toggle("lite", isLite());
  listeners.forEach((listener) => listener());
}

/** Applies the choice before the first render (main.tsx) and follows a changing device (a tablet with a mouse). */
export function installDisplayMode() {
  apply();
  if (typeof matchMedia === "function") matchMedia(TOUCH).addEventListener("change", apply);
}

export function setDisplayMode(next: DisplayMode) {
  mode = next;
  try {
    if (next === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, next);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
  apply();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The choice and whether this device draws the light version now. */
export function useDisplayMode() {
  const value = useSyncExternalStore(subscribe, () => `${mode}|${isLite() ? 1 : 0}`);
  const [choice, lite] = value.split("|");
  return {mode: choice as DisplayMode, lite: lite === "1"};
}
