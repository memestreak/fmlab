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
import { chapterInUrl, mountChapters } from './ui/chapterView';
import { mountFigures } from './ui/figures';
import { mountSliders } from './ui/sliders';
import { mountThemeSwitch } from './ui/themeSwitch';
import { mountPlayButton } from './ui/transport';

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
  ...opening.patch,
});
// It subscribes itself; nothing here needs to hold on to it.
new AudioEngine(store);

mountChapters(store);
mountSliders(store);
mountFigures(store);

const play = document.querySelector<HTMLButtonElement>('#play');
if (play) mountPlayButton(play, store);

const theme = document.querySelector<HTMLButtonElement>('#theme');
if (theme) mountThemeSwitch(theme, store);

const commit = document.querySelector<HTMLElement>('#commit');
if (commit) mountCommitHash(commit);
