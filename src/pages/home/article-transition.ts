import type {MouseEvent} from "react";
import type {NavigateFunction} from "react-router";
import type {NewsItem} from "@/lib/site";

/**
 * Opening an article from a card: the card's picture and title grow into the article's header
 * (a same-document View Transition). The article page renders its header at once from the card's
 * data (router state `preview`), so the morph never waits for the network. Without View
 * Transitions, with reduced motion or a modified click it is a normal link.
 */

/** The article page's code; loaded ahead when a card is pointed at or focused. */
export const loadArticlePage = () => import("./NewsArticlePage");

export interface ArticlePreviewState {
  preview?: NewsItem;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => {finished: Promise<void>; ready: Promise<void>};
};

const canMorph = () => typeof document !== "undefined" && typeof (document as TransitionDocument).startViewTransition === "function"
  && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Resolves once `selector` is in the page, or after `timeout` ms. Watches the DOM, not animation
 * frames: the browser pauses rendering (and requestAnimationFrame) while a transition's update runs.
 */
function waitFor(selector: string, timeout: number) {
  return new Promise<void>((resolve) => {
    let observer: MutationObserver | null = null;
    const finish = () => {
      observer?.disconnect();
      window.clearTimeout(limit);
      // A moment for the page's own effects (scrolling to the top) before the new state is captured.
      window.setTimeout(resolve, 20);
    };
    const limit = window.setTimeout(finish, timeout);
    if (document.querySelector(selector)) return finish();
    observer = new MutationObserver(() => {
      if (document.querySelector(selector)) finish();
    });
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ["data-article-ready"]});
  });
}

export function openArticle(event: MouseEvent<HTMLAnchorElement>, item: NewsItem, navigate: NavigateFunction) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !canMorph()) return;
  event.preventDefault();
  const card = event.currentTarget;
  const to = `/news/${item.slug}`;
  void loadArticlePage().then(() => {
    // Only the clicked card may carry the names (an open article's header gives them up).
    document.querySelectorAll("[data-morph-target]").forEach((element) => element.removeAttribute("data-morph-target"));
    const parts = [...card.querySelectorAll<HTMLElement>("[data-morph]")];
    for (const part of parts) part.style.viewTransitionName = `news-${part.dataset.morph}`;
    const transition = (document as TransitionDocument).startViewTransition!(async () => {
      navigate(to, {state: {preview: item} satisfies ArticlePreviewState});
      await waitFor(`[data-article-ready="${CSS.escape(item.slug)}"]`, 1500);
    });
    // A skipped transition (another one started) rejects `ready`; the navigation still happens.
    transition.ready.catch(() => undefined);
    void transition.finished.finally(() => {
      for (const part of parts) part.style.removeProperty("view-transition-name");
    });
  }, () => navigate(to, {state: {preview: item} satisfies ArticlePreviewState}));
}
