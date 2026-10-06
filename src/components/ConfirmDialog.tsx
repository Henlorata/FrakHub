import {createContext, useCallback, useContext, useRef, useState, type ReactNode} from "react";
import {AlertTriangle, HelpCircle, Trash2} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {cn} from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button and warning icon (deleting, discarding). */
  destructive?: boolean;
  /** "discard": unsaved changes; "delete": removal (picks the icon). */
  kind?: "delete" | "discard" | "question";
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * App-wide confirmation dialog: `await confirm({...})` instead of the browser's `window.confirm`,
 * in the app's own look. One dialog at a time; a second request waits for the first answer.
 */
export function ConfirmProvider({children}: {children: ReactNode}) {
  const [current, setCurrent] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const queue = useRef<{options: ConfirmOptions; resolve: (value: boolean) => void}[]>([]);

  const showNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) return;
    resolver.current = next.resolve;
    setCurrent(next.options);
  }, []);

  const confirm = useCallback<Confirm>((options) => new Promise<boolean>((resolve) => {
    queue.current.push({options, resolve});
    if (!resolver.current) showNext();
  }), [showNext]);

  const answer = (value: boolean) => {
    // The buttons and the dialog's own close both report: only the first answer counts.
    if (!resolver.current) return;
    resolver.current(value);
    resolver.current = null;
    setCurrent(null);
    // The next request opens after the closing animation.
    window.setTimeout(showNext, 160);
  };

  const Icon = current?.kind === "delete" ? Trash2 : current?.destructive || current?.kind === "discard" ? AlertTriangle : HelpCircle;
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!current} onOpenChange={(open) => !open && current && answer(false)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1",
                current?.destructive ? "bg-red-500/10 text-red-300 ring-red-500/30" : "bg-sky-500/10 text-sky-300 ring-sky-500/30")}>
                <Icon className="size-5"/>
              </span>
              <div className="min-w-0 space-y-1.5 text-left">
                <AlertDialogTitle>{current?.title}</AlertDialogTitle>
                {current?.description && (
                  <AlertDialogDescription asChild>
                    <div className="text-sm text-slate-400 wrap-anywhere">{current.description}</div>
                  </AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answer(false)}>{current?.cancelLabel ?? "Mégse"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => answer(true)}
                               className={current?.destructive ? "bg-red-600 text-white hover:bg-red-500" : undefined}>
              {current?.confirmLabel ?? "Rendben"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used within a ConfirmProvider");
  return confirm;
}

/** Shared wording for discarding unsaved changes. */
export const DISCARD_CHANGES: ConfirmOptions = {
  title: "Elveted a módosításokat?",
  description: "A mentetlen változások elvesznek.",
  confirmLabel: "Elvetés",
  cancelLabel: "Maradok",
  destructive: true,
  kind: "discard",
};
