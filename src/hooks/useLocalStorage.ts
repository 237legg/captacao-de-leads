"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

function readValue<T>(source: string | null | undefined, initial: T, parse?: (raw: unknown) => T): T {
  if (source === null || source === undefined) return initial;
  try {
    const json: unknown = JSON.parse(source);
    return parse ? parse(json) : (json as T);
  } catch {
    return initial;
  }
}

/**
 * Estado persistido em localStorage, seguro para SSR (useSyncExternalStore).
 * IMPORTANTE: `initial` e `parse` devem ser referências estáveis (constantes de módulo).
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse?: (raw: unknown) => T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => window.localStorage.getItem(key),
    () => undefined,
  );
  const hydrated = raw !== undefined;

  const value = useMemo(() => readValue(raw, initial, parse), [raw, initial, parse]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readValue(window.localStorage.getItem(key), initial, parse);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* quota excedida — ignora */
      }
      notify();
    },
    [key, initial, parse],
  );

  return [value, setValue, hydrated];
}
