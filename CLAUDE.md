# fmlab

An interactive guide to FM synthesis: a single page of short chapters, each
built around a figure you can play with and hear. Design spec:
`docs/specs/2026-10-13-fmlab-design.md`. The app has no users yet: don't
keep old URLs, storage keys or saved state working after a change.

Vite, vanilla TypeScript (strict) and Canvas 2D; no UI framework. Vitest,
ESLint. Sound comes from one AudioWorklet phase-modulation engine. Deploys
as static files to Cloudflare Pages (`DEPLOYMENT.md`).

The page is a section at a time: its text in a narrative pane, and the
lab (Play / Stop, sliders and two figures) beside it, or under it on a
narrow screen. Sections have names, not numbers, and come in groups; the
sequence and every name are in `src/chapters/outline.ts`: Basics (A single
sine `#/sine`, Vibrato becomes tone `#/vibrato`), Two operators (The
modulation index `#/index`, Sidebands and Bessel functions `#/sidebands`,
Carrier and modulator ratio `#/ratio`, Sounds that change over time
`#/envelopes`), The DX7 (Operators and algorithms `#/algorithms`, FM
versus PM `#/fm-vs-pm`) and Play (the Sandbox `#/sandbox`, last). `#/`
(or no hash) is the landing view, "Hearing FM" under the kicker
Introduction: laid out exactly as a section (its lab a Play button whose
note the two figures move with), its text the pitch, a button to the
sandbox and the guide's contents (no button to the first section: its
Next link is the way on), its Next the first section and that section's
Previous it; `#/glossary` is the
glossary, outside the sequence. The header's Contents button opens a panel
of every group and section (`ui/contents.ts`); each section ends with
Previous and Next by name, except the sandbox, an instrument page with no
text (its way back is the Contents panel). The masthead's crumb (`#where`,
"Two operators · The modulation index") has the same two ways side by side
just left of it, ‹ then › (`#where-prev`, `#where-next`, `whereSteps` in
`ui/contents.ts`; Jeremy, 2026-10-20, moved together 2026-10-22): small
ink-outlined squares named "Previous: …" and "Next: …"; on the landing
view the ‹ keeps its place unseen, so › and the crumb hold still; none on the glossary or the sandbox;
on a phone, where the crumb is hidden, the two sit after Contents. In the code a section is still a "chapter".
Never write a section's number in its copy: link to it by name with
`sectionLink(id)`.

## Commands

```bash
npm run dev      # Dev server at localhost:5173
npm run build    # Production build to dist/
npm run preview  # Serve dist/ at localhost:4173
npm run lint     # ESLint
npm test         # Vitest
npm run typecheck  # tsc --noEmit (covers tests, scripts and config files too)
npm run bench:voices  # The voice pool's cost per block (not in CI; scripts/bench-voices.ts)
```

`.github/workflows/ci.yml` runs lint, test, build and typecheck for every
pull request and every push to `main`. `npm run build` does not type-check;
`typecheck` is the only thing that does. `.node-version` pins Node 22 for
both CI and the Cloudflare Pages build; `engines` in `package.json`
requires `>=22.13.0`.

TypeScript is held at 6.0.x because typescript-eslint does not support 7
yet.

In the Claude Code sandbox, `npm install` needs `--cache "$TMPDIR/npm-cache"`.

## Layout

Everything follows one store. A control writes to it; the engine and the
figures subscribe to it. Nothing else passes values around.

- `index.html` — the page's static markup, and the boot script that
  applies a saved theme before the first paint. `src/main.ts` is the entry:
  it imports the fonts and styles, makes the store and the engine, mounts
  the controls and figures, and fills in the footer's commit hash
  (`__COMMIT_HASH__`, set by `define` in `vite.config.ts` from
  `git rev-parse --short HEAD`, `dev` without git), a link to the commit
  on GitHub by its full hash (`__COMMIT_FULL__`, `git rev-parse HEAD`),
  opening in a new tab and marked ↗, plain text without git.
- `src/model/` — state, no DOM except in `theme.ts`. `store.ts`
  (`createStore`: get, set, subscribe; listeners run synchronously inside
  `set` and get the previous state too), `lab.ts` (`LabState`; the ranges
  and defaults; the log scales of the carrier and modulator sliders),
  `theme.ts` (the choice, its storage key, `applyTheme`) and
  `settings.ts`, the sandbox's settings (its Settings panel, and the
  Voice section's Reverb tab), outside the lab's store, the link and the
  sound: `Settings` (Screen glitch, Motion, Tips on hover, Z X hint, Note
  names, Computer keys, Wheel; MIDI In's `midi` (off, on: set by the MIDI key),
  `midiInput` (an input's name, '' for all, at most `MAX_TEXT_SETTING`, 100,
  characters, the one text setting), `midiChannel` (0 for all, or 1 to 16)
  and `bendRange` (1, 2, 3, 5, 7 or 12 semitones); and the plate reverb's Reverb, Decay, Mix,
  Tone and Pre-delay, set on the Reverb tab), `DEFAULT_SETTINGS`
  (today's behaviour; the reverb off, 1.5 s, 25 %, 70, 0 ms; MIDI off,
  every input and channel, the bend ±2), the choice
  settings' `SETTING_CHOICES` and the number settings' `SETTING_RANGES`
  (min, max, step; `inRange`), `parseSettings` (anything
  missing, unknown or unreadable its default; a number held in range
  and rounded to its step), `loadSettings` and
  `saveSettings`, all together as JSON under
  `localStorage["fmlab.settings"]`, and `settings`, a store of their own
  that whatever they govern subscribes to. The theme is not among them:
  the sandbox is dark only, and the chapters' theme keeps its own key and
  `theme.ts`.
  The URL holds
  the section and, for one with `sharesSound` (the sandbox), its
  sound (see `sandbox.ts` below). `state.chapter`
  is a section's id, or `landing` or `glossary`.
  The patch is held two ways, by `mode`. `pm` (everywhere but `vibrato`):
  `ratio` and `index`. `fm` (`vibrato`): `modHz` and `deviationHz`.
  `fm-vs-pm` (`compare`) shows both: Fig. 1 draws `asPm(state)`, Fig. 2
  (`#compare`) `asFm(state)`, FM matched at ratio 1 (Δf = index × fc, so
  its index is index / ratio); `mode` is only what is heard.
  `patchOf(state)` gives a ratio and an index for either, which is what the
  figures and spectrum maths take; never read `state.ratio` or
  `state.index` directly outside `pm`-only code.
  There are three ways of playing. Most chapters hold a steady sound while
  `playing` is true. A chapter with `noteMode` (`envelopes`) plays one note
  each time `notes` goes up, shaped by the envelope (`attack`, `decay`,
  `sustain`, `release`, `hold`; `envelopeOf(state)`), and
  `indexAtTime(state, t)` is the index at a moment of it. Six operators
  (`ops`: `algorithms` and the sandbox) play notes in the worklet's voice
  pool: `held` is the keys down on the keyboard, in the order struck, each
  sounding until it is let go; `notes` still strikes one (Play note in
  `algorithms`) held for `noteHold` and then let go; `stops` silences
  them all (in the sandbox the space bar is only that, `pressSpace`;
  Jeremy, 2026-10-23: it strikes no note there). The figures follow the note struck last: `noteStartedAt`,
  `noteHold` (Infinity while its key is down, then the time it was held)
  and `noteLength` (the hold plus `releaseSecondsOf`; `operatorLevelsAt`).
  Edits from the sandbox's controls reach the notes sounding (Jeremy,
  2026-10-22): glided or carried on from where they are (see
  `voicePool.ts`); a preset or a link is a new voice, counted by
  `voiceLoads`, and reaches only the next note, as does the algorithm
  (`isLiveEdit`). `noteAnchors` holds where edits found the last note's
  envelopes, for that note only (`startedAt`; `anchorsAfterEdit`, kept
  by `createLabStore`), so the figures draw what is heard.
  `voiceModel` says which operators six-operator chapters play: `basic`
  (`operators`, `feedback`: ratio, level 0 to 1, one decay; `algorithms`)
  or `dx7` (`dxOperators`, `dxFeedback`, `dxLfo`, `dxPitchEnvelope`; the sandbox), the DX7 voice of
  `src/dsp/dx7.ts`. `selectedOp` is the operator the sandbox's operator
  panel shows; one always is, OP1 when it opens. `modWheel` is the sandbox's mod wheel, 0 to 1
  (opens at 0; the instrument's, not the voice's, so kept through voice
  and preset changes, and in neither the link nor storage). `pitchBend` is the pitch
  wheel from MIDI In, -1 to 1 (kept as `modWheel` is, back to 0 when MIDI
  is turned off or the sandbox left; times the Bend range it is the
  semitones the voice pool bends every note by, and the sandbox's spectrum
  stems move with it). `voiceTab` is that
  panel's tab, `envelope` (the default) or `keys`, and stays as it is
  when another operator is selected.
  `momentOf(state, time)` is what a figure should draw at a time on the
  page's clock: the patch as set, or, while a note sounds, that moment's
  index and loudness.
- `src/chapters/` — a chapter (a section) is data (`types.ts`): its id
  and title (from `outline.ts`, which also sets the order and the
  groups; `index.ts` joins each id to its file), lesson
  text and "The maths" panels (HTML strings, trusted because they are
  written here), the sliders it shows (and in `labels` any it names
  its own way: Carrier is Frequency in `sine`), the patch it starts from (all
  of it, so a chapter always opens the same way), optional `steps` (sections
  with a sound each, `algorithms`), `showsPair` (the two-operator
  sections draw their two operators small beside the text) and the figures it shows,
  each with its caption (they are numbered from 1 in the order shown, so
  text that says "Fig. 2" must match the chapter's own list). A chapter
  may have presets, buttons that set several fields at once. Its patch is
  written as `BASE_PATCH` (`basePatch.ts`) with its own differences.
  `landing.ts` is the landing view, written as a chapter with the id
  `LANDING` so that everything following the store's chapter needs no
  special case. It is not in `CHAPTERS` (Previous and Next reach it
  through `sequenceNeighbours`), is at `#/` and plays one long note. `glossary.ts` is the glossary, the same way: `GLOSSARY`, at
  `#/glossary` (an entry: `#/glossary?t=index`), drawn from the terms,
  with no lab and nothing to play. `route.ts` reads and writes addresses,
  and `upgradeHash` turns a link from before the sections had names
  (`#4`, `#7?c=…`, `#glossary`) into the address it meant, keeping its
  parameters.
  `sandbox.ts` is an instrument page, not a section (`instrument`): no
  lesson, maths or lede; a synthesizer of its own (Jeremy, 2026-10-20),
  its masthead its title bar, the voice's name in it. It plays a DX7
  voice (`voiceModel: 'dx7'`) from the keyboard, its presets in
  `dx7Voices.ts` in two banks of 32 (Jeremy, 2026-10-21; `SANDBOX_VOICES`,
  `SANDBOX_BANKS`, a `Preset`'s `bank` and the chapter's `presetBanks`):
  bank A all 32 of Yamaha's DX7 factory voices (ROM1A), numbered as on
  the DX7 after the bank's letter ("A11 E.PIANO 1", which it opens on),
  and bank B fmlab's own 32 ("B1 TINE PIANO" to "B32 HOLLOW PAD",
  `fmlabVoices.ts`, `FMLAB_VOICES`; hint "fmlab's own TINE PIANO", no
  note, played whole). The masthead shows the voice's name, a button
  that opens the preset window (`presetMenu` in `chapterView.ts`,
  `presetPanel.ts`; Jeremy, 2026-10-22: no native menu and no bank keys
  in the masthead), with up and down keys beside it that step through
  all 64 from the voice last chosen, across the banks, A32 on to B1 and
  round both ends (`stepPreset` in `presetGrid.ts`; Jeremy, 2026-10-22).
  The chosen voice has a short note ("approximate · no velocity";
  `note`), unseen but read by screen readers and in the name's tip
  (Jeremy, 2026-10-20), and the name says "Edited" once the sound is
  changed (`presetOf`, across all 64). Bank A is credited "DX7 factory
  voices © Yamaha" (`FACTORY_CREDIT`) in the name's hover title and its
  bank key's name in the preset window, not as a line of its own on the
  page; bank B is "fmlab voices" (`FMLAB_CREDIT`) in both places. Each of
  bank A's hints says it is a close approximation
  and what it plays without (velocity, fixed frequency, played as a
  ratio from middle C, transpose, an envelope ending above silence);
  since 2026-10-19 it plays each voice's LFO (vibrato and tremolo, with
  its speed, delay, wave and key sync) and its pitch envelope.
  `dx7Factory.ts` is generated by `scripts/dx7_voices.py` from a ROM1A
  .syx, which is never committed (see scripts/README.md); `fmlabVoices.ts`
  by the same script from `scripts/fmlab-bank2.syx`, which is ours and
  committed (its header and `FMLAB_VOICES` set by hand after; it reuses
  `FactoryVoice`); `algorithms`
  keeps `dx7Presets.ts`. Its link is `#/sandbox?a=&f=&o=…&l=…&p=…`, `a` the
  algorithm, `f` the DX7 feedback, `o` the six operators joined by "~", each fifteen fields
  joined by "_" (`operatorsParam`: ratio, detune, level or "x" for off,
  the envelope's seven numbers, break key, left and right scaling as "l"
  or "e" and a depth, rate scaling, tremolo share as a percentage), and
  `l` the LFO (`lfoParam`: wave, speed, delay, vibrato, tremolo, sync 0 or
  1, and what the mod wheel adds at full, wheel vibrato in cents and
  wheel tremolo in dB, as `sine_5.81_0.31_12_0_1_50_0`; a link with only
  the first six gets the wheel's defaults, 50 and 0), and `p` the pitch envelope
  (`pitchParam`: start, attack, peak, decay 1, break, decay 2, sustain,
  release; levels in cents, speeds in cents a second), validated and clamped by
  `soundFromParams` (a share any percentage from 0 to 100, to 0.1 %); an older
  link keeps only its pitch and algorithm. The pitch is not written (Jeremy,
  2026-10-23): it is only the note struck last, so the address changed with
  every note; a link's own `c` still sets it. The address is rewritten
  (`replaceState`, no new history entry) 300 ms after the patch last
  changes, and only then.
  `terms.ts` holds every defined term: its name, a one-sentence plain
  definition (for the glossary and the term's tip only), an optional
  formula, its English Wikipedia article and the chapter that defines it.
  A chapter defines a term in its own words, after the reader has heard or
  seen the thing, and marks it there with `${define(id)}` (the term set
  as a bold `<dfn>` linking to the glossary); `${formula(id)}` goes in its
  maths panel, and `${use(id)}` marks a later mention. A paragraph
  introduces at most one term, and no two sentences running define one.
  `terms.test.ts` checks all of that, and fails if a term is used in any
  text (lesson, maths or captions) before its chapter, or in its chapter
  before its definition: a new term goes in `terms.ts` first, and new
  copy keeps to the order. `wikipedia(article, text)` links out (new tab,
  `rel="noopener"`, marked ↗): the lesson text uses it only for proper
  nouns (John Chowning, the Yamaha DX7), maths panels where a formula
  appears, and the glossary gives each entry its article.
  `docs/editing-chapters.md` is the guide to editing this text by hand.
  `index.ts` lists them (`CHAPTERS`, `neighbours`, and
  `sequenceNeighbours`, where Previous and Next go from any view, the
  bottom links and the masthead's arrows alike); `route.ts` reads and
  writes the hash (`soundParams`, and `soundFromParams`, which checks and
  clamps every value a link carries). A new chapter is a file here and an entry in `CHAPTERS`. Lesson
  text is plain language for musicians; formulas go in the panels, as
  `<p class="formula">` with `<var>` and `<sub>` (no maths library).
- `src/dsp/` — pure maths, no DOM and no Web Audio. `bessel.ts`: `besselJ`
  (one J_n by power series, good to an argument of about 20) and
  `besselJSeries` (J_0 to J_n by Miller's recurrence, good for any
  argument; a slow vibrato is an index in the hundreds). `fmSpectrum.ts`:
  `fmSpectrum(ratio, index)`, the line spectrum of phase modulation in
  carrier units, signed amplitudes, negative frequencies folded,
  coincident lines summed; and `trueFmSpectrum`, the same for true FM,
  whose lines are magnitudes. `waveform.ts`: `fmSample` and `trueFmSample`,
  the signals at one instant, for drawing. `dx7.ts` is the sandbox's DX7
  voice in clean units, after msfa (Dexed's engine, `dx7note.cc` and
  `env.cc`): a `Dx7Operator` has a ratio, a detune in cents, a level in
  dB (or off), a `Dx7Envelope` (attack, peak, decay1, brk, decay2,
  sustain, release: times in seconds and levels in dB; on screen Attack,
  Peak, Decay 1, Break, Decay 2, Sustain, Release, never "L1" or "stage
  2"), a break point and two `ScalingSide`s (linear or exponential, a
  depth in dB per three keys) and rate scaling (×1 to ×1.83 an octave).
  A modulator's index is 4π·10^(dB/20) (`dbToIndex`; msfa's two cycles
  each way, against `algorithms`'s `MOD_INDEX` of 5); feedback is in
  radians on the source's own output, 0 to 2π. `dx7EnvelopeAt` is a
  straight attack, then decays and release in straight lines in dB, the
  release falling from wherever the curve is at the speed that takes full
  level to silence in `release`; `levelScalingDb` and
  `rateScalingFactor` are msfa's `ScaleLevel` and `ScaleRate` without
  their rounding; `dx7Note` works out a note's ratios, kernel levels,
  rate-scaled envelopes and feedback once, at its key. A `Dx7Operator`
  also has `tremolo`, its share of the LFO's tremolo, 0 to 1 (the factory
  voices' are `AMS_SHARES`, Dexed's 0, 66, 109 and 255 of 255; the table
  edits it in tenths), and the voice a `Dx7Lfo` (wave,
  speed in Hz, delay in s, vibrato in cents, tremolo in dB, sync, and
  `wheelVibrato` and `wheelTremolo`, what the mod wheel adds at full, as
  the DX7's wheel assigns do (Jeremy, 2026-10-21; per voice, 50 ¢ and
  0 dB for every voice, `WHEEL_DEPTHS`: a DX7 voice has no such field,
  so `dx7Factory.ts` holds `Dx7VoiceLfo` and the presets add them);
  `lfoDepths(lfo, wheel)` is the depth heard, the LFO's own plus the
  wheel's share, capped at the ranges' tops (1190 ¢, 91.7 dB); ranges
  `LFO_*`, the DX7's 0 to 99; `HELD_LFO` off). `lfo.ts` is the LFO, after
  msfa's `lfo.cc` and Dexed's `dx7note.cc`: `Lfo` (one for the whole
  instrument; `set`, `keyDown`, `next` giving `pitch` −1 to 1 and `amp`
  0 to 1, the wave turned over, both times the delay's fade), the six
  waves (`waveAt`, msfa's shapes; sample and hold from msfa's generator,
  once a cycle), the delay (`delayGain`: held for `delay`, then a linear
  fade over min(delay, 0.666 s)), key sync (`SYNC_PHASE`, half a cycle),
  and the DX7 conversions (`dx7LfoHz`, msfa's 0.065 to 23.9 Hz;
  `dx7LfoDelay`, 0 to 2.66 s; `dx7VibratoCents`, PMD and PMS merged, up
  to 1190 ¢; `dx7TremoloDb`, Dexed's pull on a full-level operator at
  AMS 3, up to 91.7 dB). Every key down restarts the delay for every
  note (Jeremy, 2026-10-19; Dexed restarts it only on a key with none
  held). The voice's `Dx7PitchEnvelope` (the DX7's pitch EG, after msfa's
  `pitchenv.cc`): `start` (L4), `peak`, `brk`, `sustain` in cents
  (`PITCH_ENVELOPE_CENTS`, ±4800, continuous) and `attack`, `decay1`,
  `decay2`, `release` as speeds in cents a second (`PITCH_EG_SPEED`,
  msfa's rates 0 and 99: about 0.56 to 144 st/s); a part takes
  |distance| / speed (`glideSeconds`), none if it does not move.
  `dx7PitchAt(env, time, hold)`: start at the key, straight lines to
  peak, break and sustain, held; let go, from wherever it is back to
  start at the release speed, exactly as msfa. `FLAT_PITCH_ENVELOPE`,
  `pitchEnvelopeOn`. `voicePool.ts` (`VoicePool`:
  `VOICES` (16, the DX7's; 8 until MIDI In's pedal could hold more) notes
  of six operators at once, each a `PmKernel` whose levels
  follow `operatorEnvelope` worked out per sample, summed (a `dx7`
  note's envelopes and pitch envelope every `CONTROL_SAMPLES`, 32, and
  followed between: an attack in a straight line in amplitude, a decay
  or a release by a factor a sample, a straight line in dB, so held
  notes are the per-sample sound to the last bit and released ones within
  -120 dB; a run never crosses a part's corner but in one sample, so the
  peaks are where they belong; the tremolo's factor once a sample for
  each AMS share, for every voice; nothing made new in `render`,
  Jeremy, 2026-10-22); a note takes up
  the patch as it was when struck, and then, a `dx7` note, every `live`
  patch: the edits from the sandbox's controls (Jeremy, 2026-10-22; not
  a preset or a link, which are a new voice for the next note). Each
  sounding note works itself out again at its own key with its own
  algorithm (the algorithm reaches only the next note): its ratios
  (in cents), levels, tremolo shares and feedback glide there over
  `LIVE_GLIDE_SECONDS` (20 ms), and its envelopes and pitch envelope
  carry on from where they are with the new settings
  (`anchorAt` / `dx7EnvelopeFrom`, `pitchAnchorAt` / `dx7PitchFrom` in
  `dx7.ts`: from the anchor, the part it is in heads for its new level
  at its new speed, then the later parts as set; a part already passed is
  over at once; the anchor at the key is the curve as struck exactly;
  no step); `kernelLevelsOf` says what a note's levels are, for the
  tests; a voice is free once its carriers are
  below -90 dB, measured before tremolo; it plays either kind of patch,
  `basic` or `dx7`; a `dx7` patch's LFO is stepped once a sample before
  the voices, its vibrato multiplying every note's frequency by
  2^(cents × pitch / 1200), the cents and dB being `lfoDepths` with the
  mod wheel, which the pool glides to over `WHEEL_GLIDE_SECONDS` (30 ms)
  so a drag does not zipper (with each note's own pitch envelope, taken
  from the patch when it is struck and run from its own key:
  2^((pitchEnvelope + vibrato) / 1200)) and its tremolo every operator's level, after
  its envelope, by 10^(−dB × share × amp / 20)); the pitch wheel (`bend`,
  in semitones) multiplies every note's frequency, either kind of patch, by
  2^(bend / 12), glided over `BEND_GLIDE_SECONDS` (5 ms) and `voices.ts` (`chooseVoice`: a key's own voice, else a
  free one, else the one let go longest ago, else the oldest held; a
  voice taken is faded over `STEAL_SECONDS` first; and `midiToHz`).
  `plateReverb.ts` (`PlateReverb`: the sandbox's reverb, Dattorro's
  plate, J. Audio Eng. Soc. 45(9), 1997, figure 1 and tables 1 and 2,
  every length scaled from 29,761 Hz; the Pre-delay setting, 0 to 500 ms
  (a line of 500 ms made once; a turn crossfades from the old tap to the
  new over 50 ms, equal power, so the wet's pitch never bends), four input
  diffusers, the figure-eight tank with its two modulated allpasses (1 Hz,
  ±16 paper samples, in quadrature, read in a straight line), table 2's
  taps for left and right; Decay sets the decay coefficient from the
  loop's length (`decayFor`, held under 0.9995, `DECAY_FIT` 0.94 so 0.5 to
  20 s measure within 15%, about 0.33 s the shortest), and eases the
  tank's first diffusers for short times (`diffusionFor`); Tone the
  damping (`dampingFor`); Mix the dry and wet (`mixGains`); every change
  glided over 50 ms; off, it glides the wet out, then stops and clears and
  costs nothing; nothing made new in `process`).
  `pmKernel.ts` (`PmKernel`:
  phase modulation a sample at a time, up to six operators through an
  `Algorithm`, now `TWO_OPERATORS`; no feedback yet; its sines from a
  4096-point table, interpolated, `sineCycles`, within 3e-7 of
  `Math.sin`) keeps each operator's
  phase locked to its ratio of the base frequency, easing it back after a
  ratio moves, so the sound stays the signal the figures draw.
  `fmKernel.ts` (`FmKernel`) is true FM for `vibrato` only, with no lock.
  `PmKernel` also takes an algorithm's feedback loop (the mean of the
  source's last two samples, as the DX7 does) and can be rewired between
  notes (`setAlgorithm`). `algorithms.ts` is the DX7's 32 algorithms,
  written in DX7 numbering and tested against the table in Dexed's msfa
  engine. `operators.ts` is `algorithms`'s maths: an `Operator` (ratio,
  level, decay), `kernelLevels` (a modulator's level is its index times
  `MOD_INDEX`; the carriers share the output), each operator's envelope,
  and `operatorSpectrum`, the predicted spectrum worked out by running the
  kernel and taking an FFT (`fft.ts`) with a flat-top window, since there
  is no Bessel formula for a stack.
  Tests hold kernels, samples and spectra to each other.
- `src/dsp/envelope.ts` is the envelope as a pure function,
  `envelopeAt(envelope, t)`: a straight attack, then exponential decay and
  release timed to four time constants; `hold` is Infinity while a key is
  down, and set when it is let go the release starts from wherever the
  curve is. For six operators the voice pool calls this same function on
  the audio thread, so the figures and the sound cannot disagree. For the
  two-operator `envelopes` note the engine schedules exactly that curve (a
  linear ramp, then `setTargetAtTime`); change one and change the other.
- `src/audio/` — everything Web Audio. `synthProcessor.ts` is the
  AudioWorklet: it runs the kernels and has a-rate AudioParams `frequency`,
  `ratio`, `index`, and for true FM `modFrequency`, `deviation` and `mode`
  (1 is true FM; 2 the voice pool, told what to play by messages on its
  port, `VoiceMessage`: `patch`, `noteOn`, `noteOff`, `allOff`, and
  `wheel`, the mod wheel alone, lighter than the whole patch at every
  step of a drag; the engine sends it on a change and with each note;
  `bend`, the pitch wheel in semitones; and `noteOn` carries a velocity,
  not yet heard).
  Its first output is stereo: the sound in both channels and, in mode 2,
  the plate reverb's wet added (`ReverbMessage`, `reverb`: on, seconds,
  mix, tone; dsp/plateReverb.ts); its second, mono, the dry sound alone,
  which the analyser measures, so the spectrum is the notes, never the
  tail. Modes 0 and 1 never run the reverb. It is
  bundled on its own through the `?worker&url`
  import in `engine.ts`, and may import from `src/dsp` only. `engine.ts`
  (`AudioEngine`) follows the store: worklet, note gain, master gain,
  limiter (a `DynamicsCompressorNode`), speakers. It creates the context
  on the first Play, inside the gesture; the sandbox builds it on arrival
  instead (`warm`), suspended, so its first key need only resume it
  rather than wait the better part of 100 ms for the worklet to load, and
  a struck note sets the master gain at once rather than fading it in.
  It glides params (30 ms linear
  ramps), fades the master gain in and out, suspends the context after
  Stop, and on a change of chapter fades out, jumps to the new patch and
  fades back in. For a note it schedules the envelope on the note gain
  and, if `indexFollows`, on the `index` param, 20 ms ahead so the last
  note can be brought down first. For six operators it tells the voice
  pool which keys went down and up (`held`), strikes `PLAYED_NOTE` for
  Play note, and sends `allOff` for Stop and a change of chapter; the
  context is suspended once nothing is held or sounding, and, with the
  reverb on, its tail rung out (`tailMs`). It sends the reverb on load,
  when its settings change and on a change of chapter: on only in the
  sandbox with Reverb on (Jeremy, 2026-10-22).
  MIDI In (Jeremy, 2026-10-23) plays through its public `noteOn(note, hz,
  velocity, marks)`: posted straight to the pool, before the store is
  set, when the context runs and the pool has the voice (else struck as
  any key, the patch, wheel and bend sent only when the pool lacks the
  voice, never with every note), and marked so the `held` that follows
  does not strike it again; false before the page's first gesture (the
  note is dropped). With MIDI on in the sandbox the context is kept
  running, never suspended for silence. The first MIDI note logs the
  context's base and output latency to the console, once.
  An `AnalyserNode` taps the dry output before the volume (through
  `noteDry`, which every change to the note gain is made to too), and
  `measure()` hands its spectrum to the live view.
  `iosUnlock.ts` keeps iOS's ringer switch from muting it;
  `worklet-globals.d.ts` types the worklet's globals.
- `src/viz/` — Canvas 2D drawing. A renderer is a function of
  `(state, canvas)` that repaints from scratch, reading its colours and
  fonts from the canvas's CSS variables. `plot.ts` has the shared frame
  (sizing for the device pixel ratio, gridlines, labels);
  `waveformPlot.ts` and `spectrumPlot.ts` are the two figures. The
  waveform shows two carrier cycles in `pm` and two modulator cycles, up
  to forty carrier cycles, in `fm` (`cyclesShown`). Given a time as its
  third argument it draws the moving view instead, where the patch has one
  (`motionView`: true FM with a modulator under about 11 Hz): the next
  stretch of signal from that moment, with the carrier slowed by a round
  factor so its waves can be seen squeezing and stretching. With
  `realUnits` (`sine`) both figures are on fixed axes in real units
  instead, 20 ms and 0 to 1000 Hz, so that moving the carrier moves what
  is drawn: more waves, and a stem further along. The spectrum
  can bracket Carson's band (`showBandwidth`) and rule a line at each of
  the carrier's harmonics (`showHarmonics`). `envelopePlot.ts` draws a
  note's envelope with three draggable dots, and `spectrogramPlot.ts` the
  same note as a spectrogram worked out from the patch (`sliceAt`), both
  on one time axis (`envelopeSpan`) and both with a playhead while the
  note sounds. `voiceEnvelopePlot.ts` draws a DX7 envelope, large in the
  envelope view (dB scale, the parts named A, D1, D2, S and R, key down,
  held and up, dots) and small in each table row: each part has a slot
  of its own and its end sits in the slot as far as its time is on a log
  scale (`timePosition`), so short and long parts both show and a dot
  holds still as it is dragged (`dotDragged`). `keyScalingPlot.ts` draws
  an operator's level across a piano's 88 keys (A0 to C8), small in each
  table row and large in the panel's Key scaling tab (`keysArea`:
  dB at the left, the break point named over its line, the Cs under the
  keys). `plot.ts`'s `drawFrame` takes the horizontal rows a plot
  wants; amplitude from -1 to 1 is only the default. `algorithmPlot.ts` draws an algorithm as the DX7 does (`layoutAlgorithm`:
  carriers on the bottom row, each modulator above what it modulates),
  with boxes sized for the largest of the wirings (6 columns, 4 rows) so
  they keep their size as the algorithm changes, a smaller wiring centred,
  where that leaves a box of at least `STEADY_BOX` (the sandbox); in the
  chapter lab's short diagram each wiring is fitted on its own; a
  carrier's box is filled in --pen-blue with its number in paper, a
  modulator's a solid --pen-green outline, the same at any level, so the
  two read apart without colour too. While a note
  sounds a modulator's box fills as strongly as it sounds (a carrier is
  filled already). In the sandbox (`chapter === 'sandbox'`) it is a VFD
  panel instead (`drawVfdAlgorithm`, Jeremy, 2026-10-20), on the same
  geometry: cyan on dark glass in either theme, the carriers lit solid
  with their wires down to the output, the output line ("OUT") and the
  feedback loop at full brightness, the modulators cyan outlines at
  about half brightness with the wires between them; the pointed-at
  ring is lit full. The algorithms chapter's diagram keeps its pens.
  `liveSpectrum.ts` is
  the spectrum's live view, drawn whenever sound plays (there is no
  switch): the measured FFT as a filled --pen-blue curve over the
  predicted stems, which are drawn as ever, on the same axes
  (`drawSpectrumFrame`) and scale (`amplitudeFromDb` undoes the analyser's
  window, so a full sine reads 1). The sandbox's spectrum has its own
  axes (Jeremy, 2026-10-22, "it needs a non-linear x-axis";
  `isLogSpectrum`, `drawLogSpectrum`): frequency in Hz on a log axis
  fixed from 20 Hz to 20 kHz for every voice and key (`LOG_HZ`,
  `hzToShare`; ticks 20, 50 ... 20k, `LOG_HZ_TICKS`, thinned where they
  would touch, 20k kept, `keptLabels`), so the stems move when another key
  is played; and level in dB (`ampDb`), 0 dB at the top to `DB_FLOOR`
  (-72) at the foot, gridlines every 12 dB (labelled every other where
  close), stems standing up from the floor, none below it
  (`dbToShare`), so a note's decay shows. The live trace is on the same
  axes, bin by bin, nothing smoothed between bins. It draws only what
  sounds: the note at that moment, and nothing (the frame alone) while
  no note does, on load as after a note (`heardLines`; Jeremy,
  2026-10-22). Its description says the axes and the strongest partial
  in Hz and dB, or "silent". `besselPlot.ts` draws J_0
  to J_8 against the index, with an ink line at the patch's index and a
  dot where it crosses each curve. The spectrum and the Bessel plot are
  linked: `highlightOf(state)` is a sideband order to pick out, and both
  draw it heavier and the rest fainter. Each has pure hit-testing
  (`orderAt`, `indexAt`, `orderAtX`) that works from a canvas size, built
  on `plotArea`. `ticks.ts` (pure) makes
  the x axes' numbers: every tick is labelled in carrier units (multiples,
  cycles) and, on a second row, in Hz or ms, thinned when the canvas is
  narrow.
- `src/ui/` — wiring between the markup and the store. `chapterView.ts`
  turns the hash into the store's chapter and patch, and draws what a
  chapter owns: the narrative pane, the contents list in the masthead,
  which slider rows (`data-control`) and figures (`data-figure`) show, the
  figures' numbers and their captions. `sliders.ts`
  is a table of every slider (range, step, scale, readout);
  `operators.ts` fills the six-operator lab (`algorithms`, and the
  sandbox's Six), two labelled panels, one above the other, in
  `index.html`'s `#six-operators-lab`: Algorithm (how the wiring is
  chosen, on one row of a fixed height: `algorithms`'s step buttons, the
  last of them DX7 algorithms, or at that step and in the sandbox the
  list of the 32, grouped by carriers, with Basic wirings to go back
  where there are steps and the presets as `#dx7-presets`; the diagram,
  Fig. 1, with Feedback and its caption beside it) and Operators (a row
  per operator the wiring uses, its
  tag ringed in its role's pen, and for ratio, level and decay a slider
  with a box to type in; Ratio snaps to `RATIO_STOPS` unless Shift or Alt
  is held). A drag in a box changes it as well (`scrubTo`: up or right
  for more, the same stops, Shift or Alt finer and slower); a click
  without moving still types. Pointing at or focusing a row sets `hoverOp`, which rings that
  box in the diagram; pointing at a box (`operatorAt`) picks out its row,
  tinted in its role's pen with an ink edge, and clicking a box focuses
  its row. A focused row stays picked out when the pointer leaves.
  Where the lab is pinned small, the Operators panel and Feedback fold
  behind Sliders;
  `steps.ts` is a chapter's steps (`Chapter.steps`, `algorithms`): the row
  of step buttons in the Algorithm panel, the buttons heading the text's
  sections, Basic wirings (back to the step last left), and what shows
  at which step: the steps or the DX7 list, never both (the step is
  `currentStep(steps, algorithm)` in `src/chapters/steps.ts`, never
  stored);
  `compare.ts` is `fm-vs-pm`'s Hear PM / FM switch (it sets `mode`), and
  keeps `modHz` and `deviationHz` at `asFm(state)`'s while the chapter has
  `compare`, so the FM sound follows Ratio and Index;
  `envelopeControls.ts` drags the envelope's dots; `piano.ts` is the
  sandbox's keyboard, on screen and on the computer's keys
  (by `KeyboardEvent.code`: A to K the white notes, W E T Y U O P the
  black, Z and X an octave down and up; with a menu focused too, the
  algorithm's, which then takes neither them nor the space bar as the
  start of a name, its arrows still its own; and with the preset window
  or Settings open).
  Every key held sounds. The keys held from every source are one key bed
  (`keyBed.ts`: `KeyHolders`, pure, each pitch's holders, `key`, `pointer`
  or `midi:<input id>`; `createKeyBed`, which keeps the store with it):
  a pitch goes into `held` with its first holder and out with its last,
  and the note struck last (any source; a MIDI strike always) sets
  `carrierHz`, `noteStartedAt` and `noteLength`. MIDI's sustain pedal
  keeps MIDI notes let go sounding until every input's pedal is up; it
  never holds the computer's or the pointer's. The computer's and the
  pointer's keys are let go on blur, a hidden tab, a lost pointer capture
  and a change of chapter, so none sticks; MIDI's are not (an unplugged
  input lets go its own notes and pedal; MIDI off or the sandbox left,
  all of them, and the bend goes back to the middle, the mod wheel kept).
  Piano-shaped keys, every C named (the computer keys that play them are
  in their names, not drawn on them), drawn as real ones (Jeremy,
  2026-10-21): white keys with shaded tops, a lit left and shaded right
  edge and a front lip of their own; ebony black keys, bevelled, with a
  sheen, a sloped front face and a soft shadow on their neighbours; soft
  grey grooves; a held key sinks, straight down and up, never animated.
  They are let into the foot's chassis, a strip of charcoal felt along
  their top where they run under the rail. On their left the control
  panel: Octave and Mod in silkscreen on one line (the knobs' names'
  print, set on the line's foot), and 6px under them the octave
  control (‹ › black push keys either side of a two-place VFD readout of
  the keyboard's first C, C1 to C5, in one bezel as the algorithm
  chooser's; the range in words lies over the readout unseen, for its tip
  and double click; beside the Octave label the Z / X hint, grey, shown
  only while the pointer is over the keyboard or keyboard focus is in it)
  and the mod wheel (`modWheel.ts`, `createModWheel`; Jeremy,
  2026-10-21): a ribbed rubber drum with a painted line riding from its
  foot (0) to its top (full), and beside it a VFD bar of 21 segments lit
  from the bottom (`litSegments`), in a slot of the bezels' plastic; a
  `role="slider"`, "Mod wheel", "40 %", the bar hidden from screen
  readers; dragged (up for more, about 100 px end to end, from the
  press), scrolled (down for more, 1 % per 10 px), the arrows (1 %), Page
  Up / Down (10 %), Home, End, and a double click back to 0; no spring;
  the note keys, Z / X and space still play while it has focus.
  Under the octave chooser, at its left and at the column's foot, its
  bottom level with the wheel's, MIDI In's one lamp key, MIDI (no label; named "MIDI in"; `ui/midi.ts`, `mountMidi`; Jeremy, 2026-10-23),
  the wheel running down beside it; worked on the press, it turns the `midi` setting on and off; on, `requestMIDIAccess()`
  (never sysex) is asked, and again on load with on saved. Its tip and
  `data-state` (`midiTip`): "MIDI off"; "MIDI on: <names>" or "MIDI on: no
  keyboard connected"; `waiting`, the lamp half lit, "Click anywhere to
  wake the sound", until the page's first gesture (notes till then
  dropped); `asking`, the lamp half lit too, while the browser's answer
  is out ("MIDI: asking the browser; allow it in the prompt by the
  address bar"); `blocked`, "MIDI blocked: allow it in the site's settings
  (in Brave: Settings, Site and Shields settings, MIDI devices)" (a
  press asks again, inside the press); and `unsupported`, the key
  disabled, kept in its place, "This browser has no MIDI: use Chrome,
  Edge, Brave or Firefox". The answer (a refusal with its error), each
  input listened to and the first message are logged to the console as
  "fmlab: MIDI ...". It listens to every input
  the Input setting names (hot-plugged ones too) on the Channel set, read
  by `midiMessage.ts` (`parseMidi`, pure): note on and off (on at velocity
  0 is off; A0 to C8 only), the sustain pedal (CC64, down from 64), the mod
  wheel (CC1), all off (CC120, CC123, as Stop) and the pitch wheel (14
  bits about 8192, to `pitchBend`); system messages, program change,
  aftertouch and the rest are ignored. A note goes to the engine's
  `noteOn` first, then into the key bed. Under 60rem high the key makes
  the panel 11px taller than the keys' bed (125 against 114). On a phone
  the labels are hidden and the key sits after the wheel on the chooser's
  line.
It shows two octaves, from C1–B2 to C5–B6 (`STARTS`; Jeremy, 2026-10-21),
starting at C3–B4, where a double click on the range brings it back;
every key it can show plays (`playable`, C1 to B6). Every held
  key sinks into shadow (Jeremy, 2026-10-21: grey, not the carrier's
  blue): a white key's face a light shadow grey, a black key darker with
  no sheen, the same in both themes. Its key colours are local tokens (`--key-light` and so
  on) so the white keys stay light in the dark theme;
  `instrument.ts` lays out the sandbox's instrument page: `PLACES` says
  which of the lab's nodes go where in `#instrument`, and a comment left
  at each node's place in the lab brings it back on the way out;
  `voiceTable.ts` is the sandbox's operator table (in `#voice-table`, its
  own, not the lab's): per row the tag and role, Ratio (a slider snapping
  to `DX7_RATIO_STOPS`, 0.5 and 1 to 31, with a VFD readout beside it),
  Detune ¢ (a number reel through the DX7's 15 steps, `DETUNE_STOPS`,
  -6.31 to +6.31 as the factory voices are written, Page Up / Down to the
  ends), Level dB (a slider whose bottom is off, with a VFD readout
  beside it), Tremolo (the operator's share of
  the LFO's tremolo, a reel alone, `TREMOLO_STOPS`, off to 100 % by
  tenths). The VFD readout (`vfdReadout.ts`, `createVfdReadout`; Jeremy,
  2026-10-20) is read only and hidden from screen readers (the slider
  says the value): four seven-segment places behind dark glass, lit cyan
  in either theme, each with its own point, unlit 8s in the empty ones,
  `formatRatio` or `formatLevel` ("oFF" for off), in the reel's place and
  size; `vfdCells` and `SEGMENTS` are its glyphs. The number reel
  (`numberReel.ts`, `createReel`), for Detune and Tremolo, is a canvas
  drum, `role="slider"`, through any ascending stops, larger values
  below; a vertical drag a step per 14 px, up for more, the wheel a step
  per 30 px, scrolling down for more (`wheelSteps`), a click above or
  below the middle, the arrows, Home, End and Page Up / Down; no typing;
  a value between stops (a factory ratio of 1.41, a level of -30.75 dB, a
  share of 26 %) is shown and kept as it is, in a slot of its own, until
  a turn takes it to the next stop that way, and one beyond them (a
  ratio of 40 from a link) stays until turned back in; it eases between
  values unless motion is reduced. Last, two small read-only drawings
  to compare the operators by, the envelope and Key scaling
  (`.voice-mini` buttons: a click selects the row and opens that tab of
  the operator panel, where each is edited); a row clicked or focused is
  selected (`selectedOp`; one always is, and presets, links and stepping
  keep it) and marked by an ink bar down its left edge (the pointed
  row's; no outline: Jeremy, 2026-10-20), and nothing else on a row changes with the
  selection, so the columns never change width. `paramControl.ts` is the
  ratio's and level's slider (`createSlider`); `voiceFormat.ts` writes times, dB, cents
  and keys the same everywhere. `envelopeView.ts` is the operator panel,
  always open: the selected operator's tag and role and two tabs,
  Envelope and Key scaling (`role="tab"`, arrows between them; a change
  of tab glitches the screen, `glitchScreens` in `ui/screenGlitch.ts`;
  push keys with jewel lamps, as the Voice's are, at the header's
  right-hand end, so they read apart from the tag and role),
  and the Envelope tab: the curve with a dot to drag at the end of each
  part (across for the time, up and down for the level), and seven knobs
  under it. `keyScalingView.ts` is the Key scaling tab: the curve
  large (a drag up or down at either side of the break point sets its
  depth, a click turns its curve, the break point's line drags sideways;
  from the keyboard up and down, with Shift the left side, left and
  right for the break point, C to turn), and under it Left curve (LIN |
  EXP, a radio group of the tabs' push keys, lamps and all, chosen on
  the press, arrows between; Jeremy, 2026-10-20), Left depth, Break
  point, Right depth, Right curve (the same)
  and Speed-up (the envelope's, per octave). On these two tabs and on
  the LFO and Pitch EG tabs the knobs' values are written on the screen,
  not under the knobs (Jeremy, 2026-10-20): a 22 px band at the screen's
  foot (`VALUE_BAND`, `drawValueStrip` in `viz/plot.ts`, the areas ending
  above it) under a faint rule, each value centred over its dial,
  glowing (on a phone, where the knobs wrap, each row's values a smaller
  line of their own); `ui/screenValues.ts` reads each knob's hidden readout and its
  dial's place (`knobValues`) and redraws when the row lays out. The
  curves' LIN | EXP keys have no value of their own. `knob.ts` is
  the knob: a `role="slider"` turned by dragging up
  or down or with the keys the Bessel plot answers to, drawn as a VFD
  dial, cyan segments lit to its value on dark glass (21 segments,
  `litSegments`; Jeremy, 2026-10-20), its name and its `.num` value
  under it (hidden in the sandbox's panels, whose screens show it), time knobs on a log scale, and a two-sided one lit from its
  `centre` to the value;
  `besselControls.ts` makes the Bessel plot a control: the canvas is a
  `role="slider"` for the index (drag, or arrows, Page Up / Down, Home,
  End), pointing at a curve, a spectrum stem or a J button sets `hover`,
  pressing a J button sets `pinned`, and one button sets the index where
  the carrier vanishes;
  `transport.ts` is the main button (Play / Stop, or Play note in
  `noteMode`, Play on the landing view), the space bar that does the
  same, and the two checkboxes;
  `terms.ts` gives the marked terms their tip (on hover, focus or a first
  tap; a second tap, a click or Enter follows the link to the glossary)
  and their screen-reader description;
  `themeSwitch.ts`; and `figures.ts` redraws a canvas on patch, size,
  theme and font changes, keeps its `aria-label` describing what it shows,
  and runs the waveform's animation loop while it should move
  (`waveformMoves`: sound playing, a moving view, and
  no `prefers-reduced-motion`).
- `src/styles/` — `tokens.css` (colours and fonts), `base.css` (the two
  panes, type, figures and the controls) and `instrument.css` (the
  sandbox's instrument page and its keyboard). A slider takes
  `--slider-fill` for its filled part and thumb where it is set, ink
  otherwise. The sandbox's sliders (Ratio, Level and Volume, under
  `[data-view='instrument']`) are drawn as faders instead (Jeremy,
  2026-10-20): a dark slot, a black cap with a glowing cyan line, a
  scale of 21 ticks under the slot (`--vfd-fader-scale`, an SVG), no
  filled part and no role colour; still the native range input, its
  size, keys and focus ring. The operator's blue or green stays on the
  tags, the row shading, the diagram and the plots.
- The page is hidden (a style in `index.html`) until `main.ts` has
  mounted everything and the fonts are in, then shown by setting
  `data-ready` on `<html>`; a 3 s CSS fallback shows it regardless. This
  keeps layout shift at 0; anything that draws the page must be mounted
  before that point.
- `public/` — files copied to `dist/` as they are (`robots.txt` too): `favicon.svg` (follows
  the system theme), `favicon.ico` and `apple-touch-icon.png` (rendered
  from it; the home-screen icon is light, full-bleed paper). An XML
  comment cannot contain two hyphens in a row, so don't name CSS tokens in
  one.

Known limits: the synth is not band-limited, so a high carrier with a high
ratio and index aliases. `vibrato`'s moving waveform runs on the page's
clock, not the audio's, so its wobble has the sound's rate but not
necessarily its phase.

## Layout on screen

The lab stays in view while the text scrolls (Jeremy asked for this on
2026-10-14). On a wide screen (62rem and up) the page is exactly the
window's height: the masthead, then the text column scrolling on its own
(`#narrative` is a tab stop for that), and beside it the lab, whose
figures share out the height the controls leave (`.plot-frame` holds each
canvas so it can fill it). A chapter with more than four sliders, or with
the piano, sets them in two columns there. Below 62rem the lab moves above the text and
sticks to the top of the window, compact: figures a fifth of the window
high, captions for screen readers only, sliders and presets folded behind
a Sliders button. The text keeps at least two fifths of a phone's height.
The landing view is laid out the same way, so going on from it moves
nothing; only the glossary is one centred column. Check every chapter at
both sizes after adding controls or figures.

The sandbox is an instrument page (`body[data-view='instrument']`;
Jeremy approved it on 2026-10-18: "the existing app, just full page and
with a better looking keyboard", six operators only): no text column;
the masthead is its title bar (Jeremy, 2026-10-20, "more stand alone"):
the wordmark (home), then in the place of Contents, which the sandbox
hides with the crumb, the preset group, 40px after the wordmark, the
free room right of it (Jeremy, 2026-10-22; it was centred between the
wordmark and Volume), the name's box as wide as the widest name so
nothing in it moves from voice to voice, with no label of its own
(Jeremy, 2026-10-22: the Preset label is gone; for screen readers the
group is named Presets): the voice's name on a VFD (Jeremy,
2026-10-21; `.preset-name`): glowing cyan capitals in Plex Mono on dark
glass in a small bezel of the tab strips' plastic (seven segments
cannot spell the names), 14 characters wide, the longest name's, so
nothing moves from voice to voice, its ▾ the sign that it opens
something, a dimmer EDITED once the sound is changed, and a ring round
the glass for keyboard focus only. The name is a button (Jeremy,
2026-10-22; `.preset-pick`, named "Preset: A11 E.PIANO 1" or "Preset:
Edited", `aria-haspopup="dialog"`): a press, Enter or Space opens the
preset window (space never plays on it), and its arrows step the voices
as its two step keys do. Those are right of it, up and down, side by
side in one `.chooser` bezel (`stepPreset` over all 64 from the voice
last chosen, across the banks, ˄ on and ˅ back, "Next preset" then
"Previous preset" (`PRESET_STEP_KEYS`; Jeremy, 2026-10-23: the other
way was "wired in reverse"): the algorithm and
octave choosers' black push keys, their ‹ › turned a quarter, 1.65rem
high, so the title bar keeps its height; stepping on the press, never
disabled; Jeremy, 2026-10-21); on the name and the keys the arrows step
too (`PRESET_ARROW_STEPS`), up and right on, down and left back. Its note, what the voice plays
without, is not shown but is the name's description for screen readers
and follows the credit in its tip.

The preset window (`presetPanel.ts`, `mountPresetPanel`; Jeremy,
2026-10-22, "more consistent with the settings UI ... use a modal
window"): a modal dialog named Presets in the Settings case
(`.settings-panel`, 760px wide or the window less 32px), every label in
it silkscreen (`--font-tape` capitals in `--chassis-legend`, as the
knobs' names; no plate). Its head: the title, then the bank keys A |
B with a "Bank" legend (a group named Bank, each key "Bank A: DX7 factory
voices © Yamaha" or "Bank B: fmlab voices", lit for the bank shown), and
Close at the right. Its glass, a listbox, shows the shown bank's 32 in
four columns of eight numbered down them ("11 E.PIANO 1", the number
dim), the voice playing lit as Settings' selected line while its bank
is shown (none once Edited). Under it ‹ › step all 64; no legend (Jeremy,
2026-10-22): bank A's credit is in its key's name and the name's tip. A
bank key only shows its bank: it never changes the sound; a press on a
voice loads it (both top screens glitch) and the window stays open, so
voices can be heard one after another. On the glass up and down go one
voice, left and right a column of eight, keeping the row, all across the
banks and round the ends (A25 right to B1, B32 down to A1), Home and End
the shown bank's first and last (`gridMove`); each loads its voice. With
the other bank shown than the voice playing's (or, once Edited, the last
chosen's), the arrows and ‹ › start in the shown bank: on to its first,
back to its last (Jeremy, 2026-10-22).
Whenever the glass turns to the other bank, by a bank key or a step
across, it glitches as the top screens do, alongside theirs. Enter
closes, keeping the voice; so do Close, Esc, a press and release both on
the dimmed page, or the name again, and focus goes back to the name. It
opens on the playing voice's bank, or the last chosen's once Edited
(`openingBank`); the note keys and Z / X play, and the space bar stops,
while it is open. The shown bank is in neither the link nor storage. On a phone it
is the window's width less 16px a side, two columns of 16 (left and
right then move by 16), the bank keys under the title if they must wrap.

After the preset group, Volume, its name silkscreened on the chassis in
the thicker weight (`--font-tape` 500 capitals in `--chassis-legend`, as
the operators' roles; Jeremy, 2026-10-22: no plate), the Settings key; no glossary link (Jeremy, 2026-10-21: the chapters keep
theirs) and no theme switch: the sandbox is dark only (Jeremy,
2026-10-22). Whatever is saved or the system says, `applyTheme(choice,
sandbox)` sets `data-theme="dark"` while the sandbox shows (set where
`chapterView` sets the view, before anything redraws) and puts the saved
choice back on leaving it; the boot script in `index.html` does the same
for an address of `#/sandbox`, so the first paint is dark. The light
sandbox rules still in the CSS are unused. The Settings key
(`ui/settingsPanel.ts`, `mountSettings`; Jeremy, 2026-10-21, "the
function panel, named SETTINGS") is one lamp key in its own bezel, lit
while its panel is open (`aria-pressed`, `aria-expanded`), worked on
the press; the panel a modal `<dialog>` named Settings, a console of
the chassis's black plastic the same in either theme over a page dimmed
35 %: "Settings" on a silkscreen plate, two tabs, General and MIDI (Jeremy,
2026-10-23; `.pill-tabs`, the Voice tabs' keys, the arrows between them,
on a line of their own under the title on a phone; always opening on
General, the tab not kept; a change glitches the glass) and a Close key
(a push key with no lamp: it has no state to show), a VFD screen in a
molded bezel listing the open tab's settings one line each (both tabs'
lines in the glass's one cell, the closed one unseen, so the glass is
the longer list's size on either, kept as tall as it was with the
control row that used to be under it). Every line is edited in place
(Jeremy, 2026-10-23): group dim (none on the MIDI tab), name, and at its
right ‹ value ›, the arrows glowing dimmer, dimmest at an end, the value
cut short with an ellipsis, its whole in its tip; the selected line lit
behind with a bar at its left. Each line is one control (a
`spinbutton`, named by group and setting, its value `aria-valuetext`,
focus roving, a ring only from the keyboard): Up and Down, Home and End
move between the tab's lines; Left and Right (or the arrows, on the
press) step the value, held at the ends; its value, Enter or Space open
its drop-down: a listbox on the same VFD glass under the line, over the
screen, scrolling inside itself within the case and the window, the
option the keys are on lit, the chosen one barred, a long name cut short
with its whole in the tip; Up, Down, Home, End, Page Up and Down move,
Enter, Space or a click choose and close it, Esc (the list first, then
the case), Tab or a press elsewhere close it as it was, focus back on
the line; the note keys still play.
Changes apply and are saved as they are made; Esc, Close, the key or a
click round the case closes it, focus going back to the key; the note
keys and Z / X still play while it is open. The settings, General's: Screen glitch
(On, Off), Motion (System, Still), Tips on hover (On, Off: the
sandbox's native titles put away in `data-tip-off` and the terms' tips
hidden, names and descriptions kept), Z X hint (Hover, Always, Off),
Note names (C only, All: every white key, Off), Computer keys (Off, On:
the computer key that plays each piano key, small at its foot), Wheel
(Page, Reverse); MIDI's: Input (All inputs, then each connected input
by name in the browser's order, `midiInputs`; a chosen input not
connected stays, "(not connected)", until another is chosen), Channel
(All, 1 to 16) and Bend range (±1, ±2, ±3, ±5,
±7, ±12 st) (the
reverb's are on the Voice section's Reverb tab, Jeremy, 2026-10-22);
`applySettings` sets them on `<html>` (`data-motion`, `data-tips`,
`data-zx`, `data-note-names`, `data-computer-keys`) for the CSS. On a
phone the key has the line under Volume's (beside it the fader would
be too short to use). Chapters have neither the key nor
the settings. Their containers
(`#inst-dx7-presets` in a group named Presets, `#inst-tools`) are in the
masthead's markup and shown on the sandbox only; `PLACES` moves the
lab's nodes into them. The masthead keeps every page's height, with no
rule under it (Jeremy, 2026-10-21): the top panel's edge is the line. No Play or Copy link: the keyboard
plays, the space bar stops (it strikes no note here: `pressSpace`), and
the address bar keeps the sound. The page's
title, "Sandbox" (`#inst-title`), is for screen readers only. Then,
in layout F (Jeremy, 2026-10-18), a top band: on the left, the
title Voice at the top left, the band's first row, with
a row of tabs, Algorithm | LFO | Pitch EG | Reverb, at the right of its line (`lfoView.ts`;
on a phone on a line of its own under the title, the keys sharing it;
`.pill-tabs`, shared with the operator panel, drawn in the sandbox as an
8-track player's black push keys in a bezel, the open one pressed in
with its amber jewel lamp lit and its legend glowing warm, the others
up with unlit lamps and grey legends; Jeremy, 2026-10-20; role tablist, arrows
between; a change of tab glitches the screen's glass, and a preset
chosen glitches both top screens, each its own kind and never the two
alike (`ui/screenGlitch.ts`, `glitchScreens`, `topScreens`; not on load, a link, an edit or an
operator selected); the sandbox always opens on Algorithm, and the open tab is in
neither the link nor storage; while closed, the LFO's key shows a dot
(amber in the sandbox), "LFO, on", when vibrato or tremolo, the mod
wheel's share counted, is above 0, the Pitch EG's,
"Pitch EG, on", when the pitch envelope is not flat; and the Reverb's,
"Reverb, on", whenever the reverb is on, a setting, its tab open or not;
the Reverb key's light is always there, unlit while it is off, so the
key keeps its width). Each tab is laid
out as the operator panel is (Jeremy, 2026-10-20; `.inst-voice-tab`):
its display the panel's width, the same size whichever tab is open (the
row under it is one height for all four), over one row of its controls;
on a phone each display is 9rem high and its row wraps. The Algorithm
tab: the wiring diagram, and under it the algorithm list between ‹ ›
(`stepAlgorithm`, round the 32; the ‹ › the tabs' black push keys
without a lamp, stepping on the press, all three in one bezel, the
`.chooser` the octave control shares), its number shown on a two-place
VFD readout 48px wide, the list unseen over it so a click
opens it and the keys choose, keyboard focus ringing the glass and a
click's not, and beside them the Feedback knob (`mountFeedbackKnob`, 0
to 2π), its dial level with ‹ ›, its name under it and no readout:
its value is on the diagram's glass, "FB 3.14", at the right halfway
down. The LFO tab: a still drawing of the LFO for two seconds after a
key (`viz/lfoPlot.ts`, the delay shaded, ±1; the swing lit full
while the depth heard, the wheel's counted, is above 0, at about half
while it is 0, and its description says that depth), and under it the wave, six
icon keys (a radiogroup, unlabelled on screen: Triangle, Saw down, Saw
up, Square, Sine, Sample and hold), drawn in the sandbox as the tabs'
push keys without lamps, chosen on the press; Speed (log), Delay (log,
0 at the bottom), Vibrato (log, 0 at the bottom), Tremolo, and what the
mod wheel adds to those two at full, "Wh vib" and "Wh trem" (named
Wheel vibrato and Wheel tremolo for screen readers; log, 0 at the
bottom; the full names do not fit at 1280 wide), six knobs, the waves
and the knobs' columns a little narrower to fit beside Key sync; and
Key sync, one of the tabs' push keys (`aria-pressed`, pressed and lit
while on, worked on the press; Jeremy, 2026-10-20). The Pitch EG tab (`pitchEgView.ts`):
its curve (`viz/pitchEnvelopePlot.ts`, its name, "Pitch envelope", for
screen readers only; drawn as the operator envelope's, each part's slot
ended at its glide's time on the log scale; its y scale symmetric,
fitting the largest bend and never under ±1 st, settled when a drag
ends, labelled as the readouts are; a dot at Start and at each part's
end dragging up and down only), and eight knobs in a row: Start,
Attack, Peak, Decay 1, Break, Decay 2, Sustain, Release (pitches two-sided, ±48 st; speeds log in st/s).
The Reverb tab (`reverbView.ts`; Jeremy, 2026-10-22, mock B): the plate
reverb's controls, settings of the instrument (`settings.ts`, saved per
browser; not the voice, the link or a preset), moved there from the
Settings panel. Its screen (`viz/reverbPlot.ts`) is the plate's response
to a click as two decay curves, LOWS under about 500 Hz lit full and
HIGHS over about 4 kHz at half (`bandEnvelopes`, energy in windows of
50 ms or a column), each set against its own start (`fromStart`) and
starting at the wet's level for the Mix, level in dB 0 to -72 down the
left, time from the key to 1.25 times the decay plus the pre-delay
(dotted where it ends), a dashed marker at -60 dB under the start at
the Decay set, "DRY … WET …" at the top right, and everything but the
frame at about 45 % with OFF beside it while the reverb is off; still,
not moving while notes sound. The curves are worked out on the real
plate in a module worker (`dsp/reverbResponse.ts`,
`reverbResponse.worker.ts`, made when the tab is first shown), only the
last asked counting, the last eight kept; Mix and Pre-delay only move
them. Under it four knobs centred as the Pitch EG's, Pre-delay (0 to
500 ms, log from 1 ms, 0 at the bottom), Decay (0.2 to 20 s, log), Mix
(0 to 100 %: dry min(1, 2(1 - mix)), wet min(1, 2 mix)) and Tone (0 to
100: damping 0.7 (1 - tone / 100)), their values on the screen, and the
On key at the row's right end (three columns, 1fr auto 1fr; its bezel
in by its lit edge's reach so its edge is the screen's; on a phone after
the knobs at the right).
`formatPitchBend` writes a bend in cents under a semitone, else in
semitones; `formatGlideSpeed` a speed in st/s. Where a row's values on
the screen would touch (the LFO's six at 1280 wide), `drawValueStrip`
sets them a size smaller. Voice, Operators and the Settings window's
title are printed on the chassis as a plate (`.silk-plate`; Jeremy,
2026-10-23, the Dymo tape retired): a block of `--chassis-legend` with
the word knocked out of it in `--chassis-legend-ink`, the chassis black,
as Roland and Yamaha mark their panel sections; flat print, `--font-tape`
500 capitals; Voice and Operators fill the tape's 24px line with 17px
letters (Jeremy, 2026-10-23: a size up), the Settings title 20px tall
with 2px either side and 14px letters. The keyboard's Octave and Mod are the knobs' names' standard
silkscreen. The text stays in its own case in the markup.
On the right the operator
panel (`#voice-envelope`) alone, the showing tab's curve filling it. Each
screen keeps its box, and its glass, the canvas, sits 7px inside a
molded bezel (`.screen-bezel`; the diagram's and spectrum's
`.plot-frame`), sized so it still measures its own box. On
a wide screen the Voice screen and the operator screen share their top
and bottom edges whichever tabs are open: the heads as tall and as far
above their screens, and both control rows `--kv-row` high (4rem; 3.6rem
under 52rem high). Every control row's dials are one size,
`--row-dial` (2rem, the Pitch EG row's; Jeremy, 2026-10-21), and every
row's dials, push keys (their bezels a dial tall; the algorithm chooser,
the LFO's waves and Key sync lifted onto the dials' line) and knob names
fall on the same two lines in all five rows.
The top band's tab keys' bezels end where the screens under them do
(Jeremy, 2026-10-22): their lit edge reaches past the box by
`--lamp-bezel-reach` (2px), a screen's black edge by 1px, so they stand
in by the difference (on a phone, on both sides of the line).
The page is three bodies of the same molded black plastic, the
`.chassis` (Jeremy, 2026-10-21), an even 10px apart, and 10px under the
title bar (Jeremy, 2026-10-22: a little less than the 15 to 17px they
were, the room given to the top band's screens) with no rules
between them or under the title bar, and only a black edge (no light
one, which read as a white line): the top band (Voice and the operator panel, padded 9px
12px, all four corners rounded), the operator table's panel (its
Operators plate on the column heads' line, over the tags and roles,
whose heads are for screen readers only, so the table starts a line
higher) and the keyboard's foot. The top two are `.chassis-ink`: they
take the dark theme's tokens in either theme (tokens.css), their text
the light silkscreen `--chassis-legend`; the number reels keep the
page's own paper and ink (`--page-*`), and the screens' bezels are
recesses in the plastic, as the spectrum's. On a phone they are the
same panels stacked, the Voice column held to the panel's width.
Under the band the operator table (`#voice-table`) the full width, its
rows a little taller than they were (Jeremy, 2026-10-22: the table's
panel is `flex: none` and the band flexes, so taller rows take room from
both top screens alike): reels, faders and readouts 2.03rem (1.68rem
under 52rem high), the VFD digits at most 22px (18px), the small
drawings 2.2rem (1.68rem) and the body cells 0.25rem (0.15rem) top and
bottom, rows of 46px at 1440 × 900 and 34px at 1280 × 800; the top band
keeps only 2px of padding under its control rows (about half the gap
under the knobs' names), its screens taller by the 7px; then
the foot (`.inst-foot`), one chassis of the tab strips' molded black
plastic (Jeremy, 2026-10-21; rounded at the top, square at the foot, the
same in both themes but its edge): the control panel and the keys on
the left, the keys let into it and running to its bottom edge, the
chassis above them their rail and its ends their cheeks; the white keys
2.9rem wide under 1380px, so the spectrum keeps its room; the spectrum
(`#inst-figures`) filling the rest of the row, no taller than the
keyboard, its bezel a recess in the chassis with 9px of it underneath,
with no ink rules round it (its glass is its frame), and no x-axis
title (Jeremy, 2026-10-21: its canvas's `--plot-title: none`; `drawFrame`
draws none and `beginPlot` gives the plot that line, `UNTITLED_BOTTOM`);
its numbers and its screen-reader description stay. It is on log
frequency (20 Hz to 20 kHz) and dB axes (`drawLogSpectrum`, one row of
numbers under it). Carriers are solid blue and modulators
green outlines in the table (filled or outlined tags, carrier rows
shaded); the diagram is a VFD panel, carriers lit solid and modulators
dimmer cyan outlines. The envelope, Key scaling and pitch envelope
graphs, large and the table's small ones, the LFO's drawing (its wave
lit full) and the spectrum (its
negative stems lit as the rest, the measured curve cyan) are VFDs too (Jeremy,
2026-10-20): the same drawings, their tokens remapped in CSS to cyan on
dark glass, everything but the area fills glowing (`--plot-glow`, which
`beginPlot`'s `glow()` reads: what glows is drawn on a layer, laid on the
canvas in one shadowed pass); a carrier's curve lit full, a
modulator's at about half. Blue and green stay on the table's tags and
shading and in the chapter pages' plots. On a wide screen it is one window high and
nothing scrolls, at 1440 × 900 and 1280 × 800; the figures' captions are
for screen readers only there, and under 52rem high the rows, drawings,
knobs and gaps tighten. Below 62rem it is one column: the masthead
wraps, the wordmark and the theme, then the presets (the name's VFD and
its up and down keys on one line), then Volume on a line of its own, then Settings; the keyboard
and the spectrum over it docked to the screen's foot in the chassis, the
full width and square (the spectrum, then the octave control and the
wheel without their labels, then the keys), the operator panel
first (its tabs on a line of their own), the controls scrolling under it, and the
operator table as cards, each with its drawings.

Wheel controls scroll with the page's direction (Jeremy, 2026-10-20):
positive deltaY, scrolling down, is the next value below, as a page
would scroll to it. On the number reel, where larger values sit below,
that is a step more; on the mod wheel, too, scrolling down is more, 1 %
for each 10 px. The sandbox's Wheel setting on Reverse turns every reel
and the mod wheel the other way (`wheelSteps`, `wheelAfterScroll`); the
knobs take no wheel. Drags and arrows are unchanged.

## Styling

The look is a 1973 paper: paper, ink, and three pens for the plots.

- Every colour is a token from `src/styles/tokens.css`, light on `:root`,
  dark under `prefers-color-scheme` (unless `data-theme='light'`) and under
  `data-theme='dark'`. The dark values are written in both blocks; keep
  them identical. Both themes must work, but for the sandbox, which is
  dark only.
- Tokens: `--paper` (page), `--paper-sunken` (wells, control tracks),
  `--grid` (plot grid), `--rule` (axes, hairlines), `--ink`; pens
  `--pen-blue` (carrier and output traces, positive sidebands),
  `--pen-green` (modulator), `--pen-red` (negative sideband phase).
- The sandbox's control names are silkscreen capitals printed on the
  chassis (Jeremy, 2026-10-21): every knob's name (`.knob-label`, the LFO
  row's a little smaller, on the same line box), the curves' names under
  LIN | EXP, the operator table's column heads and, on a phone, its
  cards' column names, in `--font-tape` and `--chassis-legend`, the same
  in either theme. The text stays in its own case and CSS sets the
  capitals; a unit is a `.unit` span that keeps its case ("LEVEL dB",
  "DETUNE ¢"). The operators' roles, carrier and modulator, in the
  table and on the operator panel's head, are the same capitals a weight
  heavier (Barlow Condensed 500, not italic; Jeremy, 2026-10-22). The
  chapters' names and roles are unchanged.
- All text is pure `--ink`, never a grey. Use weight, size and italics for
  hierarchy. The exception is text printed on the sandbox's chassis
  panels, which is the light silkscreen `--chassis-legend`, as the push
  keys' legends are printed, and the same in either theme.
- Colour appears only in plots, rules and control fills, with one
  exception: the VFD readouts (the operator table's, the algorithm's),
  every knob's VFD dial, the line across the sandbox's fader caps, the
  sandbox's algorithm diagram, its envelope, Key scaling, pitch
  envelope and LFO graphs, large and small, its spectrum and the preset's name glow cyan on dark glass, in both themes (Jeremy, 2026-10-20;
  `--vfd-*` tokens, the same in every theme but for a faint light edge
  in dark and the faders' scale, in ink). They
  are a drawn display, not text, so the ink rule above does not apply
  to them. The sandbox's tab keys add a warm lamp light (`--lamp-*`,
  the same in every theme but the bezel's edge): amber appears only as
  the light behind those keys, and cyan stays the glass displays'
  colour. The sandbox's large screens sit in molded black bezels, the
  tab strips' plastic (Jeremy, 2026-10-21); the operator table's small
  glass has none. The sandbox's three bodies (the top band, the
  operator table and the keyboard) are that plastic too (`.chassis`),
  the same in either theme but the edge. The keyboard's chassis, its keys
  and the spectrum let into it; the felt under its rail is charcoal, not
  red, because red is reserved for negative phase. The mod wheel's drum
  is black rubber, its index line painted white, and its bar a VFD.
  The sandbox's Voice, Operators and Settings labels are silkscreen
  plates (`.silk-plate`: `--chassis-legend` with the word knocked out in
  `--chassis-legend-ink`, the same in either theme), and every other
  label printed on its chassis, Octave and Mod among them, is the knobs'
  names' silkscreen.
- Red means negative phase and nothing else: controls and the focus ring
  are ink. Never let phase rest on colour alone; a negative stem also gets
  a hollow marker. In the sandbox's VFD spectrum, a negative stem is
  shown by its place and hollow end alone. The logo's middle stripe is a
  deep rust (`--logo-rust`), not red, for this reason.
- The logo, in every page's masthead and the way home (`.wordmark`,
  index.html; Jeremy, 2026-10-21): "fmlab" in wide lowercase
  (`--font-logo`, Michroma) over three straight racing stripes, amber,
  rust and teal (`--logo-*`; Jeremy chose the rust over a red,
  2026-10-21), in ink on either theme, 2.28rem (148 × 52px).
  Clean on the chapters; in the sandbox only, the paint is lightly
  chipped by a fixed noise mask (the same every visit). The word is the
  link's name; the stripes are hidden from screen readers. It sets the
  masthead's height, 51px (3rem); the chapters take the 0.585rem it
  added from the space under the masthead, so their panes sit where they
  did, and the sandbox's screens give it up through their flex. The
  favicon stays the carrier and its sidebands, which reads at 16px where
  the stripes would not.
- A figure sits between two ink rules (`.figure`) with an italic caption,
  "Fig. n" then an em space then the title. Where the lab is pinned
  beside the text, its figures share one plate instead: an ink rule above
  the first and below the last, a `--rule` hairline between them (but
  not round the sandbox's VFD spectrum).
- Fonts, self-hosted through `@fontsource` (latin subsets, imported in
  `src/main.ts`): `--font-display` (Fraunces 600: headings),
  `--font-sans` (Figtree 400 to 700, italic for figure captions:
  everything else), `--font-mono` (IBM Plex Mono: numbers, with tabular
  figures; `.num`), `--font-tape` (Barlow Condensed 400: the sandbox's
  printed labels, its knob names, Octave and Mod, its operator table's
  heads, and at 500 its section plates, the operators' roles and
  Volume's name), `--font-logo` (Michroma 400: the logo only). A
  weight that is not imported there is not available.
- A canvas has no CSS: draw code reads the tokens with `getComputedStyle`
  and whoever mounts it must redraw on resize, theme change and
  `document.fonts.ready` (`mountFigure` in `src/ui/figures.ts` does).
  A figure the page hides (no box) is neither drawn nor animated; its
  ResizeObserver draws it when it is shown again (Jeremy, 2026-10-22).
  While a note sounds the sandbox's predicted stems are worked out at
  most every 100 ms, or when a level moves half a dB (`soundingLinesHold`);
  the measured trace every frame. The Play label's timer is armed only
  for a note with an end (`labelTimeout`): a key held has none.
  Give every canvas `role="img"` and an `aria-label` saying what it shows.
  A canvas that is a control (the Bessel plot) is a `role="slider"`
  instead, focusable, with its value kept in `aria-valuenow` and
  `aria-valuetext`; anything it offers by hover must also be reachable by
  keyboard and touch (the J buttons).
- Controls are ink on paper (`.btn`, `.slider` in `base.css`), but for
  the sandbox's faders. Give every
  input a visible `<label>`, and a readout in `.num`. Anything that is not
  a control must not look like one.
- Show real units beside carrier units wherever a frequency or time
  appears (the ratio's readout adds the modulator's Hz; the axes add Hz
  and ms).
- An axis in carrier units does not move when the carrier does: only its
  second row of numbers changes, which reads as nothing happening. Where
  a chapter's lesson is the carrier's own frequency, set `realUnits` so
  the axes are fixed in ms and Hz. Keep carrier units where the lesson is
  ratios and sidebands.
- The theme switch is a small icon button, as frets has it: a half-filled
  circle for Auto, a sun, a moon, in ink with no border; it is named
  "Theme: Auto" and its tip says what a click does. It cycles Auto,
  Light, Dark and saves the bare word under
  `localStorage["fmlab.theme"]`. The boot script in `index.html` reads the
  same key; keep it in step with `src/model/theme.ts`. It is on every page
  but the sandbox, which is dark only.
- Focus rings are for the keyboard: every focus style is on
  `:focus-visible`, never `:focus`, so a click, a tap or a drag leaves
  none; Tab still rings every control. A browser also turns
  `:focus-visible` on for a clicked control as soon as any key is
  pressed, so in the sandbox `ui/focusSource.ts` marks `<html>` with
  `data-focus` (pointer or keyboard, set when focus arrives; only Tab
  counts as keyboard), and the rings, the preset name's underline, the
  algorithm's glass ring and the Z X hint show only for keyboard focus:
  playing the keys after clicking a slider leaves it unringed. The sandbox is an instrument,
  not a page to read: nothing on it is selected by a double click or a
  drag (`user-select: none` on its body), and a tap leaves no flash
  (Jeremy, 2026-10-21). The chapters' text stays selectable.
- The space bar is Play / Stop on every page, including stopping a note
  that is sounding; in the sandbox, which has no Play button, it is Stop
  only and never strikes a note (`pressSpace`; Jeremy, 2026-10-23). It is left alone on a button, link, checkbox, maths
  panel or anything typed into; on a slider, where space means nothing,
  it plays and stops. A "Space: play / stop" hint shows where there is a
  pointer that hovers.
- Motion: `envelopes`'s two figures show a playhead while a note sounds,
  and the landing view's follow its sound; under
  `prefers-reduced-motion` they simply stay as they are, and the sound
  still plays. The other
  thing that animates is `vibrato`'s waveform, while sound
  plays (it opens on a 0.5 Hz modulator, a slide slow enough to follow).
  Under `prefers-reduced-motion` it stays still and the caption says
  why. The sandbox's two top screens play a short analog glitch when
  their tab changes, and both when a preset is chosen (with the preset
window's glass when it turns to the other bank, `glitchScreens` taking
any element): one of phosphor
  flash, segment refresh, jitter, tear line and scanline flicker, at
  random, never the same twice in a row on a screen, and on a preset the
  two screens never alike (`nextGlitch`, `nextGlitches`), 120 to 190 ms
  (Jeremy, 2026-10-21); on the glass only, cyan only, never moving the
  layout or redrawing a plot; none under reduced motion, and its own
  setting turns it off. In the sandbox the Motion setting on Still acts
  as `prefers-reduced-motion` does (no glitch, no reel easing, no
  playheads or moving views, no CSS transitions): everything that moves
  asks `motionReduced()` (`ui/motion.ts`), the media query or the
  setting, and listens with `onMotionChange`. Anything
  else that moves must do the same.

## Testing

Tests live in `src/__tests__/`, in a folder named after the one they test
(`dsp/`, `model/`, `audio/`, `viz/`, `chapters/`, `ui/`). Vitest runs them in the `node`
environment with globals on; there is no jsdom yet, so add it when the
first DOM test needs it. Test the maths against published values (Bessel
tables), identities and each other (the kernel against `fmSample` and
`fmSpectrum`), not against the code's own output. The engine and the
worklet need a browser, and there is no meter on the page: check sound by
listening, or in a script by tapping the graph with an `AnalyserNode`.
