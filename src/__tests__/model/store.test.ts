import { createStore } from '../../model/store';

describe('createStore', () => {
  it('starts with the state it was given', () => {
    const store = createStore({ a: 1, b: 'x' });
    expect(store.get()).toEqual({ a: 1, b: 'x' });
  });

  it('merges a patch and leaves the rest alone', () => {
    const store = createStore({ a: 1, b: 'x' });
    store.set({ a: 2 });
    expect(store.get()).toEqual({ a: 2, b: 'x' });
  });

  it('replaces the state rather than mutating it', () => {
    const store = createStore({ a: 1 });
    const before = store.get();
    store.set({ a: 2 });
    expect(before).toEqual({ a: 1 });
    expect(store.get()).not.toBe(before);
  });

  it('tells a listener the new state and the one before', () => {
    const store = createStore({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ b: 'y' });
    expect(listener).toHaveBeenCalledExactlyOnceWith(
      { a: 1, b: 'y' },
      { a: 1, b: 'x' },
    );
  });

  it('notifies inside set, not later', () => {
    const store = createStore({ a: 1 });
    let heard = false;
    store.subscribe(() => {
      heard = true;
    });
    store.set({ a: 2 });
    expect(heard).toBe(true);
  });

  it('says nothing when a patch changes nothing', () => {
    const store = createStore({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ a: 1 });
    store.set({});
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a listener that unsubscribed', () => {
    const store = createStore({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('lets a listener unsubscribe while it is being called', () => {
    const store = createStore({ a: 1 });
    const second = vi.fn();
    const unsubscribe = store.subscribe(() => unsubscribe());
    store.subscribe(second);
    store.set({ a: 2 });
    store.set({ a: 3 });
    expect(second).toHaveBeenCalledTimes(2);
  });
});
