import {useCallback, useState} from "react";

/**
 * State with undo and redo (drawing editors). `set` records a step; `replace` changes the current
 * value without one (live dragging, then one `commit` when the drag ends).
 */
export function useUndoable<T>(initial: T | (() => T), limit = 80) {
  const [state, setState] = useState(() => ({
    past: [] as T[],
    present: typeof initial === "function" ? (initial as () => T)() : initial,
    future: [] as T[],
    // The value before a live change (a drag), recorded by commit().
    pending: null as T | null,
  }));

  const set = useCallback((next: T | ((current: T) => T)) => setState((current) => {
    const value = typeof next === "function" ? (next as (current: T) => T)(current.present) : next;
    if (Object.is(value, current.present)) return current;
    return {past: [...current.past, current.pending ?? current.present].slice(-limit), present: value, future: [], pending: null};
  }), [limit]);

  const replace = useCallback((next: T | ((current: T) => T)) => setState((current) => {
    const value = typeof next === "function" ? (next as (current: T) => T)(current.present) : next;
    return {...current, present: value, pending: current.pending ?? current.present};
  }), []);

  const commit = useCallback(() => setState((current) => current.pending === null ? current
    : {past: [...current.past, current.pending].slice(-limit), present: current.present, future: [], pending: null}), [limit]);

  const undo = useCallback(() => setState((current) => {
    if (current.past.length === 0) return current;
    return {past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future], pending: null};
  }), []);

  const redo = useCallback(() => setState((current) => {
    if (current.future.length === 0) return current;
    return {past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1), pending: null};
  }), []);

  return {
    value: state.present, set, replace, commit, undo, redo,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0,
  };
}
