// Fonts are self-hosted: Fraunces for the wordmark and headings, Figtree
// for everything else (italic for figure captions), IBM Plex Mono for
// numbers. Latin subsets only.
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/figtree/latin-400-italic.css';
import '@fontsource/figtree/latin-500-italic.css';
import '@fontsource/figtree/latin-600-italic.css';
import '@fontsource/figtree/latin-700-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles/tokens.css';
import './styles/base.css';

import { fmSpectrum } from './dsp/fmSpectrum';
import { drawSpectrum } from './viz/spectrumPlot';

const REPO_URL = 'https://github.com/memestreak/fmlab';

/** Fig. 1: the static spectrum the placeholder page shows. */
function mountSpectrumFigure(canvas: HTMLCanvasElement): void {
  const lines = fmSpectrum(1, 2);
  const draw = () => drawSpectrum(canvas, lines, { maxFreq: 8 });

  // The canvas keeps no memory of what was drawn, so repaint whenever its
  // size, the theme or the fonts change.
  new ResizeObserver(draw).observe(canvas);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', draw);
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  void document.fonts.ready.then(draw);
}

/** The build's commit, linked to GitHub; plain "dev" without git. */
function mountCommitHash(slot: HTMLElement): void {
  if (__COMMIT_HASH__ === 'dev') {
    slot.textContent = 'dev';
    return;
  }
  const link = document.createElement('a');
  link.href = `${REPO_URL}/commit/${__COMMIT_HASH__}`;
  link.textContent = __COMMIT_HASH__;
  slot.replaceChildren(link);
}

const canvas = document.querySelector<HTMLCanvasElement>('#spectrum');
if (canvas) mountSpectrumFigure(canvas);

const commit = document.querySelector<HTMLElement>('#commit');
if (commit) mountCommitHash(commit);
