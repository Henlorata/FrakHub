import {useCallback, useState} from "react";
import {useSearchParams} from "react-router";

/**
 * Dialog state that can also be opened by a URL flag (e.g. `/logistics?new=1` from the
 * quick search). Closing the dialog removes the flag, so a reload does not reopen it.
 */
export function useDialogParam(param: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localOpen, setLocalOpen] = useState(false);
  const fromUrl = searchParams.has(param);

  const setOpen = useCallback((open: boolean) => {
    setLocalOpen(open);
    if (!open && fromUrl) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete(param);
        return next;
      }, {replace: true});
    }
  }, [fromUrl, param, setSearchParams]);

  return [localOpen || fromUrl, setOpen] as const;
}
