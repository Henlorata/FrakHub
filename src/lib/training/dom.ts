/** DOM helpers of the tour: finding highlighted elements and closing what a step opened. */

const OPEN_LAYERS = "[role=dialog], [role=alertdialog], [role=menu], [data-radix-popper-content-wrapper]";

/** An open dialog, menu or popover of the page (the tour's own cards do not count). */
export const pageLayerOpen = () =>
  [...document.querySelectorAll(OPEN_LAYERS)].some((element) => !element.closest("[data-tour-overlay]"));

/** Closes open dialogs, menus and popovers (Radix closes on Escape). */
export function closeOverlays() {
  for (let attempt = 0; attempt < 3 && pageLayerOpen(); attempt += 1) {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", {key: "Escape", code: "Escape", bubbles: true, cancelable: true}),
    );
  }
}

/** Pop-ups the page can open: dialogs, menus, selects, popovers and the editor's menus. */
const POPUPS = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper], "
  + ".bn-suggestion-menu, .bn-formatting-toolbar, .mantine-Menu-dropdown, .mantine-Popover-dropdown";

/**
 * A pop-up the member opened from the highlighted area (a confirmation, a select, the editor's slash
 * menu): it may lie outside the highlight, so the tour lets it be used. A dialog that contains the
 * highlighted element (the step shows something inside it) does not count.
 */
export const popupOpenedFrom = (target: Element) =>
  [...document.querySelectorAll(POPUPS)].some((element) =>
    !element.closest("[data-tour-overlay]") && !element.contains(target) && isVisible(element));

export function isVisible(element: Element): boolean {
  if (!element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
}

/** The first visible element of the selectors (in order). */
export function findTarget(target: string | string[] | undefined): Element | null {
  if (!target) return null;
  for (const selector of Array.isArray(target) ? target : [target]) {
    for (const element of document.querySelectorAll(selector)) {
      if (isVisible(element)) return element;
    }
  }
  return null;
}
