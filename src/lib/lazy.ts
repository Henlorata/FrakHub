import {lazy, type ComponentType} from "react";

/**
 * Lazy pages and components. After a new deployment an open tab still runs the previous build,
 * whose chunks are gone, so the next lazy page or dialog fails to load (a network blip does the
 * same). The page then reloads once to pick up the new build; a failure within 10 seconds of that
 * reload surfaces as an error instead.
 *
 * While the reload is under way Vite resolves the failed import with `undefined` (that is what
 * preventing its `vite:preloadError` means): lazyComponent() keeps the loading fallback on screen
 * instead of crashing, and the error log ignores what breaks until the page is gone.
 */

const RELOAD_KEY = "frakhub:chunk-reload-at";
const RELOAD_GUARD_MS = 10_000;
let reloadStartedAt = 0;

/** A failed chunk is reloading the page (only for a while: a "leave the page?" prompt may keep it). */
export const reloadingPage = () => Date.now() - reloadStartedAt < RELOAD_GUARD_MS;

export function installChunkReload() {
  window.addEventListener("vite:preloadError", (event) => {
    const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - lastReload < RELOAD_GUARD_MS) return; // reloaded moments ago: let the error surface
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    event.preventDefault();
    reloadStartedAt = Date.now();
    window.location.reload();
  });
}

type PropsOf<C> = C extends ComponentType<infer P> ? P : never;

/** React.lazy for one export of a module: `lazyComponent(() => import("./CasePage"), "CasePage")`. */
export function lazyComponent<M extends object, K extends keyof M>(loader: () => Promise<M>, exportName: K) {
  return lazy(async () => {
    const module: M | undefined = await loader();
    // The chunk did not load and the page is reloading: keep the fallback until it is gone.
    if (module === undefined) return new Promise<never>(() => {});
    return {default: module[exportName] as ComponentType<PropsOf<M[K]>>};
  });
}
