/**
 * A tab left open across a deploy keeps running the previous build, and the files only that build
 * knew may be gone (an emblem that moved, a renamed chunk). When the tab comes back into view, the
 * build id in /version.json is compared with this build's (at most every 10 minutes, never polled);
 * after a newer deploy the next page change loads it (AppLayout).
 */

const CHECK_EVERY_MS = 10 * 60_000;
let lastCheck = 0;
let newer = false;

/** A newer build was deployed since this tab loaded. */
export const newBuildDeployed = () => newer;

export async function checkForNewBuild(): Promise<boolean> {
  if (import.meta.env.DEV || newer || Date.now() - lastCheck < CHECK_EVERY_MS) return newer;
  lastCheck = Date.now();
  try {
    const response = await fetch("/version.json", {cache: "no-store"});
    if (response.ok) {
      const {build} = (await response.json()) as {build?: unknown};
      newer = typeof build === "string" && build !== __APP_BUILD__;
    }
  } catch {
    // Offline or blocked: the next time the tab is shown.
  }
  return newer;
}
