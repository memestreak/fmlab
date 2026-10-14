# fmlab

An interactive guide to FM synthesis: a single page of short chapters, each
built around a figure you can play with and hear. Design spec:
`docs/specs/2026-10-13-fmlab-design.md`. The app has no users yet: don't
keep old URLs, storage keys or saved state working after a change.

Vite, vanilla TypeScript (strict) and Canvas 2D; no UI framework. Vitest,
ESLint. Sound comes from one AudioWorklet phase-modulation engine. Deploys
as static files to Cloudflare Pages (`DEPLOYMENT.md`).

The page is a chapter at a time: its text in a narrative pane, and the lab
(Play / Stop, sliders and two figures) beside it, or under it on a narrow
screen. The chapter is in the URL's hash (`#2`); with no hash the site
opens on the landing view, one line and a Play button whose sound the two
figures move with, and then the ways on. Version 1's seven
chapters are all written: 1 "A single sine", 2 "Vibrato becomes timbre",
3 "Modulation index", 4 "Sidebands and Bessel functions", 5 "Carrier to
modulator ratio", 6 "Time-varying index" and 7, the Sandbox; numbers are
the spec's. They use one carrier and one modulator. Version 2 has 8
"Operators and algorithms", six operators wired by the DX7's 32
algorithms, and 9 "FM versus PM", the same patch as phase and as true
frequency modulation side by side.

## Commands

```bash
npm run dev      # Dev server at localhost:5173
npm run build    # Production build to dist/
npm run preview  # Serve dist/ at localhost:4173
npm run lint     # ESLint
npm test         # Vitest
npm run typecheck  # tsc --noEmit (covers tests and config files too)
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
  `git rev-parse --short HEAD`, `dev` without git).
- `src/model/` — state, no DOM except in `theme.ts`. `store.ts`
  (`createStore`: get, set, subscribe; listeners run synchronously inside
  `set` and get the previous state too), `lab.ts` (`LabState`; the ranges
  and defaults; the log scales of the carrier and modulator sliders) and
  `theme.ts` (the choice, its storage key, `applyTheme`). The URL holds
  the chapter and, for a chapter with `sharesSound` (the sandbox), its
  carrier, ratio and index: `#7?c=220&r=1.41&i=5`.
  The patch is held two ways, by `mode`. `pm` (everywhere but chapter 2):
  `ratio` and `index`. `fm` (chapter 2): `modHz` and `deviationHz`.
  Chapter 9 (`compare`) shows both: Fig. 1 draws `asPm(state)`, Fig. 2
  (`#compare`) `asFm(state)`, FM matched at ratio 1 (Δf = index × fc, so
  its index is index / ratio); `mode` is only what is heard.
  `patchOf(state)` gives a ratio and an index for either, which is what the
  figures and spectrum maths take; never read `state.ratio` or
  `state.index` directly outside `pm`-only code.
  There are two ways of playing. Most chapters hold a steady sound while
  `playing` is true. A chapter with `noteMode` (chapter 6) plays one note
  each time `notes` goes up, shaped by the envelope (`attack`, `decay`,
  `sustain`, `release`, `hold`; `envelopeOf(state)`), and
  `indexAtTime(state, t)` is the index at a moment of it.
  `momentOf(state, time)` is what a figure should draw at a time on the
  page's clock: the patch as set, or, while a note sounds, that moment's
  index and loudness.
- `src/chapters/` — a chapter is data (`types.ts`): number, title, lesson
  text and "The maths" panels (HTML strings, trusted because they are
  written here), the sliders it shows, the patch it starts from (all of
  it, so a chapter always opens the same way), optional `steps` (sections
  with a sound each, chapter 8), `showsPair` (chapters 3 to 7 draw their
  two operators small beside the text) and the figures it shows,
  each with its caption (they are numbered from 1 in the order shown, so
  text that says "Fig. 2" must match the chapter's own list). A chapter
  may have presets, buttons that set several fields at once. Its patch is
  written as `BASE_PATCH` (`basePatch.ts`) with its own differences.
  `landing.ts` is the landing view, written as a chapter numbered
  `LANDING` (0) so that everything following the store's chapter needs no
  special case. It is not in `CHAPTERS`, has no hash and plays one long
  note.
  `index.ts` lists them (`CHAPTERS`, `neighbours`); `route.ts` reads and
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
  the signals at one instant, for drawing. `pmKernel.ts` (`PmKernel`:
  phase modulation a sample at a time, up to six operators through an
  `Algorithm`, now `TWO_OPERATORS`; no feedback yet) keeps each operator's
  phase locked to its ratio of the base frequency, easing it back after a
  ratio moves, so the sound stays the signal the figures draw.
  `fmKernel.ts` (`FmKernel`) is true FM for chapter 2 only, with no lock.
  `PmKernel` also takes an algorithm's feedback loop (the mean of the
  source's last two samples, as the DX7 does) and can be rewired between
  notes (`setAlgorithm`). `algorithms.ts` is the DX7's 32 algorithms,
  written in DX7 numbering and tested against the table in Dexed's msfa
  engine. `operators.ts` is chapter 8's maths: an `Operator` (ratio,
  level, decay), `kernelLevels` (a modulator's level is its index times
  `MOD_INDEX`; the carriers share the output), each operator's envelope,
  and `operatorSpectrum`, the predicted spectrum worked out by running the
  kernel and taking an FFT (`fft.ts`) with a flat-top window, since there
  is no Bessel formula for a stack.
  Tests hold kernels, samples and spectra to each other.
- `src/dsp/envelope.ts` is the envelope as a pure function,
  `envelopeAt(envelope, t)`: a straight attack, then exponential decay and
  release timed to four time constants. The engine schedules exactly that
  curve (a linear ramp, then `setTargetAtTime`), so the figures and the
  sound agree; change one and change the other.
- `src/audio/` — everything Web Audio. `synthProcessor.ts` is the
  AudioWorklet: it runs the kernels and has a-rate AudioParams `frequency`,
  `ratio`, `index`, and for true FM `modFrequency`, `deviation` and `mode`
  (1 is true FM). It is bundled on its own through the `?worker&url`
  import in `engine.ts`, and may import from `src/dsp` only. `engine.ts`
  (`AudioEngine`) follows the store: worklet, note gain, master gain,
  limiter (a `DynamicsCompressorNode`), speakers. It creates the context
  on the first Play, inside the gesture, glides params (30 ms linear
  ramps), fades the master gain in and out, suspends the context after
  Stop, and on a change of chapter fades out, jumps to the new patch and
  fades back in. For a note it schedules the envelope on the note gain
  and, if `indexFollows`, on the `index` param, 20 ms ahead so the last
  note can be brought down first.
  An `AnalyserNode` taps the sound before the volume, and `measure()`
  hands its spectrum to the live view.
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
  `realUnits` (chapter 1) both figures are on fixed axes in real units
  instead, 20 ms and 0 to 1000 Hz, so that moving the carrier moves what
  is drawn: more waves, and a stem further along. The spectrum
  can bracket Carson's band (`showBandwidth`) and rule a line at each of
  the carrier's harmonics (`showHarmonics`). `envelopePlot.ts` draws a
  note's envelope with three draggable dots, and `spectrogramPlot.ts` the
  same note as a spectrogram worked out from the patch (`sliceAt`), both
  on one time axis (`envelopeSpan`) and both with a playhead while the
  note sounds. `plot.ts`'s `drawFrame` takes the horizontal rows a plot
  wants; amplitude from -1 to 1 is only the default. `algorithmPlot.ts` draws an algorithm as the DX7 does (`layoutAlgorithm`:
  carriers on the bottom row, each modulator above what it modulates).
  `liveSpectrum.ts` is
  the spectrum's live view: the measured FFT as a filled --pen-blue curve
  over the predicted stems, drawn faintly, on the same axes
  (`drawSpectrumFrame`) and scale (`amplitudeFromDb` undoes the analyser's
  window, so a full sine reads 1). `besselPlot.ts` draws J_0
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
  `operators.ts` is chapter 8's algorithm list (grouped by carriers) and
  operator table (two operators to a row, number boxes, an operator its
  wiring leaves out blanked);
  `steps.ts` is a chapter's steps (`Chapter.steps`, chapter 8): the row
  of step buttons, the buttons heading the text's sections, and what
  shows at which step (the step is `currentStep(steps, algorithm)` in
  `src/chapters/steps.ts`, never stored);
  `compare.ts` is chapter 9's Hear PM / FM switch (it sets `mode`), and
  keeps `modHz` and `deviationHz` at `asFm(state)`'s while the chapter has
  `compare`, so the FM sound follows Ratio and Index;
  `envelopeControls.ts` drags the envelope's dots; `piano.ts` is the
  sandbox's one-voice keyboard, on screen and on the computer's keys
  (by `KeyboardEvent.code`: A to K the white notes, W E T Y U O P the
  black, Z and X an octave down and up), holding the steady sound at a
  key's pitch through `carrierHz` and `playing`;
  `besselControls.ts` makes the Bessel plot a control: the canvas is a
  `role="slider"` for the index (drag, or arrows, Page Up / Down, Home,
  End), pointing at a curve, a spectrum stem or a J button sets `hover`,
  pressing a J button sets `pinned`, and one button sets the index where
  the carrier vanishes;
  `transport.ts` is the main button (Play / Stop, or Play note in
  `noteMode`, Play on the landing view), the space bar that does the
  same, and the two checkboxes;
  `themeSwitch.ts`; and `figures.ts` redraws a canvas on patch, size,
  theme and font changes, keeps its `aria-label` describing what it shows,
  and runs the waveform's animation loop while it should move
  (`waveformMoves`: sound playing or "Show motion" on, a moving view, and
  no `prefers-reduced-motion`).
- `src/styles/` — `tokens.css` (colours and fonts) and `base.css` (the two
  panes, type, figures and the controls).
- `public/` — files copied to `dist/` as they are: `favicon.svg` (follows
  the system theme), `favicon.ico` and `apple-touch-icon.png` (rendered
  from it; the home-screen icon is light, full-bleed paper). An XML
  comment cannot contain two hyphens in a row, so don't name CSS tokens in
  one.

Known limits: the synth is not band-limited, so a high carrier with a high
ratio and index aliases. Chapter 2's moving waveform runs on the page's
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
The landing view is neither: one centred column. Check every chapter at
both sizes after adding controls or figures.

## Styling

The look is a 1973 paper: paper, ink, and three pens for the plots.

- Every colour is a token from `src/styles/tokens.css`, light on `:root`,
  dark under `prefers-color-scheme` (unless `data-theme='light'`) and under
  `data-theme='dark'`. The dark values are written in both blocks; keep
  them identical. Both themes must work.
- Tokens: `--paper` (page), `--paper-sunken` (wells, control tracks),
  `--grid` (plot grid), `--rule` (axes, hairlines), `--ink`; pens
  `--pen-blue` (carrier and output traces, positive sidebands),
  `--pen-green` (modulator), `--pen-red` (negative sideband phase).
- All text is pure `--ink`, never a grey. Use weight, size and italics for
  hierarchy.
- Colour appears only in plots, rules and control fills.
- Red means negative phase and nothing else: controls and the focus ring
  are ink. Never let phase rest on colour alone; a negative stem also gets
  a hollow marker.
- A figure sits between two ink rules (`.figure`) with an italic caption,
  "Fig. n" then an em space then the title.
- Fonts, self-hosted through `@fontsource` (latin subsets, imported in
  `src/main.ts`): `--font-display` (Fraunces 600: wordmark and headings),
  `--font-sans` (Figtree 400 to 700, italic for figure captions:
  everything else), `--font-mono` (IBM Plex Mono: numbers, with tabular
  figures; `.num`). A weight that is not imported there is not available.
- A canvas has no CSS: draw code reads the tokens with `getComputedStyle`
  and whoever mounts it must redraw on resize, theme change and
  `document.fonts.ready` (`mountFigure` in `src/ui/figures.ts` does).
  Give every canvas `role="img"` and an `aria-label` saying what it shows.
  A canvas that is a control (the Bessel plot) is a `role="slider"`
  instead, focusable, with its value kept in `aria-valuenow` and
  `aria-valuetext`; anything it offers by hover must also be reachable by
  keyboard and touch (the J buttons).
- Controls are ink on paper (`.btn`, `.slider` in `base.css`). Give every
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
- The theme switch cycles Auto, Light, Dark and saves the bare word under
  `localStorage["fmlab.theme"]`. The boot script in `index.html` reads the
  same key; keep it in step with `src/model/theme.ts`.
- The space bar is Play / Stop on every page, including stopping a note
  that is sounding. It is left alone on a button, link, checkbox, maths
  panel or anything typed into; on a slider, where space means nothing,
  it plays and stops. A "Space: play / stop" hint shows where there is a
  pointer that hovers.
- Motion: chapter 6's two figures show a playhead while a note sounds,
  and the landing view's follow its sound; under
  `prefers-reduced-motion` they simply stay as they are, and the sound
  still plays. The other
  thing that animates is chapter 2's waveform, while sound
  plays or "Show motion" is ticked. Under `prefers-reduced-motion` it
  stays still, the checkbox is hidden and the caption says why. Anything
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
