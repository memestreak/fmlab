import { parseScreenGlitch, SCREEN_GLITCH_KEY, saveScreenGlitch, screenGlitchOn } from '../../model/settings';
import { GLITCH_MS, GLITCHES, type Glitch, nextGlitch } from '../../ui/screenGlitch';

describe('the screen glitch', () => {
  it('is one of five, each 120 to 190 ms', () => {
    expect(GLITCHES).toEqual(['flash', 'refresh', 'jitter', 'tear', 'scanline']);
    for (const kind of GLITCHES) {
      expect(GLITCH_MS[kind]).toBeGreaterThanOrEqual(120);
      expect(GLITCH_MS[kind]).toBeLessThanOrEqual(190);
    }
  });

  it('never plays the same kind twice in a row, and every kind comes up', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const seen = new Map<Glitch, number>();
    let previous: Glitch | null = null;
    for (let i = 0; i < 4000; i++) {
      const kind = nextGlitch(previous, random());
      expect(kind).not.toBe(previous);
      seen.set(kind, (seen.get(kind) ?? 0) + 1);
      previous = kind;
    }
    // All five, about as often as each other.
    expect([...seen.keys()].sort()).toEqual([...GLITCHES].sort());
    for (const count of seen.values()) expect(count).toBeGreaterThan(650);
  });

  it('picks evenly from the other four', () => {
    expect([0, 0.25, 0.5, 0.75, 0.999].map(r => nextGlitch('flash', r))).toEqual([
      'refresh',
      'jitter',
      'tear',
      'scanline',
      'scanline',
    ]);
    // The first, with none before it, from all five.
    expect(nextGlitch(null, 0.99)).toBe('scanline');
  });
});

describe('the Screen glitch setting', () => {
  /** A localStorage of our own: Node 22 has none. */
  const storage = (items: Record<string, string> = {}) => ({
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => {
      items[key] = value;
    },
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is on unless saved off', () => {
    expect(SCREEN_GLITCH_KEY).toBe('fmlab.screenGlitch');
    vi.stubGlobal('localStorage', storage());
    expect(screenGlitchOn()).toBe(true);
    saveScreenGlitch(false);
    expect(localStorage.getItem(SCREEN_GLITCH_KEY)).toBe('off');
    expect(screenGlitchOn()).toBe(false);
    saveScreenGlitch(true);
    expect(screenGlitchOn()).toBe(true);
    expect(parseScreenGlitch('nonsense')).toBe(true);
  });

  it('is on when storage cannot be read, unless turned off this visit', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', blocked);
    saveScreenGlitch(true);
    expect(screenGlitchOn()).toBe(true);
    saveScreenGlitch(false);
    expect(screenGlitchOn()).toBe(false);
  });
});
