# fmlab

An interactive guide to FM synthesis: a single page of short chapters, each
built around a figure you can play with and hear. Design spec:
`docs/specs/2026-10-13-fmlab-design.md`. The app has no users yet: don't
keep old URLs, storage keys or saved state working after a change.

Vite, vanilla TypeScript (strict) and Canvas 2D; no UI framework. Vitest,
ESLint. Sound comes from one AudioWorklet phase-modulation engine. Deploys
as static files to Cloudflare Pages (`DEPLOYMENT.md`).

The page is a chapter at a time: its text in a narrative pane, and the lab
(Play / Stop, sliders, the waveform and spectrum figures) beside it, or
under it on a narrow screen. The chapter is in the URL's hash (`#2`).
Written so far: 1 "A single sine", 2 "Vibrato becomes timbre" and 7, the
Sandbox; numbers are the spec's, and previous / next step over the gaps.
One carrier and one modulator throughout.

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
  `theme.ts` (the choice, its storage key, `applyTheme`). No URL
  serialisation yet beyond the chapter.
  The patch is held two ways, by `mode`. `pm` (everywhere but chapter 2):
  `ratio` and `index`. `fm` (chapter 2): `modHz` and `deviationHz`.
  `patchOf(state)` gives a ratio and an index for either, which is what the
  figures and spectrum maths take; never read `state.ratio` or
  `state.index` directly outside `pm`-only code.
- `src/chapters/` — a chapter is data (`types.ts`): number, title, lesson
  text and "The maths" panels (HTML strings, trusted because they are
  written here), the sliders it shows, the patch it starts from (all of
  it, so a chapter always opens the same way) and the figures' captions.
  `index.ts` lists them (`CHAPTERS`, `neighbours`); `route.ts` reads the
  hash. A new chapter is a file here and an entry in `CHAPTERS`. Lesson
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
  Tests hold kernels, samples and spectra to each other.
- `src/audio/` — everything Web Audio. `synthProcessor.ts` is the
  AudioWorklet: it runs the kernels and has a-rate AudioParams `frequency`,
  `ratio`, `index`, and for true FM `modFrequency`, `deviation` and `mode`
  (1 is true FM). It is bundled on its own through the `?worker&url`
  import in `engine.ts`, and may import from `src/dsp` only. `engine.ts`
  (`AudioEngine`) follows the store: worklet, master gain, limiter (a
  `DynamicsCompressorNode`), speakers. It creates the context on the first
  Play, inside the gesture, glides params (30 ms linear ramps), fades the
  master gain in and out, suspends the context after Stop, and on a change
  of chapter fades out, jumps to the new patch and fades back in.
  `iosUnlock.ts` keeps iOS's ringer switch from muting it;
  `worklet-globals.d.ts` types the worklet's globals.
- `src/viz/` — Canvas 2D drawing. A renderer is a function of
  `(state, canvas)` that repaints from scratch, reading its colours and
  fonts from the canvas's CSS variables. `plot.ts` has the shared frame
  (sizing for the device pixel ratio, gridlines, labels);
  `waveformPlot.ts` and `spectrumPlot.ts` are the two figures. The
  waveform shows two carrier cycles in `pm` and two modulator cycles, up
  to forty carrier cycles, in `fm` (`cyclesShown`). `ticks.ts` (pure) makes
  the x axes' numbers: every tick is labelled in carrier units (multiples,
  cycles) and, on a second row, in Hz or ms, thinned when the canvas is
  narrow.
- `src/ui/` — wiring between the markup and the store. `chapterView.ts`
  turns the hash into the store's chapter and patch, and draws what a
  chapter owns: the narrative pane, the contents list in the masthead,
  which slider rows show (`data-control`) and the captions. `sliders.ts`
  is a table of every slider (range, step, scale, readout);
  `transport.ts` is Play / Stop; `themeSwitch.ts`; and `figures.ts`
  redraws a canvas on patch, size, theme and font changes and keeps its
  `aria-label` describing what it shows.
- `src/styles/` — `tokens.css` (colours and fonts) and `base.css` (the two
  panes, type, figures and the controls).
- `public/` — files copied to `dist/` as they are (`favicon.svg`).

Known limits: the synth is not band-limited, so a high carrier with a high
ratio and index aliases. In chapter 2 the waveform figure shows only part
of a wobble below about 11 Hz, and at the default deviation the crowding
of the waves is slight.

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
- Controls are ink on paper (`.btn`, `.slider` in `base.css`). Give every
  input a visible `<label>`, and a readout in `.num`. Anything that is not
  a control must not look like one.
- Show real units beside carrier units wherever a frequency or time
  appears (the ratio's readout adds the modulator's Hz; the axes add Hz
  and ms).
- The theme switch cycles Auto, Light, Dark and saves the bare word under
  `localStorage["fmlab.theme"]`. The boot script in `index.html` reads the
  same key; keep it in step with `src/model/theme.ts`.
- Motion: nothing animates on its own; the figures only move when a
  control does. Anything added that does must respect
  `prefers-reduced-motion`.

## Testing

Tests live in `src/__tests__/`, in a folder named after the one they test
(`dsp/`, `model/`, `audio/`, `viz/`, `chapters/`). Vitest runs them in the `node`
environment with globals on; there is no jsdom yet, so add it when the
first DOM test needs it. Test the maths against published values (Bessel
tables), identities and each other (the kernel against `fmSample` and
`fmSpectrum`), not against the code's own output. The engine and the
worklet need a browser, and there is no meter on the page: check sound by
listening, or in a script by tapping the graph with an `AnalyserNode`.
