import { screenGlitchOn } from '../model/settings';

// The sandbox's top screens glitch, briefly, as an analog display does,
// when what they show changes (Jeremy, 2026-10-21): a tab opened on the
// Voice screen or the operator panel, or a preset chosen (both screens at
// once, each its own kind, never the two alike). One of five, at random,
// never the same twice in a row on a screen. Only the glass moves: the canvas inside its bezel, by Web
// Animations on it or on an overlay over it, so nothing is drawn again
// and nothing in the layout moves. None under reduced motion, or with
// Screen glitch off (model/settings.ts).

export const GLITCHES = ['flash', 'refresh', 'jitter', 'tear', 'scanline'] as const;
export type Glitch = (typeof GLITCHES)[number];

/** How long each lasts, in ms. */
export const GLITCH_MS: Record<Glitch, number> = { flash: 180, refresh: 120, jitter: 130, tear: 190, scanline: 170 };

/**
 * The kind to play: any not in `exclude` (the screen's last, and on a
 * preset the other screen's pick), all those left alike, `random` in
 * [0, 1).
 */
export function nextGlitch(exclude: Iterable<Glitch | null>, random: number): Glitch {
  const avoid = new Set(exclude);
  const left = GLITCHES.filter(kind => !avoid.has(kind));
  return left[Math.min(left.length - 1, Math.floor(random * left.length))];
}

/**
 * The kinds for several screens changing at once, given what each played
 * last: each new to its screen, and no two alike.
 */
export function nextGlitches(previous: readonly (Glitch | null)[], random: () => number): Glitch[] {
  const picks: Glitch[] = [];
  for (const last of previous) picks.push(nextGlitch([last, ...picks], random()));
  return picks;
}

/** The two top screens, each with its own record of the kind played last. */
type Screen = 'voice' | 'operator';
const last: Record<Screen, Glitch | null> = { voice: null, operator: null };
const screenOf = (canvas: HTMLCanvasElement): Screen => (canvas.closest('#voice-envelope') ? 'operator' : 'voice');

/** What is running on a canvas, to be cancelled by the next change on it. */
const running = new Map<HTMLCanvasElement, () => void>();

/** Held: each keyframe's value stays until the next (not the whole effect's easing). */
const HELD = 'steps(1, end)';

/**
 * Plays a glitch on each of `canvases` (a tab's, or both top screens' on a
 * preset), each its own kind. Call it straight after the switch: nothing
 * waits for it.
 */
export function glitchScreens(canvases: readonly (HTMLCanvasElement | null)[]): void {
  const screens = canvases.filter((canvas): canvas is HTMLCanvasElement => canvas !== null && canvas.isConnected);
  // A new change cancels what is still running on these screens, and on
  // any no longer showing (the tab just closed): nothing stacks.
  for (const [canvas, stop] of [...running]) {
    if (screens.includes(canvas) || canvas.offsetParent === null) stop();
  }
  if (screens.length === 0 || !screenGlitchOn()) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const kinds = nextGlitches(
    screens.map(canvas => last[screenOf(canvas)]),
    Math.random,
  );
  screens.forEach((canvas, i) => {
    last[screenOf(canvas)] = kinds[i];
    play(kinds[i], canvas);
  });
}

/** The top screens' canvases showing now: the Voice tab's and the operator panel's. */
export function topScreens(): HTMLCanvasElement[] {
  const ids = ['algorithm-plot', 'inst-lfo-plot', 'inst-pitch-curve', 'voice-envelope-curve', 'voice-keys-curve'];
  return ids
    .map(id => document.getElementById(id))
    .filter((canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement && canvas.offsetParent !== null);
}

function play(kind: Glitch, canvas: HTMLCanvasElement): void {
  const duration = GLITCH_MS[kind];
  const animations: Animation[] = [];
  const overlays: HTMLElement[] = [];
  let frame = 0;
  const stop = () => {
    for (const animation of animations) animation.cancel();
    for (const overlay of overlays) overlay.remove();
    cancelAnimationFrame(frame);
    if (running.get(canvas) === stop) running.delete(canvas);
  };
  running.set(canvas, stop);
  const animate = (element: Element, keyframes: Keyframe[], easing = 'linear') => {
    const animation = element.animate(keyframes, { duration, easing });
    animations.push(animation);
    return animation;
  };
  /** An overlay over the glass, removed when it ends. */
  const overlay = () => {
    const element = document.createElement('div');
    element.className = 'screen-glitch';
    element.setAttribute('aria-hidden', 'true');
    canvas.parentElement?.append(element);
    overlays.push(element);
    return element;
  };

  let main: Animation;
  if (kind === 'flash') {
    main = animate(canvas, [{ filter: 'brightness(2)' }, { filter: 'brightness(1)' }], 'cubic-bezier(.2, .7, .3, 1)');
  } else if (kind === 'jitter') {
    main = animate(canvas, [
      { transform: 'translate(2px, 0)', easing: HELD },
      { transform: 'translate(-1px, 1px)', easing: HELD },
      { transform: 'translate(1px, -1px)', easing: HELD },
      { transform: 'translate(-1px, 0)', easing: HELD },
      { transform: 'translate(0, 0)' },
    ]);
  } else if (kind === 'scanline') {
    const lines = overlay();
    lines.classList.add('screen-glitch-scan');
    main = animate(
      lines,
      [0.9, 0.15, 0.7, 0.1, 0.45, 0].map((opacity, i) => ({ opacity, offset: i / 5, easing: HELD })),
    );
  } else if (kind === 'refresh') {
    // The new picture written in from the top in eight rows: a cover of
    // plain glass going, a row at a time, and the write head on its edge.
    const box = overlay();
    const cover = document.createElement('div');
    cover.className = 'screen-glitch-cover';
    cover.style.background = glassOf(canvas);
    const head = document.createElement('div');
    head.className = 'screen-glitch-head';
    box.append(cover, head);
    const rows = Array.from({ length: 9 }, (_, i) => i / 8);
    main = animate(
      cover,
      rows.map(at => ({ clipPath: `inset(${at * 100}% 0 0 0)`, offset: at, easing: HELD })),
    );
    animate(
      head,
      rows.map(at => ({ top: `${at * 100}%`, opacity: at === 1 ? 0 : 1, offset: at, easing: HELD })),
    );
  } else {
    // A thin slice of the picture, shifted sideways, running down once.
    const box = overlay();
    const glass = canvas.getBoundingClientRect();
    const slice = Math.max(5, Math.round(glass.height * 0.035));
    const band = document.createElement('div');
    band.className = 'screen-glitch-band';
    band.style.background = glassOf(canvas);
    const copy = document.createElement('canvas');
    copy.className = 'screen-glitch-copy';
    copy.width = canvas.width;
    copy.height = canvas.height;
    band.append(copy);
    const line = document.createElement('div');
    line.className = 'screen-glitch-tear';
    box.append(band, line);
    const from = -slice;
    const to = glass.height;
    main = animate(band, [
      { clipPath: `inset(${from}px 0 calc(100% - ${from + slice}px) 0)` },
      { clipPath: `inset(${to}px 0 calc(100% - ${to + slice}px) 0)` },
    ]);
    animate(line, [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }]);
    const context = copy.getContext('2d');
    const draw = () => {
      context?.clearRect(0, 0, copy.width, copy.height);
      context?.drawImage(canvas, 0, 0);
      frame = requestAnimationFrame(draw);
    };
    draw();
  }
  main.addEventListener('finish', stop);
}

/** Plain glass: the canvas's own background, or the screens' from the tokens. */
function glassOf(canvas: HTMLCanvasElement): string {
  const image = getComputedStyle(canvas).backgroundImage;
  return image && image !== 'none' ? image : 'radial-gradient(ellipse at 50% 40%, var(--vfd-glass-1), var(--vfd-glass-2))';
}
