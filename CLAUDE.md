# fmlab

An interactive guide to FM synthesis: a single page of short chapters, each
built around a figure you can play with and hear. Design spec:
`docs/specs/2026-10-13-fmlab-design.md`. The app has no users yet: don't
keep old URLs, storage keys or saved state working after a change.

Vite, vanilla TypeScript (strict) and Canvas 2D; no UI framework. Vitest,
ESLint. Sound will come from one AudioWorklet phase-modulation engine (not
written yet). Deploys as static files to Cloudflare Pages
(`DEPLOYMENT.md`).

So far the page is a placeholder: the wordmark, one sentence, Fig. 1 (the
static spectrum for ratio 1, index 2) and the footer.

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

- `index.html` — the page's static markup; `src/main.ts` is its entry: it
  imports the fonts and styles, mounts the figures and fills in the
  footer's commit hash (`__COMMIT_HASH__`, set by `define` in
  `vite.config.ts` from `git rev-parse --short HEAD`, `dev` without git).
- `src/dsp/` — pure maths, no DOM and no Web Audio: `bessel.ts`
  (`besselJ`, integer-order J_n by power series) and `fmSpectrum.ts`
  (`fmSpectrum(ratio, index)`: the line spectrum in carrier units, signed
  amplitudes, negative frequencies folded, coincident lines summed).
- `src/viz/` — Canvas 2D drawing. A draw function takes a canvas and data,
  reads its colours and fonts from the canvas's CSS variables and repaints
  from scratch; it knows no theory. `spectrumPlot.ts` draws a spectrum as
  stems.
- `src/styles/` — `tokens.css` (colours and fonts) and `base.css` (page
  furniture: column, type, figure, footer).
- `public/` — files copied to `dist/` as they are (`favicon.svg`).
- Not there yet; create each with its first file:
  - `src/model/` — the state of a patch (ratio, index, envelopes) and how
    it changes, with no DOM, so figures and sound read the same values.
  - `src/audio/` — the AudioWorklet phase-modulation engine and the code
    that loads and drives it. One engine for every chapter.
  - `src/chapters/` — one module per chapter, wiring its text, figures and
    controls to the model.

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
  `document.fonts.ready` (see `mountSpectrumFigure` in `src/main.ts`).
  Give every canvas `role="img"` and an `aria-label` saying what it shows.

## Testing

Tests live in `src/__tests__/`, in a folder named after the one they test
(`dsp/`). Vitest runs them in the `node` environment with globals on; there
is no jsdom yet, so add it when the first DOM test needs it. Test the maths
against published values (Bessel tables) and identities, not against the
code's own output.
