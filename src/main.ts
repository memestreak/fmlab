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
import '@fontsource/ibm-plex-mono/latin-600.css';
// The sandbox's Dymo tape labels.
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/michroma/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/instrument.css';

import { AudioEngine } from './audio/engine';
import { chapterById } from './chapters';
import { createLabStore } from './model/lab';
import { loadTheme } from './model/theme';
import { mountBesselControls } from './ui/besselControls';
import { chapterInUrl, mountChapters, openingFromUrl } from './ui/chapterView';
import { mountCompare } from './ui/compare';
import { mountContents } from './ui/contents';
import { mountEnvelopeControls } from './ui/envelopeControls';
import { mountEnvelopeView } from './ui/envelopeView';
import { mountKeyScalingView } from './ui/keyScalingView';
import { mountVoiceArea } from './ui/lfoView';
import { mountPitchEgView } from './ui/pitchEgView';
import { mountFigures } from './ui/figures';
import { mountAlgorithmSteps, mountFeedbackKnob } from './ui/instrument';
import { mountOperators } from './ui/operators';
import { tapeLabel } from './ui/dymo';
import { mountPiano } from './ui/piano';
import { mountSliders } from './ui/sliders';
import { mountSteps } from './ui/steps';
import { mountTerms } from './ui/terms';
import { trackFocusSource } from './ui/focusSource';
import { mountSettings } from './ui/settingsPanel';
import { mountThemeSwitch } from './ui/themeSwitch';
import { mountVoiceTable } from './ui/voiceTable';
import {
  mountControlsToggle,
  mountIndexFollowsToggle,
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
  chapter: opening.id,
  // The chapter's patch, and in the sandbox the sound a link carries.
  ...openingFromUrl(opening),
});
// It subscribes itself; the live spectrum also asks it what is playing.
const engine = new AudioEngine(store);

mountChapters(store);
mountContents(store);
mountTerms();
mountSliders(store);
mountFigures(store, engine);
mountBesselControls(store);
mountOperators(store);
mountVoiceTable(store);
mountEnvelopeView(store);
mountKeyScalingView(store);
mountVoiceArea(store);
mountPitchEgView(store);
mountAlgorithmSteps(store);
mountFeedbackKnob(store);
mountSteps(store);
mountCompare(store);
mountEnvelopeControls(store);

const play = document.querySelector<HTMLButtonElement>('#play');
if (play) mountPlayButton(play, store);

const piano = document.querySelector<HTMLElement>('#piano');
if (piano) {
  mountPiano(piano, store, () => chapterById(store.get().chapter)?.hasPiano === true);
}

// The sandbox's Voice, Operators, Octave, Mod and Volume labels, on Dymo tape
// (Volume's only while it is in the sandbox's masthead: the tape's CSS is
// the sandbox's).
for (const selector of [
  '.inst-section-title',
  '#voice-heading',
  '.piano-oct-label',
  '.mod-wheel-label',
  '.slider-row[data-control="volume"] > label',
]) {
  tapeLabel(document.querySelector(selector));
}

const toggle = document.querySelector<HTMLButtonElement>('#controls-toggle');
if (toggle) mountControlsToggle(toggle);

const follows = document.querySelector<HTMLInputElement>('#index-follows');
if (follows) mountIndexFollowsToggle(follows, store);

const theme = document.querySelector<HTMLButtonElement>('#theme');
if (theme) mountThemeSwitch(theme, store);

// The sandbox's Settings key and panel, and what the settings govern.
mountSettings(store);

// Focus rings only for focus the keyboard moved.
trackFocusSource();

const commit = document.querySelector<HTMLElement>('#commit');
if (commit) mountCommitHash(commit);

/** At most this long is the page kept hidden waiting for its fonts. */
const FONT_WAIT_MS = 1500;

// Everything is drawn: show the page once its fonts are in too, so that
// a font arriving late cannot shift what has been laid out (see the style
// in index.html).
void Promise.race([
  document.fonts.ready,
  new Promise(resolve => window.setTimeout(resolve, FONT_WAIT_MS)),
]).then(() => {
  document.documentElement.dataset.ready = '';
});
