import { BASE_PATCH } from './basePatch';
import { type Dx7Envelope, type Dx7Operator, heldOperator } from '../dsp/dx7';
import { define, formula, use, wikipedia } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter, ChapterPatch, Preset } from './types';

// The words the sandbox's DX7 voice (dsp/dx7.ts) puts on screen, defined
// before the sandbox: levels in dB, the envelope's seven knobs, detune and
// beating, keyboard scaling. Every preset is algorithm 5, three pairs side
// by side, with only the operators it needs switched on, so the diagram
// stays put while the presets change the sound.

/** An envelope: attack, peak, decay 1, break, decay 2, sustain, release. */
const env = (
  attack: number,
  peak: number,
  decay1: number,
  brk: number,
  decay2: number,
  sustain: number,
  release: number,
): Dx7Envelope => ({ attack, peak, decay1, brk, decay2, sustain, release });

/** An operator, held and unscaled unless `rest` says otherwise. */
const op = (ratio: number, level: number | null, rest: Partial<Dx7Operator> = {}): Dx7Operator => ({
  ...heldOperator(ratio, level),
  ...rest,
});

const OFF = op(1, null);

/** OP2 on OP1, held: OP2 at -12 dB, a quarter of full, an index of about 3.2. */
const HELD: Partial<ChapterPatch> = {
  algorithm: 5,
  dxFeedback: 0,
  carrierHz: 220,
  dxOperators: [op(1, 0), op(1, -12), OFF, OFF, OFF, OFF],
};

/**
 * The pair struck: a quick fall to the break, then a slow one. OP2 falls
 * further than OP1, so the note grows plainer as it fades.
 */
const STRUCK: Partial<ChapterPatch> = {
  algorithm: 5,
  dxFeedback: 0,
  carrierHz: 220,
  dxOperators: [
    op(1, 0, { envelope: env(0.002, 0, 0.15, -10, 3, -40, 0.5) }),
    op(1, -6, { envelope: env(0.002, 0, 0.1, -12, 1.5, -36, 0.3) }),
    OFF,
    OFF,
    OFF,
    OFF,
  ],
};

/** Two pairs at ratio 1, OP1 6 cents flat and OP3 6 sharp: 12 cents apart. */
const DETUNED: Partial<ChapterPatch> = {
  algorithm: 5,
  dxFeedback: 0,
  carrierHz: 220,
  dxOperators: [
    op(1, 0, { detune: -6 }),
    op(1, -20),
    op(1, 0, { detune: 6 }),
    op(1, -20),
    OFF,
    OFF,
  ],
};

/**
 * A struck pair with keyboard scaling: from middle C up, OP2 3 dB quieter
 * every three semitones, and both envelopes 1.42 times as fast an octave up.
 */
const scaled = (carrierHz: number): Partial<ChapterPatch> => ({
  algorithm: 5,
  dxFeedback: 0,
  carrierHz,
  dxOperators: [
    op(1, 0, { envelope: env(0.002, 0, 0.6, -8, 6, -60, 0.8), rateScaling: 1.42 }),
    op(1, -6, {
      envelope: env(0.002, 0, 0.4, -10, 4, -50, 0.6),
      rateScaling: 1.42,
      breakKey: 60,
      right: { curve: 'lin', depth: -3 },
    }),
    OFF,
    OFF,
    OFF,
    OFF,
  ],
});

const PRESETS: Preset[] = [
  { label: 'Held', hint: 'a held pair, its modulator at −12 dB', patch: HELD },
  { label: 'Struck', hint: 'the pair with two decays: a quick fall, then a slow one', patch: STRUCK },
  { label: 'Detuned pair', hint: 'two pairs 12 cents apart, beating', patch: DETUNED },
  { label: 'Low note', hint: 'a voice with keyboard scaling, played at A2', patch: scaled(110) },
  { label: 'High note', hint: 'the same voice played at A5', patch: scaled(880) },
];

export const dx7Voice: Chapter = {
  id: 'dx7-voice',
  title: titleOf('dx7-voice'),
  body: [
    `In ${sectionLink('algorithms')} an operator had three settings: a
     ratio, a level and how long it took to die away. The DX7 gives each
     one a good many more, and ${sectionLink('sandbox', 'the sandbox')}
     has them all. Everything that makes one of its sounds, the algorithm,
     the feedback and all six operators' settings, is stored together and
     called up at a button: the DX7 calls that a ${define('voice')}. The
     buttons in the lab are voices. Press one, then Play note (or space).
     The diagram, Fig. 1, is algorithm 5 for all of them, three pairs side
     by side, with only the operators each one needs switched on.`,
    `An operator's level is no longer a percentage but is counted in
     ${define('decibel', 'decibels')} (dB), because the ear hears equal
     ratios of level as equal steps. 0 dB is full level and the numbers
     below it are negative: each 6 dB down halves the level, and 20 dB down
     is a tenth of it. The DX7 goes down to −72 dB, about a four-thousandth,
     and below that an operator is off. For a modulator, full level is now
     an index of about 12.6, the DX7's own scale, where
     ${sectionLink('algorithms')} used 5. So in Held, OP2 at −12 dB, a
     quarter of full, is an index of about 3.2.`,
    `Each operator also has an ${use('envelope')} of its own, with more
     parts than ${use('adsr')}. Press Struck and play it: the note jumps out
     and falls away quickly, then keeps on fading, more slowly, for a few
     seconds. On a key the envelope rises over the attack, a time, to its
     ${define('peakLevel', 'Peak')}, a level in decibels: 0 dB is the
     operator's own level, and anything below it quieter.`,
    `Where ADSR has one decay, the DX7 has two, and that is what you heard.
     The first, ${define('decay1', 'Decay 1')}, is the time the envelope
     takes to fall from Peak to a second level, or to rise to it if that
     level is higher. In Struck, OP1 falls 10 dB in 0.15 seconds.`,
    `That second level is the ${define('breakLevel', 'Break')}, where the
     quick fall hands over to a slower one. OP2's Break is lower than
     OP1's, so the modulator fades faster than the carrier, and the note
     grows plainer as well as quieter.`,
    `The second decay, ${define('decay2', 'Decay 2')}, is the time from
     the Break to the sustain level, which the envelope holds for as long
     as the key is down. Let go, and it falls to silence over Release: the
     time a fall from full level would take, so less from lower down. Each
     decay is a straight line in decibels, which the ear hears as an even
     fade. The sandbox draws each envelope with its parts marked A, D1,
     D2, S and R, and sets each with a knob of the same name.`,
    `An operator can also be put slightly out of tune. Its
     ${define('detune')} puts it a few cents (¢) sharp or flat of its
     ratio, a cent being a hundredth of a semitone. The DX7 allows about six either
     way, too little to hear in an operator on its own.`,
    `Against another operator at the same ratio, though, it is easy to
     hear. Press Detuned pair: OP1 is 6 cents flat and OP3 6 cents sharp,
     12 cents apart, and together they swell and fade about one and a half
     times a second. That is ${define('beating')}: two sine waves at nearly
     the same frequency drift in and out of ${use('phase')}, adding up and
     then cancelling, as many times a second as their frequencies differ.
     The spectrum, Fig. 2, draws them as one stem, too close together to
     part; your ear hears one note that breathes. A little detune is much
     of what makes the DX7's E.PIANO 1, in the sandbox, shimmer.`,
    `Real instruments do not sound the same all the way up: a piano's high
     notes are thinner than its low ones, and die away sooner. The DX7 copies
     this with ${define('keyboardScaling')}, which makes an operator louder
     or quieter key by key, and can make its envelope run faster up the
     keyboard, up to 1.83 times as fast each octave. Press Low note and
     High note and play each: the same voice, its modulator quieter and its
     envelope quicker on the higher key, so the high note is plainer and
     shorter. Watch the spectrum's sidebands thin out.`,
    `Level scaling works outward from one key, the
     ${define('breakPoint')}: each side of it gets its own curve, linear (an even
     slope, of up to about 6 dB every three semitones) or exponential
     (starting gently and then steepening). Here the break point is middle C, and only
     the side above it slopes, down.`,
    `An ${define('lfo', 'LFO')}, a low-frequency oscillator, is a wave too
     slow to hear as a note, from one cycle in fifteen seconds to two dozen
     a second. The DX7 has one for the whole instrument, so every note you
     hold moves with it together. Turned to pitch it is ${use('vibrato')}:
     all six operators bend together, so the note's pitch swings and its
     timbre stays the same.`,
    `Turned to level it is ${define('tremolo')}: the LFO pulls levels down
     and back, and each operator takes as much of that as you give it. On a
     carrier you hear the note grow softer and louder; on a modulator it is
     the index that moves, and the note grows darker and brighter. A delay
     holds both back each time a key goes down, then fades them in.`,
    `Each note can also bend. The DX7's ${define('pitchEnvelope', 'pitch envelope')},
     which it calls the pitch EG (for envelope generator), has the same
     parts as an operator's ${use('envelope')}, but moves the pitch of all
     six operators together instead of their levels: up to four octaves
     either way, from where it starts at the key down, through its peak and
     break to a pitch it holds, and back at the key up. Unlike the LFO,
     every note runs its own. Most factory voices that use it bend only a
     third of a semitone for a few thousandths of a second at the attack;
     TAKE OFF uses all of it, sweeping down and up by octaves.`,
    `None of these numbers can be changed in this section; in
     ${sectionLink('sandbox', 'the sandbox')} every one of them can, and a
     keyboard plays the voice at every pitch.`,
  ],
  maths: [
    {
      title: 'Levels in decibels',
      body: [
        `A level <var>L</var> in ${wikipedia('Decibel', 'decibels')} and an
         amplitude <var>A</var>, as a fraction of full, are`,
        formula('decibel'),
        `so 10<sup>−6/20</sup> ≈ 0.501 (each 6 dB halves) and
         10<sup>−20/20</sup> = 0.1. A modulator at level <var>L</var>
         modulates by an index of`,
        `<p class="formula"><var>I</var> = 4π × 10<sup><var>L</var> / 20</sup></p>`,
        `4π ≈ 12.6 radians at 0 dB, as in msfa, the DX7 engine in Dexed.
         The carriers share the output: each is its own level times one
         over how many carriers the algorithm has.`,
        `Each decay is a straight line in dB, from level
         <var>L</var><sub>1</sub> to <var>L</var><sub>2</sub> over a time
         <var>T</var>; the attack is a straight line in amplitude. Keyboard
         scaling adds to an operator's level up to about 6 dB for every
         three semitones from the break point, and multiplies the speed of
         its envelope by up to 1.83 an octave.`,
      ],
    },
    {
      title: 'Detune and beating',
      body: [
        `A ${wikipedia('Cent_(music)', 'cent')} is a twelve-hundredth of an
         octave, so an operator at ratio <var>r</var> detuned by
         <var>c</var> cents runs at`,
        formula('detune'),
        `Two sine waves at frequencies <var>f</var><sub>1</sub> and
         <var>f</var><sub>2</sub> add up to one at their average whose
         loudness swells and fades at`,
        formula('beating'),
        `beats a second. 12 cents apart at 220 Hz is 220 × (2<sup>12/1200</sup>
         − 1) ≈ 1.5 beats a second; 7 cents at 440 Hz is about 1.78.`,
      ],
    },
  ],
  controls: ['volume'],
  presets: PRESETS,
  patch: {
    ...BASE_PATCH,
    ...HELD,
    mode: 'ops',
    voiceModel: 'dx7',
    noteMode: true,
  },
  figures: {
    algorithm: 'Algorithm 5: three pairs, only the operators a preset uses switched on.',
    spectrum: 'Spectrum, worked out numerically: heights only.',
  },
};
