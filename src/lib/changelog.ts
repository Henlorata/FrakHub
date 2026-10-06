import {useSyncExternalStore} from "react";
import {CHANGELOG_SEEN_KEY, LATEST_RELEASE} from "@/data/changelog";

/**
 * Whether the member has seen the latest release notes (this browser). Shared by the dashboard
 * strip and the account menu, so dismissing one updates the other at once.
 */

const listeners = new Set<() => void>();

const read = () => {
  try {
    return window.localStorage.getItem(CHANGELOG_SEEN_KEY);
  } catch {
    return null;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function markChangelogSeen() {
  try {
    window.localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_RELEASE.id);
  } catch {
    // Storage disabled: the strip simply comes back next time.
  }
  listeners.forEach((listener) => listener());
}

export function useChangelogUnseen(): boolean {
  return useSyncExternalStore(subscribe, read, () => LATEST_RELEASE.id) !== LATEST_RELEASE.id;
}
