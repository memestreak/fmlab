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

import { AudioEngine } from './audio/engine';
import { chapterByNumber } from './chapters';
import { createLabStore } from './model/lab';
import { loadTheme } from './model/theme';
import { mountBesselControls } from './ui/besselControls';
import { chapterInUrl, mountChapters, openingFromUrl } from './ui/chapterView';
import { mountEnvelopeControls } from './ui/envelopeControls';
import { mountFigures } from './ui/figures';
import { mountOperators } from './ui/operators';
import { mountPiano } from './ui/piano';
import { mountSliders } from './ui/sliders';
import { mountThemeSwitch } from './ui/themeSwitch';
import {
  mountControlsToggle,
  mountIndexFollowsToggle,
  mountMotionToggle,
  mountPlayButton,
} from './ui/transport';

const REPO_URL = 'https://github.com/memestreak/fmlab';

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

// One store; the engine and every control and figure follow it. It starts
// on the chapter the URL names, with that chapter's patch. The boot script
// in index.html has already applied the saved theme.
const opening = chapterInUrl();
const store = createLabStore({
  theme: loadTheme(),
  chapter: opening.number,
  // The chapter's patch, and in the sandbox the sound a link carries.
  ...openingFromUrl(opening),
});
// It subscribes itself; the live spectrum also asks it what is playing.
const engine = new AudioEngine(store);

mountChapters(store);
mountSliders(store);
mountFigures(store, engine);
mountBesselControls(store);
mountOperators(store);
mountEnvelopeControls(store);

const play = document.querySelector<HTMLButtonElement>('#play');
if (play) mountPlayButton(play, store);

const motion = document.querySelector<HTMLInputElement>('#motion');
if (motion) mountMotionToggle(motion, store);

const piano = document.querySelector<HTMLElement>('#piano');
if (piano) {
  mountPiano(piano, store, () => chapterByNumber(store.get().chapter)?.hasPiano === true);
}

const toggle = document.querySelector<HTMLButtonElement>('#controls-toggle');
if (toggle) mountControlsToggle(toggle);

const follows = document.querySelector<HTMLInputElement>('#index-follows');
if (follows) mountIndexFollowsToggle(follows, store);

const theme = document.querySelector<HTMLButtonElement>('#theme');
if (theme) mountThemeSwitch(theme, store);

const commit = document.querySelector<HTMLElement>('#commit');
if (commit) mountCommitHash(commit);
