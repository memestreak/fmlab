import { createLabStore } from '../../model/lab';
import { createKeyBed, isMidi, KeyHolders } from '../../ui/keyBed';

describe('the keys held from every source', () => {
  it('sound a pitch while anything holds it, in the order they went in', () => {
    const keys = new KeyHolders();
    expect(keys.press(60, 'key')).toEqual({ entered: true, left: false });
    expect(keys.press(64, 'midi:a')).toEqual({ entered: true, left: false });
    // The same pitch from the screen and from MIDI: one note.
    expect(keys.press(60, 'midi:a')).toEqual({ entered: false, left: false });
    expect(keys.held()).toEqual([60, 64]);
    expect(keys.release(60, 'key')).toEqual({ entered: false, left: false });
    expect(keys.has(60)).toBe(true);
    expect(keys.release(60, 'midi:a')).toEqual({ entered: false, left: true });
    expect(keys.held()).toEqual([64]);
    // Letting go what was never held does nothing.
    expect(keys.release(64, 'pointer')).toEqual({ entered: false, left: false });
    expect(keys.held()).toEqual([64]);
  });

  it('keep two MIDI inputs\' holds of one pitch apart', () => {
    const keys = new KeyHolders();
    keys.press(62, 'midi:a');
    keys.press(62, 'midi:b');
    keys.release(62, 'midi:a');
    expect(keys.has(62)).toBe(true);
    keys.release(62, 'midi:b');
    expect(keys.has(62)).toBe(false);
  });

  it('sustain MIDI notes let go while a pedal is down, until it is lifted', () => {
    const keys = new KeyHolders();
    keys.pedal('a', true);
    keys.press(60, 'midi:a');
    keys.press(64, 'midi:a');
    expect(keys.release(60, 'midi:a')).toEqual({ entered: false, left: false });
    expect(keys.has(60)).toBe(true);
    expect(keys.holds(60)).toBe(false);
    // Played again under the pedal: held anew, so the lift keeps it.
    keys.release(64, 'midi:a');
    keys.press(64, 'midi:a');
    expect(keys.pedal('a', false)).toEqual([60]);
    expect(keys.held()).toEqual([64]);
  });

  it('do not sustain the computer\'s or the pointer\'s keys', () => {
    const keys = new KeyHolders();
    keys.pedal('a', true);
    keys.press(60, 'key');
    keys.press(62, 'pointer');
    expect(keys.release(60, 'key').left).toBe(true);
    expect(keys.release(62, 'pointer').left).toBe(true);
    expect(keys.held()).toEqual([]);
  });

  it('keep sustaining while any input\'s pedal is down', () => {
    const keys = new KeyHolders();
    keys.pedal('a', true);
    keys.pedal('b', true);
    keys.press(60, 'midi:a');
    keys.release(60, 'midi:a');
    expect(keys.pedal('a', false)).toEqual([]);
    expect(keys.has(60)).toBe(true);
    expect(keys.pedal('b', false)).toEqual([60]);
  });

  it('on blur let go only the computer\'s and the pointer\'s keys', () => {
    const keys = new KeyHolders();
    keys.press(60, 'key');
    keys.press(62, 'pointer');
    keys.press(64, 'midi:a');
    keys.press(60, 'midi:a');
    expect(keys.releaseWhere(holder => !isMidi(holder))).toEqual([62]);
    expect(keys.held()).toEqual([60, 64]);
  });

  it('on an input unplugged let go only its notes, its pedal and what that pedal kept', () => {
    const keys = new KeyHolders();
    keys.pedal('a', true);
    keys.press(60, 'midi:a');
    keys.release(60, 'midi:a');
    keys.press(62, 'midi:a');
    keys.press(64, 'midi:b');
    keys.press(65, 'key');
    expect(keys.releaseWhere(holder => holder === 'midi:a', 'a').sort()).toEqual([60, 62]);
    expect(keys.held()).toEqual([64, 65]);
    // Its pedal is up: another input's note let go now comes out.
    expect(keys.release(64, 'midi:b').left).toBe(true);
  });

  it('with MIDI off let go every MIDI note and pedal, and keep the rest', () => {
    const keys = new KeyHolders();
    keys.pedal('a', true);
    keys.press(60, 'midi:a');
    keys.release(60, 'midi:a');
    keys.press(62, 'midi:b');
    keys.press(64, 'key');
    keys.press(64, 'midi:a');
    expect(keys.releaseMidi().sort()).toEqual([60, 62]);
    expect(keys.held()).toEqual([64]);
    expect(keys.release(64, 'key').left).toBe(true);
  });
});

describe('the key bed', () => {
  it('keeps the store\'s held and the figures\' note with the holders', () => {
    const store = createLabStore();
    const bed = createKeyBed(store);
    bed.press(69, 'midi:a', 37);
    expect(store.get().held).toEqual([69]);
    expect(store.get().carrierHz).toBeCloseTo(440, 6);
    expect(store.get().noteLength).toBe(Infinity);
    // The note's velocity, for the figures (Jeremy, 2026-10-24).
    expect(store.get().noteVelocity).toBe(37);
    bed.press(69, 'key', 100);
    bed.release(69, 'midi:a');
    expect(store.get().held).toEqual([69]);
    bed.release(69, 'key');
    expect(store.get().held).toEqual([]);
    expect(store.get().noteLength).toBeLessThan(Infinity);
  });

  it('lets everything go on Stop', () => {
    const store = createLabStore();
    const bed = createKeyBed(store);
    bed.pedal('a', true);
    bed.press(60, 'midi:a', 100);
    bed.release(60, 'midi:a');
    bed.press(62, 'key', 100);
    store.set({ stops: store.get().stops + 1 });
    expect(store.get().held).toEqual([]);
    expect(bed.has(60)).toBe(false);
  });

  it('tells its listeners after every change', () => {
    const store = createLabStore();
    const bed = createKeyBed(store);
    let calls = 0;
    bed.onChange(() => calls++);
    bed.press(60, 'pointer', 100);
    bed.release(60, 'pointer');
    expect(calls).toBe(2);
  });
});
