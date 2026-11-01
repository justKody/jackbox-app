import { useSyncExternalStore } from 'react';

/** A value that lives outside React; any component or module can read, change or watch it. */
export type Store<T> = { get: () => T; set: (next: T) => void; subscribe: (listener: () => void) => () => void };

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Re-renders whenever the store changes. */
export function useStore<T>(store: Store<T>) {
  return useSyncExternalStore(store.subscribe, store.get);
}
