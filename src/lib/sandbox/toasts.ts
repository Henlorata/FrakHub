import {toast} from "sonner";

let original: typeof toast.success | null = null;

/**
 * In practice mode the pages' success messages ("Mindenki értesítést kapott") get a note that
 * nothing really happened.
 */
export function markPracticeToasts(on: boolean) {
  if (on && !original) {
    const success = toast.success;
    original = success;
    toast.success = ((message, data) => success(message, {description: "Gyakorló mód: csak a bemutató adatokban történt meg.", ...data})) as typeof toast.success;
  } else if (!on && original) {
    toast.success = original;
    original = null;
  }
}
