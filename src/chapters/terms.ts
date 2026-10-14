// Every term the guide defines, in one place. A chapter puts a term's
// definition into its text with `define`, at the term's first use, and its
// formula into its maths panel with `formula`; later mentions are marked
// with `use`. The glossary lists the same entries, so the text and the
// glossary cannot drift apart. src/__tests__/chapters/terms.test.ts checks
// that each term is defined where it says, and not used before.

import type { SectionId } from './outline';

/** A defined term. */
export interface Term {
  /** As it appears in the text and the glossary; lower case unless a name. */
  name: string;
  /**
   * The definition: one plain sentence, containing `name` (in any case),
   * that reads as part of the chapter's text where it is defined. HTML.
   */
  plain: string;
  /** The formal definition, a formula for the chapter's maths panel. HTML. */
  formula?: string;
  /** The section that defines it. */
  section: SectionId;
  /**
   * The words that count as using the term, to check that no section uses
   * it before the one that defines it.
   */
  match: RegExp;
}

const v = (name: string) => `<var>${name}</var>`;
const sub = (name: string, index: string) => `<var>${name}</var><sub>${index}</sub>`;
const FC = sub('f', 'c');
const FM = sub('f', 'm');
const DF = `Δ${v('f')}`;

export const TERMS = {
  sineWave: {
    name: 'sine wave',
    plain: `A sine wave is the plainest sound there is: one pure tone, swinging
      evenly back and forth in the shape of the sine curve.`,
    formula: `${v('x')}(${v('t')}) = ${v('A')} sin(2π ${v('f')} ${v('t')})`,
    section: 'sine',
    match: /\bsine waves?\b/i,
  },
  carrier: {
    name: 'carrier',
    plain: `The carrier is the sine wave you hear; from the next section on, a
      second wave pushes it around.`,
    section: 'sine',
    match: /\bcarriers?\b/i,
  },
  frequency: {
    name: 'frequency',
    plain: `Frequency is how many times a second a wave repeats, counted in
      hertz (Hz), and you hear it as pitch.`,
    formula: `${v('f')} = 1 / ${v('T')}`,
    section: 'sine',
    match: /\bfrequenc(y|ies)\b|\bhertz\b/i,
  },
  octave: {
    name: 'octave',
    plain: `An octave is the step from one pitch to the pitch at twice its
      frequency.`,
    section: 'sine',
    match: /\boctaves?\b/i,
  },
  waveform: {
    name: 'waveform',
    plain: `A waveform is a sound drawn as its height against time.`,
    section: 'sine',
    match: /\bwaveforms?\b/i,
  },
  amplitude: {
    name: 'amplitude',
    plain: `Amplitude is how far a wave swings either side of zero, and you
      hear it as loudness.`,
    section: 'sine',
    match: /\bamplitudes?\b/i,
  },
  spectrum: {
    name: 'spectrum',
    plain: `A spectrum shows a sound as the sine waves it is made of: one stem
      for each, standing at that wave's frequency and as tall as its
      amplitude.`,
    section: 'sine',
    match: /\bspectr(um|a)\b/i,
  },
  partial: {
    name: 'partial',
    plain: `A partial is one of the sine waves a sound is made of, one stem in
      its spectrum.`,
    section: 'sine',
    match: /\bpartials?\b/i,
  },
  modulator: {
    name: 'modulator',
    plain: `The modulator is a second sine wave that pushes the carrier
      around; it is not heard itself, only in what it does to the
      carrier.`,
    section: 'vibrato',
    match: /\bmodulators?\b/i,
  },
  fm: {
    name: 'frequency modulation',
    plain: `Frequency modulation (FM) is one wave pushing another's frequency
      up and down.`,
    formula: `${v('f')}(${v('t')}) = ${FC} + ${DF} sin(2π ${FM} ${v('t')})`,
    section: 'vibrato',
    match: /\bfrequency modulation\b|\bFM\b/i,
  },
  vibrato: {
    name: 'vibrato',
    plain: `Vibrato is a slow, regular wobble in pitch.`,
    section: 'vibrato',
    match: /\bvibrato\b/i,
  },
  deviation: {
    name: 'deviation',
    plain: `Deviation is how far the modulator pushes the carrier's frequency
      each way, in Hz.`,
    section: 'vibrato',
    match: /\bdeviation\b/i,
  },
  sideband: {
    name: 'sideband',
    plain: `A sideband is a partial that modulation adds beside the carrier;
      sidebands come in pairs, one above it and one below, spaced apart by
      the modulator's frequency.`,
    formula: `${FC} ± ${v('n')} ${FM}, &ensp; ${v('n')} = 1, 2, 3, …`,
    section: 'vibrato',
    match: /\bsidebands?\b/i,
  },
  timbre: {
    name: 'timbre',
    plain: `Timbre is a sound's colour: what tells a flute from a violin
      playing the same note as loudly, set by which partials it has and
      how strong each is.`,
    section: 'vibrato',
    match: /\btimbres?\b/i,
  },
  phase: {
    name: 'phase',
    plain: `A wave's phase is how far through its cycle it is at a given
      moment, measured as an angle.`,
    section: 'index',
    match: /\bphases?\b/i,
  },
  radian: {
    name: 'radian',
    plain: `A radian is the unit that angle is counted in: a whole cycle is 2π
      radians, about 6.28.`,
    formula: `one cycle = 2π radians ≈ 6.28 radians`,
    section: 'index',
    match: /\bradians?\b/i,
  },
  pm: {
    name: 'phase modulation',
    plain: `Phase modulation (PM) is one wave pushing another's phase back and
      forth, rather than its frequency.`,
    formula: `${v('x')}(${v('t')}) = sin(2π ${FC} ${v('t')} + ${v('I')} sin 2π ${FM} ${v('t')})`,
    section: 'index',
    match: /\bphase modulation\b|\bPM\b/i,
  },
  index: {
    name: 'modulation index',
    plain: `The modulation index is how hard the modulator pushes: the
      furthest it moves the carrier's phase, in radians.`,
    formula: `${v('I')} = ${DF} / ${FM}`,
    section: 'index',
    match: /\bindex\b|\bindices\b/i,
  },
  harmonic: {
    name: 'harmonic',
    plain: `A harmonic is a partial at a whole-number multiple of a note's
      frequency: twice it, three times, four times and so on.`,
    formula: `${sub('f', v('k'))} = ${v('k')} ${v('f')}, &ensp; ${v('k')} = 1, 2, 3, …`,
    section: 'index',
    match: /\bharmonics?\b/i,
  },
  bandwidth: {
    name: 'bandwidth',
    plain: `A sound's bandwidth is the span of frequencies its partials
      cover.`,
    section: 'index',
    match: /\bbandwidths?\b/i,
  },
  carson: {
    name: "Carson's rule",
    plain: `Carson's rule says that nearly all of an FM sound's power lies in
      the index plus one sidebands each side of the carrier.`,
    formula: `${v('B')} ≈ 2 (${DF} + ${FM}) = 2 ${FM} (${v('I')} + 1)`,
    section: 'index',
    match: /\bCarson\b/i,
  },
  bessel: {
    name: 'Bessel function',
    plain: `A Bessel function, written ${sub('J', v('n'))}, gives the height of
      the <var>n</var>th pair of sidebands at every index, and
      ${sub('J', '0')} the carrier's.`,
    formula:
      `sin(2π ${FC} ${v('t')} + ${v('I')} sin 2π ${FM} ${v('t')}) = ` +
      `Σ ${sub('J', v('n'))}(${v('I')}) sin 2π (${FC} + ${v('n')} ${FM}) ${v('t')}`,
    section: 'sidebands',
    match: /\bBessel\b/i,
  },
  ratio: {
    name: 'ratio',
    plain: `The ratio is the modulator's frequency as a multiple of the
      carrier's.`,
    formula: `${v('r')} = ${FM} / ${FC}`,
    section: 'ratio',
    match: /\bratios?\b/i,
  },
  inharmonic: {
    name: 'inharmonic',
    plain: `Inharmonic partials are ones that are not whole-number multiples
      of any one note's frequency; they are heard as several pitches at
      once, as a bell or a gong is.`,
    section: 'ratio',
    match: /\binharmonic\b/i,
  },
  negativeFrequency: {
    name: 'negative frequency',
    plain: `A negative frequency is where a sideband counted down past zero
      would stand; it folds back, sounding the same distance above zero,
      upside down.`,
    formula: `sin(−${v('x')}) = −sin(${v('x')})`,
    section: 'ratio',
    match: /\bnegative frequenc|\bfold(s|ed|ing)?\b/i,
  },
  envelope: {
    name: 'envelope',
    plain: `An envelope is a note's shape over time: how its loudness, and
      anything else that follows it, rises and falls.`,
    formula:
      `${v('x')}(${v('t')}) = ${v('e')}(${v('t')}) ` +
      `sin(2π ${FC} ${v('t')} + ${v('I')} ${v('e')}(${v('t')}) sin 2π ${FM} ${v('t')})`,
    section: 'envelopes',
    match: /\benvelopes?\b/i,
  },
  adsr: {
    name: 'ADSR',
    plain: `ADSR names an envelope's four parts: attack, the time it takes to
      rise; decay, the time to settle to the sustain level; sustain, the
      level it holds while the note is held; and release, the time it
      takes to die away once the note is let go.`,
    section: 'envelopes',
    match: /\bADSR\b|\battack\b|\bsustain\b/i,
  },
  spectrogram: {
    name: 'spectrogram',
    plain: `A spectrogram is a spectrum drawn out over time: time runs left to
      right, frequency upward, and the stronger a partial is, the bolder
      its mark.`,
    section: 'envelopes',
    match: /\bspectrograms?\b/i,
  },
  operator: {
    name: 'operator',
    plain: `An operator is the DX7's name for one sine wave with its own
      frequency, level and envelope; any operator can be a carrier or a
      modulator.`,
    section: 'algorithms',
    match: /\boperators?\b/i,
  },
  stack: {
    name: 'stack',
    plain: `A stack is a column of operators, each modulating the one below
      it.`,
    section: 'algorithms',
    match: /\bstacks?\b/i,
  },
  feedback: {
    name: 'feedback',
    plain: `Feedback is an operator modulating itself: its own output is added
      back into its phase.`,
    section: 'algorithms',
    match: /\bfeedback\b|\bfeeds? back\b|\bfed back\b/i,
  },
  algorithm: {
    name: 'algorithm',
    plain: `An algorithm, on the DX7, is a fixed wiring diagram for its six
      operators: which modulate which, and which are heard.`,
    section: 'algorithms',
    match: /\balgorithms?\b/i,
  },
  fft: {
    name: 'fast Fourier transform',
    plain: `The fast Fourier transform (FFT) is the standard way to take a
      stretch of sound apart into the sine waves it is made of.`,
    section: 'algorithms',
    match: /\bFourier\b|\bFFT\b/i,
  },
} satisfies Record<string, Term>;

export type TermId = keyof typeof TERMS;

export const TERM_IDS = Object.keys(TERMS) as TermId[];

export function term(id: TermId): Term {
  return TERMS[id];
}

/** The terms in the glossary's order: alphabetical, ignoring case. */
export function glossaryOrder(): TermId[] {
  return [...TERM_IDS].sort((a, b) =>
    term(a).name.localeCompare(term(b).name, 'en', { sensitivity: 'base' }),
  );
}

/** The address of a term's glossary entry. */
export function glossaryHash(id: TermId): string {
  return `#/glossary?t=${id}`;
}

/** A term's text without its markup: for a tooltip or a screen reader. */
export function plainText(id: TermId): string {
  return term(id)
    .plain.replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A term marked in the text: a link to its glossary entry. */
function link(id: TermId, text: string): string {
  return (
    `<a class="term" href="${glossaryHash(id)}" data-term="${id}" ` +
    `aria-describedby="termdef-${id}">${text}</a>`
  );
}

/**
 * A term's definition, as a sentence of the chapter's text: the plain
 * definition with the term itself set as the defining instance, in bold.
 */
export function define(id: TermId): string {
  const { name, plain } = term(id);
  const at = plain.toLowerCase().indexOf(name.toLowerCase());
  if (at < 0) throw new Error(`The definition of ${id} does not name it.`);
  const said = plain.slice(at, at + name.length);
  return (
    plain.slice(0, at) +
    `<dfn data-defines="${id}">${link(id, said)}</dfn>` +
    plain.slice(at + name.length)
  ).replace(/\s+/g, ' ');
}

/** A later mention of a term, marked: `text` if the words differ. */
export function use(id: TermId, text: string = term(id).name): string {
  return link(id, text);
}

/** A term's formula, as a line of a maths panel. */
export function formula(id: TermId): string {
  const { formula: html } = term(id) as Term;
  if (!html) throw new Error(`${id} has no formula.`);
  return `<p class="formula">${html}</p>`;
}
