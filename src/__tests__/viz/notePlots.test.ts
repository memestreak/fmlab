import { chapterById, CHAPTERS } from '../../chapters';
import { BASE_PATCH } from '../../chapters/basePatch';
import { noteSeconds } from '../../dsp/envelope';
import {
  ATTACK,
  clamp,
  DECAY,
  DEFAULTS,
  envelopeOf,
  INDEX,
  type LabState,
  noteProgress,
  RATIO,
  RELEASE,
  SUSTAIN,
} from '../../model/lab';
import {
  describeEnvelope,
  describeSpectrogram,
  noteHasPlayhead,
} from '../../ui/figures';
import { formatSeconds } from '../../ui/sliders';
import { playLabel, pressPlay, spaceIsFree } from '../../ui/transport';
import {
  dragHandle,
  envelopeSpan,
  handleAt,
  handles,
} from '../../viz/envelopePlot';
import { plotArea, shareToY } from '../../viz/plot';
import { boldness, FLOOR_DB, sliceAt } from '../../viz/spectrogramPlot';
import { noteAxisEnd, secondsTicks } from '../../viz/ticks';

/**
 * A state with a note started at `at` on the page's clock, as the engine
 * leaves it: with the note's length fixed from the patch at that moment.
 */
const started = (state: LabState, at: number): LabState => ({
  ...state,
  noteStartedAt: at,
  noteLength: noteSeconds(envelopeOf(state)),
});

const chapter6 = chapterById('envelopes')!;
/** Chapter 6 as it opens: Chowning's brass. */
const brass: LabState = { ...DEFAULTS, ...chapter6.patch };
const bell: LabState = { ...brass, ...chapter6.presets[1].patch };

// The envelope canvas at the size the lab pane gives it on a desktop.
const WIDTH = 660;
const HEIGHT = 264;
const AREA = plotArea(WIDTH, HEIGHT);
/** The pixel for a time and level on that canvas, showing `state`. */
const pixel = (state: LabState, time: number, level: number) => ({
  x: AREA.left + (time / envelopeSpan(state)) * (AREA.right - AREA.left),
  y: shareToY(AREA, level),
});

describe('the time axis of a note', () => {
  it('ends at the next round length', () => {
    expect(noteAxisEnd(0.75)).toBe(1);
    expect(noteAxisEnd(1)).toBe(1);
    expect(noteAxisEnd(1.01)).toBe(2);
    expect(noteAxisEnd(5.5)).toBe(10);
    expect(noteAxisEnd(0.2)).toBe(0.5);
  });

  it('is long enough for both presets', () => {
    expect(envelopeSpan(brass)).toBe(1);
    expect(envelopeSpan(bell)).toBe(10);
    for (const state of [brass, bell]) {
      expect(envelopeSpan(state)).toBeGreaterThanOrEqual(noteSeconds(envelopeOf(state)));
    }
  });

  it('is numbered in round seconds', () => {
    expect(secondsTicks(1).map(tick => tick.label)).toEqual(
      ['0', '0.2', '0.4', '0.6', '0.8', '1'],
    );
    expect(secondsTicks(10).map(tick => tick.label)).toEqual(
      ['0', '2', '4', '6', '8', '10'],
    );
    expect(secondsTicks(0.5).map(tick => tick.label)).toEqual(
      ['0', '0.1', '0.2', '0.3', '0.4', '0.5'],
    );
  });
});

describe('the envelope figure\'s handles', () => {
  it('sit at the peak, where the decay settles, and where the note ends', () => {
    expect(handles(envelopeOf(brass))).toEqual({
      attack: { time: 0.1, level: 1 },
      sustain: { time: 0.2, level: 0.75 },
      release: { time: 0.75, level: 0 },
    });
  });

  it('are found by a pointer on or near them', () => {
    const peak = pixel(brass, 0.1, 1);
    expect(handleAt(brass, WIDTH, HEIGHT, peak.x, peak.y)).toBe('attack');
    expect(handleAt(brass, WIDTH, HEIGHT, peak.x + 6, peak.y + 6)).toBe('attack');
    const settled = pixel(brass, 0.2, 0.75);
    expect(handleAt(brass, WIDTH, HEIGHT, settled.x, settled.y)).toBe('sustain');
    const end = pixel(brass, 0.75, 0);
    expect(handleAt(brass, WIDTH, HEIGHT, end.x, end.y)).toBe('release');
  });

  it('are not found from far away', () => {
    const empty = pixel(brass, 0.5, 0.3);
    expect(handleAt(brass, WIDTH, HEIGHT, empty.x, empty.y)).toBeNull();
  });

  it('give the nearer handle where two are close', () => {
    // The bell's attack is 5 ms: its peak is almost at the left edge, far
    // from where its decay settles.
    const peak = pixel(bell, 0.005, 1);
    expect(handleAt(bell, WIDTH, HEIGHT, peak.x, peak.y)).toBe('attack');
  });
});

describe('dragging a handle', () => {
  it('sets the attack from where the peak is dragged to', () => {
    const to = pixel(brass, 0.3, 0.2);
    expect(dragHandle(brass, 'attack', WIDTH, HEIGHT, to.x, to.y)).toEqual({
      attack: 0.3,
    });
  });

  it('sets the decay and the sustain level together', () => {
    const to = pixel(brass, 0.4, 0.5);
    expect(dragHandle(brass, 'sustain', WIDTH, HEIGHT, to.x, to.y)).toEqual({
      decay: 0.3,
      sustain: 0.5,
    });
  });

  it('sets the release from where the end is dragged to', () => {
    const to = pixel(brass, 0.9, 0);
    expect(dragHandle(brass, 'release', WIDTH, HEIGHT, to.x, to.y)).toEqual({
      release: 0.3,
    });
  });

  it('stops at the ends of each slider\'s range', () => {
    const far = { x: AREA.left - 80, y: AREA.bottom + 80 };
    expect(dragHandle(brass, 'attack', WIDTH, HEIGHT, far.x, far.y)).toEqual({
      attack: ATTACK.min,
    });
    expect(dragHandle(brass, 'sustain', WIDTH, HEIGHT, far.x, far.y)).toEqual({
      decay: DECAY.min,
      sustain: SUSTAIN.min,
    });
    expect(dragHandle(brass, 'release', WIDTH, HEIGHT, far.x, far.y)).toEqual({
      release: RELEASE.min,
    });
    const above = pixel(brass, 0.4, 1.4);
    expect(
      dragHandle(brass, 'sustain', WIDTH, HEIGHT, above.x, above.y).sustain,
    ).toBe(1);
  });

  it('cannot make the note longer than the axis it is drawn on', () => {
    const edge = { x: AREA.right + 200, y: AREA.bottom };
    const dragged = { ...brass, ...dragHandle(brass, 'release', WIDTH, HEIGHT, edge.x, edge.y) };
    expect(noteSeconds(envelopeOf(dragged))).toBeLessThanOrEqual(envelopeSpan(brass) + 1e-9);
    expect(envelopeSpan(dragged)).toBe(envelopeSpan(brass));
  });

  it('leaves the handle under the pointer', () => {
    const to = pixel(brass, 0.4, 0.5);
    const dragged = { ...brass, ...dragHandle(brass, 'sustain', WIDTH, HEIGHT, to.x, to.y) };
    expect(handleAt(dragged, WIDTH, HEIGHT, to.x, to.y)).toBe('sustain');
  });
});

describe('the playhead', () => {
  const sounding = started({ ...brass }, 100);

  it('is how far into the last note a moment is', () => {
    expect(noteProgress(sounding, 100.25)).toBeCloseTo(0.25, 9);
    expect(noteProgress(sounding, 100)).toBe(0);
  });

  it('is nowhere before the note starts or after it is over', () => {
    expect(noteProgress(sounding, 99.99)).toBeNull();
    expect(noteProgress(sounding, 100.76)).toBeNull();
  });

  it('is nowhere when no note has been played, or no time is given', () => {
    expect(noteProgress(brass, 100.25)).toBeNull();
    expect(noteProgress(sounding, undefined)).toBeNull();
  });

  it('moves the figures only while a note sounds, and never under reduced motion', () => {
    expect(noteHasPlayhead(sounding, 100.25, false)).toBe(true);
    expect(noteHasPlayhead(sounding, 101, false)).toBe(false);
    expect(noteHasPlayhead(brass, 100.25, false)).toBe(false);
    expect(noteHasPlayhead(sounding, 100.25, true)).toBe(false);
  });

  // The frame a note is asked for in is timed a few ms before the note's
  // start (it starts after a short lead). The figures must keep redrawing
  // through that instant, or the playhead never appears.
  it('keeps the figures redrawing in the instant before the note starts', () => {
    expect(noteProgress(sounding, 99.985)).toBeNull();
    expect(noteHasPlayhead(sounding, 99.985, false)).toBe(true);
  });
});

describe('the spectrogram', () => {
  it('draws full strength boldest and the floor not at all', () => {
    expect(boldness(1)).toBe(1);
    expect(boldness(10 ** (FLOOR_DB / 20))).toBeCloseTo(0, 9);
    expect(boldness(10 ** (FLOOR_DB / 40))).toBeCloseTo(0.5, 9);
    expect(boldness(0)).toBe(0);
    expect(boldness(1e-9)).toBe(0);
    expect(boldness(3)).toBe(1);
  });

  it('is empty before the note and at its very start', () => {
    expect(sliceAt(brass, 0).marks).toEqual([]);
    expect(sliceAt(brass, -0.1).marks).toEqual([]);
  });

  it('grows partials as the envelope rises, and loses them as it falls', () => {
    const early = sliceAt(brass, 0.01).marks.length;
    const peak = sliceAt(brass, 0.1).marks.length;
    const late = sliceAt(brass, 0.74).marks.length;
    expect(peak).toBeGreaterThan(early);
    expect(peak).toBeGreaterThan(late);
    expect(early).toBeGreaterThan(0);
  });

  it('keeps the same partials all through when the index does not follow', () => {
    const steady = { ...brass, indexFollows: false };
    const freqs = (time: number) =>
      sliceAt(steady, time).marks.map(mark => mark.freq);
    // Held at the sustain level either side, so equally loud: the same
    // partials, where with the index following there are fewer.
    expect(freqs(0.5)).toEqual(freqs(0.3));
    expect(sliceAt(steady, 0.5).marks.length).toBeGreaterThan(
      sliceAt(brass, 0.5).marks.length,
    );
  });

  it('puts brass on the harmonics and the bell between them', () => {
    const onHarmonic = (freq: number) => Math.abs(freq - Math.round(freq)) < 1e-6;
    expect(sliceAt(brass, 0.1).marks.every(mark => onHarmonic(mark.freq))).toBe(true);
    expect(sliceAt(bell, 0.5).marks.some(mark => !onHarmonic(mark.freq))).toBe(true);
  });

  it('is described by its length and its partials', () => {
    const text = describeSpectrogram(brass);
    expect(text).toContain('a 0.75 s note at ratio 1.00');
    expect(text).toMatch(/\d+ partials at its peak/);
  });
});

describe('describing the envelope', () => {
  it('names every time, and what the index does', () => {
    expect(describeEnvelope(brass)).toBe(
      'Envelope: attack 0.10 s, decay 0.10 s, sustain 75%, let go after 0.60 s, ' +
        'release 0.15 s; the index follows it up to 5.00.',
    );
    expect(describeEnvelope({ ...brass, indexFollows: false })).toContain(
      'the index stays at 5.00',
    );
  });

  it('gives a short time its thousandths', () => {
    expect(formatSeconds(0.005)).toBe('0.005 s');
    expect(formatSeconds(0.1)).toBe('0.10 s');
    expect(formatSeconds(5)).toBe('5.00 s');
  });
});

describe('the main button', () => {
  it('starts and stops a steady sound', () => {
    expect(playLabel(DEFAULTS, 0)).toBe('Play');
    expect(pressPlay(DEFAULTS, 0)).toEqual({ playing: true });
    const playing = { ...DEFAULTS, playing: true };
    expect(playLabel(playing, 0)).toBe('Stop');
    expect(pressPlay(playing, 0)).toEqual({ playing: false });
  });

  it('plays one more note in a chapter that plays notes', () => {
    expect(playLabel(brass, 0)).toBe('Play note');
    expect(pressPlay(brass, 0)).toEqual({ notes: 1 });
    expect(pressPlay({ ...brass, notes: 4 }, 0)).toEqual({ notes: 5 });
  });

  it('answers to the space bar, except where space has a use of its own', () => {
    // An element is all `closest` here: does a selector list match it?
    const element = (matches: boolean) =>
      ({ closest: () => (matches ? {} : null) }) as unknown as Element;
    expect(spaceIsFree(element(false))).toBe(true);
    expect(spaceIsFree(element(true))).toBe(false);
    expect(spaceIsFree(null)).toBe(true);
  });
});

describe('chapter 5, the ratio', () => {
  const chapter = chapterById('ratio')!;

  it('rules the harmonics on its spectrum, and is the only one to', () => {
    expect(CHAPTERS.filter(c => c.patch.showHarmonics).map(c => c.id)).toEqual(['ratio']);
  });

  it('offers the ratio and the index, and four ratios to try', () => {
    expect(chapter.controls).toEqual(['volume', 'ratio', 'index']);
    expect(chapter.presets.map(preset => preset.label)).toEqual(
      ['1:1', '1:2', '1:3', '1:1.41'],
    );
    expect(chapter.presets.map(preset => preset.patch.ratio)).toEqual([1, 2, 3, 1.414]);
  });

  it('keeps every preset inside the Ratio slider', () => {
    for (const { patch } of chapter.presets) {
      expect(clamp(patch.ratio!, RATIO)).toBe(patch.ratio);
    }
  });
});

describe('chapter 6, the envelope', () => {
  it('plays notes, as chapter 8 does too', () => {
    expect(CHAPTERS.filter(c => c.patch.noteMode).map(c => c.id)).toEqual(['envelopes', 'algorithms', 'sandbox']);
    expect(BASE_PATCH.noteMode).toBe(false);
  });

  it('shows the envelope and the spectrogram', () => {
    expect(Object.keys(chapter6.figures)).toEqual(['envelope', 'spectrogram']);
  });

  it('opens on brass: 1:1, the index following the envelope', () => {
    expect(brass).toMatchObject({ ratio: 1, index: 5, hold: 0.6, indexFollows: true });
    expect(chapter6.presets.map(preset => preset.label)).toEqual(['Brass', 'Bell']);
  });

  it('has a bell that is not harmonic and rings for seconds', () => {
    expect(bell.ratio).toBe(1.4);
    expect(bell.sustain).toBe(0);
    expect(noteSeconds(envelopeOf(bell))).toBeGreaterThan(5);
  });

  it('keeps both presets inside every slider it shows', () => {
    for (const state of [brass, bell]) {
      expect(clamp(state.index, INDEX)).toBe(state.index);
      expect(clamp(state.attack, ATTACK)).toBe(state.attack);
      expect(clamp(state.decay, DECAY)).toBe(state.decay);
      expect(clamp(state.sustain, SUSTAIN)).toBe(state.sustain);
      expect(clamp(state.release, RELEASE)).toBe(state.release);
    }
  });
});
