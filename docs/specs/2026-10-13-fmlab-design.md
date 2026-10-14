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

(Now named sections in a different order: see "Named sections" below.)

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

## Decisions made with the landing view (PR #8)

- **The site opens on it** whenever the address names no chapter. `#1` to
  `#7` still open chapters directly; a hash that names nothing is taken
  out of the address bar. The wordmark leads back to it.
- **Its sound is one note**: a 220 Hz carrier at 1:1 whose index swells
  to 6 over 1.6 seconds, holds, and sinks again, about four and a half
  seconds in all, the loudness following the same shape.
- **The waveform and spectrum follow the sound**, drawn from the same
  envelope the audio is scheduled from. Before it is played, after it,
  and under reduced motion they show the sound at its fullest and stay
  still; the sound plays all the same.
- **The ways on appear after the first press**: "Start with chapter 1",
  "Go to the sandbox" and the chapter list. The contents in the masthead
  are there from the start, so nobody is stuck behind the button.
- **It keeps a Volume slider**, the one control besides Play.

## Pinned lab and the space bar (PR #9)

Jeremy asked on 2026-10-14 for the controls and figures to stay visible
while the text scrolls, and for the space bar to start and stop the sound.

- **Wide screens:** the page is the window's height; the text column
  scrolls on its own and the lab beside it never moves. The figures
  shrink to fit what the controls leave; chapter 6's six sliders go in two
  columns so its figures keep room.
- **Narrow screens:** the lab sits above the text and sticks to the top as
  the text scrolls beneath. To leave the text at least two fifths of a
  phone's height, its figures are a fifth of the window high each, their
  captions are kept for screen readers only, and the sliders and presets
  fold behind a Sliders button. The figures are cramped there, chapter 4's
  most of all; that is the price of keeping both in view.
- **The space bar is Play / Stop everywhere.** Where a chapter plays notes
  it plays one, and stops it if pressed again while it sounds; the button
  says Stop meanwhile. Space is left to buttons, links, checkboxes and
  maths panels, where it has a meaning of its own.

## The sandbox's keyboard (PR #10)

- **One voice, held:** pressing a key plays the sandbox's patch with the
  carrier at that key's pitch, for as long as it is held; pressing a
  second key moves to it, and letting go falls back to the one still
  held. No envelope: the sandbox's sound is steady, and the spec leaves
  polyphony out.
- **Two octaves on screen**, C3 to B4 to start, moved by the − and +
  buttons (or Z and X) between C2 and C4. Keys outside the Carrier
  slider's range, A1 to A5, are drawn but cannot be played.
- **The computer's keys** are taken by position, not by letter, so they
  sit the same on any keyboard layout: the home row from A is the white
  notes from C, the row above the black ones. They work only in the
  sandbox, and not with Ctrl, Alt or Cmd held.
- **If the sound was started with Play**, letting go of a key leaves it
  playing at that pitch; if a key started it, letting go stops it.
- **Six presets**, each a ratio and an index: Flute (1, 0.8), Brass (1, 4),
  Clarinet (2, 2.5), Bell (1.41, 5), Gong (1.73, 9) and Bass (0.5, 2).
- **On a phone the keyboard folds away with the sliders**, behind the
  Sliders button.

## The sandbox's sound in the URL (PR #11)

- **The sandbox keeps its carrier, ratio and index in the hash**, after the
  chapter: `#7?c=220&r=1.41&i=5`. Opening that link brings the same sound
  back. Volume is left out; it is the listener's.
- **The address follows the sound** once it has rested for 300 ms, and
  replaces the history entry instead of adding one, so Back leaves the
  sandbox rather than undoing slider moves.
- **A Copy link button** in the sandbox copies the address as it is.
- **Whatever a link carries is checked**: each value must be a number, is
  held inside its slider's range, and the carrier is put on the Carrier
  slider's nearest quarter semitone. Anything else is ignored.
- **Other chapters keep no sound in the URL**; parameters on their hash are
  taken out of the address. The contents link to the sandbox opens it
  fresh.

## The live spectrum (PR #12)

- **A Predicted / Live switch** at the end of every spectrum figure's
  caption, Predicted to begin with. It holds for the visit, across
  chapters; it is not saved and not in the URL.
- **Live draws the measured FFT** as a filled --pen-blue curve on the same
  frequency axis and the same linear scale as the predicted stems, which
  stay underneath, faint, for comparison. A measured spectrum has no
  phase, so the curve never goes below the axis and is never red.
- **The measurement is taken before the volume**, not after the limiter.
  The limiter never acts at the lab's levels, so the shape is what is
  heard; tapping before the volume keeps the curve's heights on the
  predicted stems' scale at any volume. A full-height sine reads 1.
- **With nothing playing** the curve lies flat and the caption says "Press
  Play to hear it."
- **Under reduced motion** the live view is redrawn twice a second rather
  than every frame.

## Chapter 8, operators and algorithms (PR #13)

- **The 32 algorithms** are written out in DX7 numbering and checked, by a
  unit test, against the algorithm table of Dexed's msfa engine, a DX7
  emulation, decoded operator by operator: modulators, carriers and the
  feedback loop. Two loops run through a stack rather than round one
  operator: in algorithm 4 from OP4 back to OP6, in 6 from OP5 to OP6.
- **Clean units:** each operator has a ratio (0.5 to 16), a level (0 to
  100%) and a decay time in seconds (0 holds it for the whole note). A
  modulator's level is its index, 5 radians at full level; the carriers
  share the output equally, so every algorithm is about as loud. Feedback
  is 0 to 2 radians, using the mean of the last two samples as the DX7
  does.
- **Notes:** chapter 8 plays notes, held as long as the slowest operator
  needs (1 to 6 seconds) and let go together. Each operator's level is
  shaped by its own envelope, scheduled in Web Audio on its own param.
- **The predicted spectrum is numeric**, since there is no Bessel formula
  for a stack: the engine's kernel is run for 16384 samples (256 cycles of
  the note), windowed with a flat-top window and transformed, and each peak
  read as a partial. Heights only. The live FFT works here as everywhere.
- **The diagram** puts carriers on the bottom row in --pen-blue and
  modulators above what they modulate in --pen-green, with ink lines and
  the feedback loop out of the top; a box fades with its operator's level.
- **Controls:** an Algorithm list (1 to 32) beside Play, a Feedback slider,
  and a table of the six operators, two to a row, with number boxes
  rather than eighteen sliders so the figures keep their room.
- **Presets are mine**, not the DX7's factory sounds: Stacks (where the
  chapter opens, algorithm 1), E. piano and Bell (algorithm 5), Bass
  (algorithm 1 with feedback) and Organ (algorithm 32).
- **Built up in steps** (after Jeremy found the algorithm poorly
  introduced): One pair, Two pairs (where the rule is stated: the bottom
  row is heard, everything above only shapes it), Stack, Two into one,
  Feedback, then All 32, which names an algorithm as a fixed wiring
  diagram, not a procedure. Each step is a section of the text headed by a
  button, and a button in a row under Play; both set the step's sound. The
  first five are wirings of two to four operators that are not the DX7's
  (`STEP_WIRINGS`, numbered 33 to 37 after its 32, so `algorithm` holds
  either and the engine needs nothing new); the operators they leave out
  are silent and blanked in the table. Which step is current follows from
  the wiring in force, so it is not stored, nor in the URL. The algorithm
  list and the presets appear only at the last step, the Feedback slider
  only where there is a loop. On a phone the row of step buttons is left
  out for room; the section headings do the same.
- **The list groups the 32 by how many carriers** each has (1 to 6),
  still under their DX7 numbers.
- **The boxes light up** while a note sounds, each filled as strongly as
  its operator sounds; not under reduced motion.
- **Chapters 3 to 7 draw their pair** small, floated beside the start of
  the text, the way chapter 8 draws a wiring: 2 on 1, and 1 heard. So the
  notation is familiar before it is needed.
- **The operator table** is narrower, without spin buttons, so it no
  longer overflows the lab at 1024 px.
- **A note's length is now fixed when it starts.** Before, choosing a
  preset with longer decays after a note had ended made it look still
  sounding, so Play stopped instead of playing; this was true of chapter 6
  too.

## Chapter 9, FM versus PM (PR #14)

- **Two spectra, one patch.** Fig. 1 is the patch as phase modulation,
  Fig. 2 as true frequency modulation, on one shared axis wide enough for
  either. The only sliders are Ratio and Index, so the comparison is the
  one the text makes: how each responds to the ratio.
- **Matched at ratio 1.** FM's deviation is Index times the carrier
  (Δf = I·fc), so its index is I / ratio: the two agree at ratio 1 and FM
  thins as the modulator speeds up, grows dense below 1. Even at ratio 1
  the heights differ a little, since the folded sidebands combine with
  different phases (FM's modulator is a quarter cycle on); the text says
  "much the same", not "the same".
- **Hear PM / FM** beside Play sets which one sounds, crossfading if it is
  playing. It is not saved and the chapter always opens on PM. The live
  spectrum switch is hidden here: both figures are predictions.
- **Why the DX7 is PM:** the text gives two reasons, carefully: with PM
  brightness does not move when a modulator is retuned, and an offset in a
  modulated or fed-back modulator is a harmless phase shift in PM but a
  pitch drift in FM. A maths panel shows FM as PM with index Δf / fm and
  the modulator a quarter cycle on.
- **Not built:** a demonstration of the FM drift, which would need FM
  stacks or feedback in the engine; the panel shows it in symbols instead.

## Definitions and the glossary (PR #16)

- **Every term is defined where it is first used**, in bold, by one plain
  sentence, and its formula, where it has one, is in that chapter's
  maths panel. 33 terms, from sine wave and carrier in chapter 1 to
  algorithm and the FFT in chapter 8 (chapters 7 and 9 define none).
- **One source:** `src/chapters/terms.ts`. The chapter text, the glossary
  and the tips all read the same sentence, so they cannot disagree. A
  unit test checks each term is defined once, in the chapter it names,
  and that no text uses it earlier, including the maths panels and the
  captions; headings and slider labels are not checked.
- **Copy reordered to pass that test:** chapter 1 introduces the carrier
  first and no longer names FM; chapter 2's maths no longer names the
  index, phase or phase modulation, which chapter 3 now introduces in its
  text (before, only its maths panel said the guide had switched to
  phase modulation); chapter 3 no longer says sidebands "fold", which
  chapter 5 defines. Chapter 8 says an operator's ratio is a multiple of
  the note, not chapter 5's ratio. The landing line spells out FM.
- **The glossary** is a page of its own at `#glossary`, alphabetical, each
  entry with its formula and a link to its chapter; it is in the
  contents after chapter 9 and in the footer. A term's link goes to
  `#glossary?t=<id>`, which brings that entry into view and marks it.
- **Marked terms** are links in ink with a dotted underline. Pointing at
  one, or focusing it, shows its definition in a tip; on a touch screen
  the first tap shows the tip and the second follows the link. A screen
  reader hears the definition as the link's description. Defining
  instances are marked, and some later mentions (the sandbox's,
  chapter 9's); not every mention, which would underline half the text.

## The six-operator sandbox (PR #17)

- **A switch, Two | Six,** beside Play in the sandbox (screen readers hear
  "Two operators", "Six operators"). Two operators is the sandbox as it
  was, links and all. Six operators is chapter 8's lab: the 32 algorithms
  grouped by carriers, the diagram with lit boxes, the operator table,
  Feedback, the predicted spectrum and Live, and chapter 8's five
  presets; with the sandbox's keyboard, Volume and Copy link. The two keep
  their own settings, so switching back finds the other as it was;
  switching stops any sound. The chapter's text is the same in both.
- **Six operators play notes,** as in chapter 8: a key strikes a note at
  its pitch that dies away by itself; letting go does nothing, and
  pressing another key strikes again. There is no Carrier slider there:
  the keyboard sets the pitch. It opens on chapter 8's Stacks.
- **The link:** `#7?m=6&c=220&a=5&f=0.7&o=1_90_2.5-1_35_1.2-…`, the
  operators as ratio_level_decay with the level in whole percent, six
  joined by "-": characters a URL keeps as they are. Every value is held
  inside its range; the algorithm is rounded to 1 to 32; operators that
  are not exactly six of three numbers are ignored, leaving the starting
  ones. Without `m=6` a link is read exactly as before.
- **Room:** to fit at 1024×768 the sandbox drops the space-bar hint (the
  keyboard's letters stand in for it), the switch reads Two | Six, and the
  pinned lab's presets and keyboard sit a little closer. At 1024×768 in
  six operators the figures are at their smallest, 102 px, as at chapter
  8's last step.
- **No new terms:** chapter 7's text mentions the switch without chapter
  8's words (operator, algorithm), which the glossary rule keeps for
  chapter 8; chapter 8's last step points back to the sandbox.

## Named sections (PR #18)

Jeremy asked for sections with names instead of numbers, a way to find
them, and the sandbox at the end.

- **The sequence and its names** are one data module,
  `src/chapters/outline.ts`, in four groups: Basics (A single sine,
  Vibrato becomes tone), Two operators (The modulation index, Sidebands
  and Bessel functions, Carrier and modulator ratio, Sounds that change
  over time), The DX7 (Operators and algorithms, FM versus PM) and Play
  (Sandbox). Renaming or reordering is an edit there. Some titles changed
  from the numbered chapters': "Vibrato becomes tone" (was "…timbre"),
  "The modulation index", "Carrier and modulator ratio", "Sounds that
  change over time" (was "Time-varying index").
- **Addresses are names:** `#/sine` … `#/sandbox`, `#/` for the landing
  view and `#/glossary` for the glossary (an entry `#/glossary?t=index`).
  Old links (`#0` to `#9`, `#7?c=…`, `#7?m=6…`, `#glossary…`) are replaced
  in the address bar by the address they meant, their parameters kept.
- **No numbers on the page:** the kicker above a title is its group; the
  copy names other sections, as links, where it said "chapter 3"; the
  glossary says "Defined in" and the section's name. A test fails if any
  copy says "chapter" and a number. Figures keep "Fig. 1" and "Fig. 2".
- **The Contents button** in the header opens a panel listing the groups
  and sections, the current one marked, and the glossary: a modal
  dialog, so it takes focus (on the current section), keeps Tab inside,
  closes on Escape or a click outside, and gives focus back; it fills a
  phone's screen. Beside the button, where the reader is (group ·
  section); Glossary is linked from the header and the footer.
- **Previous and Next** at the end of each section are the neighbours'
  names, across groups. The sandbox is last, so has no Next.
- **The glossary's order test** uses the sequence from the outline. A
  link to a later section names it by its title, which may contain a
  term ("The modulation index"); such links do not count as using it.
  With the sandbox last, its text now names operators and algorithms.
- **Internally** a section is still a `Chapter`, with a string `id` in
  place of the number; `state.chapter` holds it.

## Audit fixes (PR #19)

A Lighthouse audit of production (mobile) found three things to fix.

- **Layout shift** (CLS 0.68 on the landing view, 0.36 on the sections):
  the web fonts arrived after the first paint and changed the size of
  the wordmark and buttons, which pushed the lab down; on the landing
  view the script's drawing moved it too. The page is now kept hidden
  until the script has drawn it and its fonts are in (at most 1.5 s of
  waiting for fonts), then shown in place. A style in index.html does
  the hiding, with a 3 s fallback so a failed script never leaves a
  blank page. CLS is 0 on all four pages audited.
- **robots.txt** was missing (the site answered with its page): added,
  allowing everything.
- **The J buttons** in Sidebands and Bessel functions showed "J₀" but were
  named "J0, the carrier"; the name now starts with what is shown
  ("J₀, the carrier"), so a voice command finds it.

