import type {Profile} from "@/types/supabase";
import type {TrainingId} from "./catalog";

/** What the user has to do before the tour moves on. */
export type StepAction =
  /** Press the highlighted element (a button, tab or link). */
  | {type: "click"; hint?: string}
  /** Do something (type, choose, open) until `done()` holds; checked on every change of the page. */
  | {type: "wait"; hint: string; done: () => boolean};

export interface TourStep {
  /** Chapter shown above the title ("Kalkulátor", "Akták", ...). */
  chapter: string;
  title: string;
  /** One or two short sentences. `**bold**` is highlighted. */
  body: string;
  /** Open this page first (path with query string). */
  route?: string;
  /**
   * Element to highlight (CSS selector); several selectors = the first visible one (e.g. the sidebar on
   * desktop, the menu button on phones). Without a target the card is centred.
   */
  target?: string | string[];
  action?: StepAction;
  placement?: "top" | "bottom" | "left" | "right";
  /** The highlighted area can be used (forms, editors) while the card shows. */
  interactive?: boolean;
  /** Space around the highlighted element (px). */
  padding?: number;
  /** Only for some members (e.g. a step about a button only staff have). */
  when?: (profile: Profile) => boolean;
  /** Close open dialogs and menus before the step (the previous step opened one). */
  closeOverlays?: boolean;
}

export interface TrainingScript {
  id: TrainingId;
  steps: TourStep[];
}
