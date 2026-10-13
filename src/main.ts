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
import { createLabStore } from './model/lab';
import { loadTheme } from './model/theme';
import { mountFigures } from './ui/figures';
import { mountSliders } from './ui/sliders';
import { mountThemeSwitch } from './ui/themeSwitch';
import { mountMeter, mountPlayButton } from './ui/transport';

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

// One store; the engine and every control and figure follow it. The boot
// script in index.html has already applied the saved theme.
const store = createLabStore({ theme: loadTheme() });
const engine = new AudioEngine(store);

mountSliders(store);
mountFigures(store);

const play = document.querySelector<HTMLButtonElement>('#play');
if (play) mountPlayButton(play, store);

const meter = document.querySelector<HTMLElement>('#meter');
if (meter) mountMeter(meter, store, engine);

const theme = document.querySelector<HTMLButtonElement>('#theme');
if (theme) mountThemeSwitch(theme, store);

const commit = document.querySelector<HTMLElement>('#commit');
if (commit) mountCommitHash(commit);
