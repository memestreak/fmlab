/** Called after a change with the new state and the one it replaced. */
export type Listener<T> = (state: T, previous: T) => void;

export interface Store<T> {
  get(): T;
  /** Merges `patch` into the state. Listeners hear only a real change. */
  set(patch: Partial<T>): void;
  /** Returns the function that stops the listening. */
  subscribe(listener: Listener<T>): () => void;
}

/**
 * A small subscribe/notify store. The state is replaced, never mutated, so
 * a listener can compare `state.x !== previous.x` to see what changed.
 * Listeners run synchronously inside `set`, which lets a click handler's
 * `set` start the audio while the browser still counts it as the user's
 * gesture.
 */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as (keyof T)[];
      if (keys.every(key => Object.is(patch[key], state[key]))) return;
      const previous = state;
      state = { ...state, ...patch };
      // A copy, so a listener may unsubscribe while being called.
      for (const listener of [...listeners]) listener(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
