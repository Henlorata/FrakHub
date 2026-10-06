import {useCallback, useState} from "react";

/** useState persisted in localStorage (JSON). Corrupt or missing entries fall back to the initial value. */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((previous: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((previous: T) => T)) => {
    setStoredValue((previous) => {
      const next = typeof value === "function" ? (value as (previous: T) => T)(previous) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        console.error(error); // quota exceeded or storage disabled: keep the in-memory value
      }
      return next;
    });
  }, [key]);

  return [storedValue, setValue];
}