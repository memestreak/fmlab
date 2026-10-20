// Every term the guide defines, in one place. A chapter writes its own
// sentence defining a term, in its own words and after the reader has
// heard or seen the thing, and marks the term there with `define`; its
// formula goes into the maths panel with `formula`, and later mentions are
// marked with `use`. The glossary lists the same entries with their
// `plain` sentences, which only the glossary and the tips show.
// src/__tests__/chapters/terms.test.ts checks that each term is defined
// where it says, and not used before.

import type { SectionId } from './outline';

/** A defined term. */
export interface Term {
  /** As it appears in the text and the glossary; lower case unless a name. */
  name: string;
  /**
   * The definition: one plain sentence, containing `name` (in any case),
   * for the glossary and the term's tip. The chapter's text says it its
   * own way. HTML.
   */
  plain: string;
  /** The formal definition, a formula for the chapter's maths panel. HTML. */
  formula?: string;
  /** The section that defines it. */
  section: SectionId;
  /** Its article on English Wikipedia, as in the article's address. */
  wiki?: string;
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
    wiki: 'Sine_wave',
    match: /\bsine waves?\b/i,
  },
  carrier: {
    name: 'carrier',
    plain: `The carrier is the sine wave you hear, pushed around by a second
      wave, the modulator.`,
    section: 'vibrato',
    wiki: 'Frequency_modulation_synthesis',
    match: /\bcarriers?\b/i,
  },
  frequency: {
    name: 'frequency',
    plain: `Frequency is how many times a second a wave repeats, counted in
      hertz (Hz), and you hear it as pitch.`,
    formula: `${v('f')} = 1 / ${v('T')}`,
    section: 'sine',
    wiki: 'Frequency',
    match: /\bfrequenc(y|ies)\b|\bhertz\b/i,
  },
  octave: {
    name: 'octave',
    plain: `An octave is the step from one pitch to the pitch at twice its
      frequency.`,
    section: 'sine',
    wiki: 'Octave',
    match: /\boctaves?\b/i,
  },
  waveform: {
    name: 'waveform',
    plain: `A waveform is a sound drawn as its height against time.`,
    section: 'sine',
    wiki: 'Waveform',
    match: /\bwaveforms?\b/i,
  },
  amplitude: {
    name: 'amplitude',
    plain: `Amplitude is how far a wave swings either side of zero, and you
      hear it as loudness.`,
    section: 'sine',
    wiki: 'Amplitude',
    match: /\bamplitudes?\b/i,
  },
  spectrum: {
    name: 'spectrum',
    plain: `A spectrum shows a sound as the sine waves it is made of: one stem
      for each, standing at that wave's frequency and as tall as its
      amplitude.`,
    section: 'sine',
    wiki: 'Frequency_domain',
    match: /\bspectr(um|a)\b/i,
  },
  partial: {
    name: 'partial',
    plain: `A partial is one of the sine waves a sound is made of, one stem in
      its spectrum.`,
    section: 'sine',
    wiki: 'Overtone',
    match: /\bpartials?\b/i,
  },
  modulator: {
    name: 'modulator',
    plain: `The modulator is a second sine wave that pushes the carrier
      around; it is not heard itself, only in what it does to the
      carrier.`,
    section: 'vibrato',
    wiki: 'Frequency_modulation_synthesis',
    match: /\bmodulators?\b/i,
  },
  fm: {
    name: 'frequency modulation',
    plain: `Frequency modulation (FM) is one wave pushing another's frequency
      up and down.`,
    formula: `${v('f')}(${v('t')}) = ${FC} + ${DF} sin(2π ${FM} ${v('t')})`,
    section: 'vibrato',
    wiki: 'Frequency_modulation',
    match: /\bfrequency modulation\b|\bFM\b/i,
  },
  vibrato: {
    name: 'vibrato',
    plain: `Vibrato is a slow, regular wobble in pitch.`,
    section: 'vibrato',
    wiki: 'Vibrato',
    match: /\bvibrato\b/i,
  },
  deviation: {
    name: 'deviation',
    plain: `Deviation is how far the modulator pushes the carrier's frequency
      each way, in Hz.`,
    section: 'vibrato',
    wiki: 'Frequency_deviation',
    match: /\bdeviation\b/i,
  },
  sideband: {
    name: 'sideband',
    plain: `A sideband is a partial that modulation adds beside the carrier;
      sidebands come in pairs, one above it and one below, spaced apart by
      the modulator's frequency.`,
    formula: `${FC} ± ${v('n')} ${FM}, &ensp; ${v('n')} = 1, 2, 3, …`,
    section: 'vibrato',
    wiki: 'Sideband',
    match: /\bsidebands?\b/i,
  },
  timbre: {
    name: 'timbre',
    plain: `Timbre is a sound's colour: what tells a flute from a violin
      playing the same note as loudly, set by which partials it has and
      how strong each is.`,
    section: 'vibrato',
    wiki: 'Timbre',
    match: /\btimbres?\b/i,
  },
  phase: {
    name: 'phase',
    plain: `A wave's phase is how far through its cycle it is at a given
      moment, measured as an angle.`,
    section: 'fm-vs-pm',
    wiki: 'Phase_(waves)',
    match: /\bphases?\b/i,
  },
  radian: {
    name: 'radian',
    plain: `A radian is the unit that angle is counted in: a whole cycle is 2π
      radians, about 6.28.`,
    formula: `one cycle = 2π radians ≈ 6.28 radians`,
    section: 'fm-vs-pm',
    wiki: 'Radian',
    match: /\bradians?\b/i,
  },
  pm: {
    name: 'phase modulation',
    plain: `Phase modulation (PM) is one wave pushing another's phase back and
      forth, rather than its frequency.`,
    formula: `${v('x')}(${v('t')}) = sin(2π ${FC} ${v('t')} + ${v('I')} sin 2π ${FM} ${v('t')})`,
    section: 'fm-vs-pm',
    wiki: 'Phase_modulation',
    match: /\bphase modulation\b|\bPM\b/i,
  },
  index: {
    name: 'modulation index',
    plain: `The modulation index is how hard the modulator pushes: its
      deviation divided by its own frequency.`,
    formula: `${v('I')} = ${DF} / ${FM}`,
    section: 'index',
    wiki: 'Modulation_index',
    match: /\bindex\b|\bindices\b/i,
  },
  harmonic: {
    name: 'harmonic',
    plain: `A harmonic is a partial at a whole-number multiple of a note's
      frequency: twice it, three times, four times and so on.`,
    formula: `${sub('f', v('k'))} = ${v('k')} ${v('f')}, &ensp; ${v('k')} = 1, 2, 3, …`,
    section: 'index',
    wiki: 'Harmonic',
    match: /\bharmonics?\b/i,
  },
  bandwidth: {
    name: 'bandwidth',
    plain: `A sound's bandwidth is the span of frequencies its partials
      cover.`,
    section: 'index',
    wiki: 'Bandwidth_(signal_processing)',
    match: /\bbandwidths?\b/i,
  },
  carson: {
    name: "Carson's rule",
    plain: `Carson's rule says that nearly all of an FM sound's power lies in
      the index plus one sidebands each side of the carrier.`,
    formula: `${v('B')} ≈ 2 (${DF} + ${FM}) = 2 ${FM} (${v('I')} + 1)`,
    section: 'index',
    wiki: 'Carson_bandwidth_rule',
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
    wiki: 'Bessel_function',
    match: /\bBessel\b/i,
  },
  ratio: {
    name: 'ratio',
    plain: `The ratio is the modulator's frequency as a multiple of the
      carrier's.`,
    formula: `${v('r')} = ${FM} / ${FC}`,
    section: 'ratio',
    wiki: 'Frequency_modulation_synthesis',
    match: /\bratios?\b/i,
  },
  inharmonic: {
    name: 'inharmonic',
    plain: `Inharmonic partials are ones that are not whole-number multiples
      of any one note's frequency; they are heard as several pitches at
      once, as a bell or a gong is.`,
    section: 'ratio',
    wiki: 'Inharmonicity',
    match: /\binharmonic\b/i,
  },
  negativeFrequency: {
    name: 'negative frequency',
    plain: `A negative frequency is where a sideband counted down past zero
      would stand; it folds back, sounding the same distance above zero,
      upside down.`,
    formula: `sin(−${v('x')}) = −sin(${v('x')})`,
    section: 'ratio',
    wiki: 'Negative_frequency',
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
    wiki: 'Envelope_(music)',
    match: /\benvelopes?\b/i,
  },
  adsr: {
    name: 'ADSR',
    plain: `ADSR names an envelope's four parts: attack, the time it takes to
      rise; decay, the time to settle to the sustain level; sustain, the
      level it holds while the note is held; and release, the time it
      takes to die away once the note is let go.`,
    section: 'envelopes',
    wiki: 'Envelope_(music)',
    match: /\bADSR\b|\battack\b|\bsustain\b/i,
  },
  spectrogram: {
    name: 'spectrogram',
    plain: `A spectrogram is a spectrum drawn out over time: time runs left to
      right, frequency upward, and the stronger a partial is, the bolder
      its mark.`,
    section: 'envelopes',
    wiki: 'Spectrogram',
    match: /\bspectrograms?\b/i,
  },
  operator: {
    name: 'operator',
    plain: `An operator is the DX7's name for one sine wave with its own
      frequency, level and envelope; any operator can be a carrier or a
      modulator.`,
    section: 'algorithms',
    wiki: 'Frequency_modulation_synthesis',
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
    plain: `Feedback is an operator modulating itself: its own output goes
      back in as its modulator.`,
    section: 'algorithms',
    wiki: 'Frequency_modulation_synthesis',
    match: /\bfeedback\b|\bfeeds? back\b|\bfed back\b/i,
  },
  algorithm: {
    name: 'algorithm',
    plain: `An algorithm, on the DX7, is a fixed wiring diagram for its six
      operators: which modulate which, and which are heard.`,
    section: 'algorithms',
    wiki: 'Frequency_modulation_synthesis',
    match: /\balgorithms?\b/i,
  },
  voice: {
    name: 'voice',
    plain: `A voice is the DX7's name for one whole sound, stored and called up
      together: the algorithm, the feedback and every setting of its six
      operators.`,
    section: 'dx7-voice',
    match: /\bvoices?\b/i,
  },
  decibel: {
    name: 'decibel',
    plain: `The decibel (dB) measures a level against full level: 0 dB is
      full, each 6 dB down halves it, and 20 dB down is a tenth of it.`,
    formula: `${v('L')} = 20 log<sub>10</sub> ${v('A')}, &ensp; ${v('A')} = 10<sup>${v('L')} / 20</sup>`,
    section: 'dx7-voice',
    wiki: 'Decibel',
    match: /\bdecibels?\b|\bdB\b/,
  },
  peakLevel: {
    name: 'Peak',
    plain: `Peak is the level a DX7 envelope rises to over its attack, in dB
      against the operator's own level.`,
    section: 'dx7-voice',
    match: /\bPeak\b/,
  },
  decay1: {
    name: 'Decay 1',
    plain: `Decay 1 is the time a DX7 envelope takes to go from its Peak
      level to its Break level, the first of its two decays.`,
    section: 'dx7-voice',
    match: /\bDecay 1\b/,
  },
  breakLevel: {
    name: 'Break',
    plain: `Break is the level where a DX7 envelope's first decay ends and its
      second begins.`,
    section: 'dx7-voice',
    match: /\bBreak\b/,
  },
  decay2: {
    name: 'Decay 2',
    plain: `Decay 2 is the time a DX7 envelope takes to go from its Break
      level to its sustain level, the second of its two decays.`,
    section: 'dx7-voice',
    match: /\bDecay 2\b/,
  },
  detune: {
    name: 'detune',
    plain: `An operator's detune puts it a few cents sharp or flat of its
      ratio, a cent being a hundredth of a semitone.`,
    formula: `${v('r')}′ = ${v('r')} × 2<sup>${v('c')} / 1200</sup>`,
    section: 'dx7-voice',
    wiki: 'Cent_(music)',
    match: /\bdetun(e|es|ed|ing)\b/i,
  },
  beating: {
    name: 'beating',
    plain: `Beating is the swell and fade of two tones at nearly the same
      frequency, as many times a second as their frequencies differ.`,
    formula: `${sub('f', 'beat')} = |${sub('f', '1')} − ${sub('f', '2')}|`,
    section: 'dx7-voice',
    wiki: 'Beat_(acoustics)',
    match: /\bbeat(s|ing)?\b/i,
  },
  keyboardScaling: {
    name: 'keyboard scaling',
    plain: `Keyboard scaling changes an operator key by key: its level louder
      or quieter away from a break point, and its envelope faster up the
      keyboard.`,
    section: 'dx7-voice',
    match: /\bkeyboard scaling\b/i,
  },
  breakPoint: {
    name: 'break point',
    plain: `The break point is the key keyboard scaling works out from, each
      side of it with its own curve.`,
    section: 'dx7-voice',
    match: /\bbreak points?\b/i,
  },
  lfo: {
    name: 'LFO',
    plain: `An LFO is a slow oscillator, below the pitches we hear, that moves
      another setting up and down.`,
    section: 'dx7-voice',
    wiki: 'Low-frequency_oscillation',
    match: /\bLFOs?\b/,
  },
  tremolo: {
    name: 'tremolo',
    plain: `Tremolo is a regular rise and fall in loudness.`,
    section: 'dx7-voice',
    wiki: 'Tremolo',
    match: /\btremolo\b/i,
  },
  pitchEnvelope: {
    name: 'pitch envelope',
    plain: `A pitch envelope is an envelope that bends a note's pitch over
      time instead of its loudness.`,
    section: 'dx7-voice',
    match: /\bpitch envelopes?\b/i,
  },
  fft: {
    name: 'fast Fourier transform',
    plain: `The fast Fourier transform (FFT) is the standard way to take a
      stretch of sound apart into the sine waves it is made of.`,
    section: 'sine',
    wiki: 'Fast_Fourier_transform',
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
 * A term where the chapter's text defines it, as the defining instance,
 * in bold: `text` if the words differ ("harmonics"). The sentence round
 * it is the chapter's own.
 */
export function define(id: TermId, text: string = term(id).name): string {
  return `<dfn data-defines="${id}">${link(id, text)}</dfn>`;
}

/**
 * A link to an article on English Wikipedia, opening in a new tab and
 * marked ↗. The lesson text links only proper nouns this way and maths
 * panels where a formula appears; every other term links to the glossary.
 */
export function wikipedia(article: string, text: string): string {
  return (
    `<a class="external" href="https://en.wikipedia.org/wiki/${article}" ` +
    `target="_blank" rel="noopener">${text}<span class="external-mark" ` +
    `aria-hidden="true">↗</span><span class="visually-hidden"> ` +
    `(opens in a new tab)</span></a>`
  );
}

/** A term's Wikipedia link for its glossary entry; empty if it has none. */
export function wikiLink(id: TermId): string {
  const { wiki } = term(id) as Term;
  return wiki ? wikipedia(wiki, 'Wikipedia') : '';
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
