# fmlab: design spec

Date: 2026-10-13
Status: decided in the project thread with Jeremy. The scaffold is in PR #1.
Style reference: [fmlab Style Directions](https://claude.ai/artifact/YS27P7yDe32D9GpGWjNMLy), section "C, revised", palette "Plotter pens".

## Goal

A single-page web app that teaches FM synthesis by letting you hear and see the
same parameters at once, from a single sine wave up to DX7-style operator
algorithms. It is a portfolio piece, a public sibling of frets.

## Decisions

| Question | Decision |
| --- | --- |
| Audience | Musicians and engineering students, layered: plain language by default, maths in expandable panels. |
| Scope | Up to DX7-style algorithms. Polyphony, MIDI and patch storage are out. |
| Version 1 | The two-operator slice: chapters 1 to 7 (6 lessons and the sandbox) and the landing view. Chapters 8 and 9 are version 2. |
| Audio engine | One AudioWorklet phase-modulation engine with up to 6 operators, used by every chapter. A true-FM mode exists only for chapter 2 and the FM-versus-PM chapter. |
| Operator routing | The 32 fixed DX7 algorithms, chosen from a list and drawn as a diagram. No matrix, no node editor. |
| Parameters | Clean and idealised: Hz, ratio, index, ADSR. No DX7 units, DAC emulation or .syx import. |
| Devices | Desktop first, phones usable. iOS handled from day one. |
| Stack | Vanilla TypeScript, Vite, Canvas 2D. No UI framework. |
| Repo and hosting | New public repo `memestreak/fmlab`, deployed with Cloudflare Pages git integration the same way as frets. |
| Look | "1973 paper": Chowning's journal figures brought to life, in Fretwood's fonts, with plotter-pen colours. Light and dark. |

## Chapters

Version 1:

1. **A single sine.** Frequency and amplitude, as a waveform and as one spectral line.
2. **Vibrato becomes timbre.** A 5 Hz modulator gives vibrato; sweeping it into the audio range turns it into tone colour. Uses true-FM mode.
3. **Modulation index.** Sidebands at fc ± n·fm; bandwidth by Carson's rule.
4. **Sidebands and Bessel functions.** Heights follow Jₙ(I). The carrier vanishes at I ≈ 2.405.
5. **Carrier to modulator ratio.** Integer ratios are harmonic (1:1 saw-like, 1:2 odd harmonics only); irrational ratios are bell-like. Negative frequencies fold back with inverted phase.
6. **Time-varying index.** An envelope on the index; Chowning's brass and bell.
7. **Sandbox.** Every two-operator control, an on-screen and computer-keyboard piano, presets, and state in the URL.

Version 2:

8. **Operators and algorithms.** Up to 6 operators, the 32 DX7 algorithms, feedback.
9. **FM versus PM.** Why the DX7 is really phase modulation, side by side.

The landing view plays a sound and animates the waveform and spectrum on the
first click, before any text.

## Views

- **Waveform.** Drawn from the parameters, not from the audio output, so it is stable and can show a slowed-down view. The modulator is overlaid faintly.
- **Spectrum.** The exact line spectrum from Bessel functions, with a toggle to the live FFT of the audio output.
- **Bessel plot.** J₀ to Jₙ against index, with a draggable cursor that is the index control.
- **Phasor view.** Sidebands as rotating phasors whose sum traces the signal.
- **Spectrogram.** For chapter 6.
- **Algorithm diagram.** Version 2.

Hovering or tapping a sideband highlights it in every view, with its formula.

## Audio

- One AudioWorklet does per-sample phase modulation for up to 6 operators, with feedback. Chapters use the operators they need.
- The predicted spectrum, the waveform and the sound share one maths module, so they cannot disagree.
- The AudioContext starts on a user gesture. Parameter changes are smoothed to avoid clicks. A limiter sits on the master bus, the default volume is low, and a Volume slider is always visible. (This first said "an output meter is always visible". Jeremy removed the meter on 2026-10-13 in favour of the Volume slider.)
- **iOS:** set `navigator.audioSession.type = "playback"` where supported, so sound plays with the ringer switch on silent; otherwise fall back to unlocking with a looping silent audio element on the first tap.

## Look

The page is an off-white journal page with pure black text; dark mode is
charcoal with pure white text. Colour appears only as pen ink in plots,
hairline rules and control fills, never on body text.

Type (the same faces as Fretwood):

- Fraunces 600 for the wordmark and chapter titles.
- Figtree 400 to 700 for everything else; Figtree italic for figure captions ("Fig. 3b  Spectrum").
- IBM Plex Mono for numbers in readouts and axes, with tabular figures.

Tokens:

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#fbfbf7` | `#131418` | Page and plot background |
| `--paper-sunken` | `#eef0ea` | `#1d1f24` | Control wells |
| `--grid` | `#e3e3dc` | `#2a2c33` | Plot gridlines |
| `--rule` | `#c9c9c0` | `#3d404a` | Borders and hairlines |
| `--ink` | `#000000` | `#ffffff` | All text, figure rules |
| `--pen-blue` | `#1a3fa8` | `#94b2ff` | Carrier and output trace, positive sidebands |
| `--pen-green` | `#2e8b3e` | `#7fd18a` | Modulator |
| `--pen-red` | `#c8281e` | `#ff7a6e` | Negative sideband phase only |

Rules:

- Red always means negative phase, so control fills and the focus ring use ink, not red.
- Negative sidebands also get a hollow marker, so the meaning survives for colour-blind viewers.
- Figures sit between two ink rules, with an italic caption, like a journal figure.
- Theme switch Auto / Light / Dark, as in frets, saved under `localStorage["fmlab.theme"]`.

## Code layout

- `src/model/`: parameter state, a small subscribe/notify store, URL serialisation.
- `src/dsp/`: pure functions for Bessel values, spectrum prediction and waveform sampling, unit tested.
- `src/audio/`: the worklet and the engine that subscribes to the model.
- `src/viz/`: one renderer per view, each a function of (model, canvas, time).
- `src/chapters/`: lesson text and the controls each chapter unlocks.

## Deployment

Copied from frets' `DEPLOYMENT.md`, with Vite in place of Next:

- Cloudflare Pages git integration: production from `main`, preview URLs for PRs. Build `npm run build`, output `dist`.
- GitHub Actions CI runs lint, test, build and typecheck on every PR and every push to `main`.
- `.node-version` pins Node 22 for both CI and Pages.
- The footer shows the build's short commit hash.

## Out of scope

Polyphony, MIDI input, patch storage, DX7 units and DAC emulation, .syx
import, a free-form modulation editor.

## Decisions made while scaffolding

- **TypeScript 6, not 7.** Held at 6.0.x because typescript-eslint does not
  support 7 yet.
- **Negative stems point down.** The spectrum plot draws signed amplitudes: a
  negative line goes below the axis, in `--pen-red`, and ends in the hollow
  marker.
- **Spectrum cut-off.** `fmSpectrum` leaves out lines quieter than 1e-4
  (-80 dB), and drops a sideband that lands on exactly 0 Hz, since a sine at
  0 Hz is silent.
- **The wordmark is the `h1`.** The placeholder page has no separate title.
- **Theme switch.** Not in the scaffold; added with the first playable
  slice (PR #2).

## Decisions made with the chapter framework (PR #3)

- **Two panes.** The chapter's text sits beside the lab on a wide screen
  and above it on a narrow one. The chapter number is the URL's hash; a
  hash that names no written chapter opens chapter 1.
- **Chapters are data** in `src/chapters/`. The sandbox is chapter 7, as
  numbered above, and previous / next step over chapters not yet written.
- **Formulas are plain HTML**, not KaTeX: the ones needed so far are short
  enough to set with `<var>` and `<sub>`.
- **Chapter 2 is set in Hz.** Its sliders are the modulator's frequency
  (0.5 to 880 Hz, logarithmic) and the deviation (0 to 200 Hz), with the
  carrier fixed at 220 Hz. Its spectrum shows magnitudes: true FM's
  sidebands are not simply upright or inverted, so there are no negative
  stems there.
- **Chapter 2's waveform** shows two cycles of the modulator, up to forty
  carrier cycles. Below about 11 Hz that is only part of one wobble, so
  there it moves instead (PR #4): while sound plays or "Show motion" is
  ticked it shows up to one wobble from the present moment, with the
  carrier drawn slowed by a round factor (5 for the default patch) so its
  waves can be seen squeezing and stretching. The modulator and deviation
  are not slowed, which is what makes the squeeze plain; the caption
  states the factor.
- **Opening a chapter resets the patch** to the chapter's own; volume,
  Play and the theme are kept.

## Decisions made with chapters 3 and 4 (PR #5)

- **Chapter 3 holds the ratio at 1:1** and offers only the index. At 1:1
  the lower sidebands fold back on to the harmonics, so its spectrum has
  red, inverted stems before chapter 5 explains them; the text says so in
  a sentence and defers the rest. Carson's bracket stops at zero on the
  left for the same reason.
- **Chapter 4 moves the waves apart**: carrier 880 Hz, modulator 55 Hz
  (ratio 1/16). Nothing folds, so each stem is one sideband exactly
  J_n(I) tall, and the carrier really does vanish at 2.405. At 1:1 neither
  would be true.
- **Chapter 4 shows the spectrum and the Bessel plot**, not the waveform,
  so the two linked figures can be seen together. Figures are numbered
  per chapter in the order shown.
- **The Bessel plot is the index control** (a slider: drag or keys), so
  chapter 4 has no Index slider. Its curves are J_0 to J_8.
- **Linking is by sideband order.** Pointing at a curve, a stem or a J
  button picks out that order in both figures; pressing a J button keeps
  it, which is how touch and keyboard reach it. Only chapter 4 links, as
  only there is a stem a single sideband.
- **Dots on the index line follow the spectrum's convention**: filled
  blue above zero, hollow red below, where that sideband is inverted.

## Chapter 1's axes (PR #6)

Jeremy reported on 2026-10-13 that in chapter 1 the frequency under the
spectrum did not change with the Carrier slider. The sound and the Hz row
did follow it, but both figures were in carrier units, so the stem stood
at "1" and the wave looked the same wherever the slider was. Chapter 1's
figures are now on fixed axes in real units: the waveform is 20 ms long
and the spectrum runs from 0 to 1000 Hz. Other chapters keep carrier
units, where the lesson is ratios and sidebands.

## Decisions made with chapters 5 and 6 (PR #7)

- **Chapter 5 writes ratios carrier first**, "1:2", as FM players do,
  while the Ratio slider reads the modulator over the carrier, 2.00. Its
  presets are 1:1, 1:2, 1:3 and 1:1.41. The spectrum rules a line at each
  whole multiple of the carrier.
- **One envelope, for loudness and index both.** Chapter 6 has a single
  ADSR, not one each. Chowning's brass and bell both use one shape for the
  two, and a checkbox, "Index follows the envelope", turns the index's
  share off so the difference can be heard. The Index slider is the index
  at the envelope's peak.
- **The envelope's decay and release are exponential**, counted to four
  time constants; the attack is a straight line. That is what Web Audio's
  `setTargetAtTime` plays, so the figures and the sound are the same
  curve, and it is what makes the bell ring like one.
- **A note is one shot.** Play note (or the space bar) plays a note of a
  fixed held length, 0.6 s for brass and 5 s for the bell, set by the
  preset and not by a slider. The space bar is also Play / Stop in the
  other chapters.
- **The spectrogram is worked out, not recorded**: the line spectrum at
  each moment's index, scaled by that moment's loudness, magnitudes only.
  It is there before the note is played. While a note sounds a playhead
  crosses it and the envelope; under reduced motion there is no playhead
  and nothing else is lost.
- **The envelope's dots can be dragged**, and the four sliders set the
  same numbers from the keyboard. A drag cannot make the note longer than
  the figure's time axis; the sliders can.
- **Chapter 6 shows the envelope and the spectrogram**, not the waveform
  or the line spectrum.
- **The bell rings for 5 seconds**, not the paper's 15, on a 200 Hz
  carrier.
