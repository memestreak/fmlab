# Bringing fmlab's settings in line with the settings philosophy

Status: tracking plan (2026-10-29). Nothing here is built yet; this file
and its PR track the work.

The philosophy is the one written for Frets (frets#195) and meant for all
of Jeremy's apps: the work and preferences kept apart, one Settings dialog
holding every preference, shaped like REAPER's Preferences (a tree of
groups and sections, one section's fields at a time), changes staged
behind OK / Apply / Cancel, a label's double click resetting its field,
and one storage key per section, `<app>.<page>.<section>`.

## Where fmlab is today

- One key, `fmlab.settings`, holds every sandbox setting as one JSON
  object (`src/model/settings.ts`); the chapters' theme has its own key,
  `fmlab.theme`, a bare word (`src/model/theme.ts`, read by the boot
  script in `index.html`).
- The Settings panel (`src/ui/settingsPanel.ts`) is sandbox only, two tabs
  (General, MIDI) of VFD lines, each change applied and saved at once.
- Some saved settings are not in the panel: Reverb and its four values
  (the Voice section's Reverb tab), `midi` (the keyboard's MIDI key), and
  the theme (the chapters' theme switch).
- The chapters have no Settings key at all.
- Volume is in the lab's store and is not saved.
- `loadSettings` / `saveSettings` already fall back to defaults and
  swallow storage errors silently; a failed save is not reported.

## Classification

Rule: if two people opening the same link should hear or see it the same
way, it is the work (the voice, carried by the share link) and does not go
in Settings.

| Value | Kind | Note |
| --- | --- | --- |
| Screen glitch, Motion, Tips on hover, Z X hint, Note names, Computer keys, Wheel | Preference | |
| Key velocity | Preference | How the player's keys strike |
| MIDI on, Input, Channel, Bend range, Velocity curve | Preference | The player's controller |
| Theme (chapters) | Preference | |
| Reverb on, Decay, Mix, Tone, Pre-delay | The work | Part of the sound (Jeremy, 2026-10-29): moves into the voice, its presets and the share link |
| Volume | Instrument state | Neither a preference nor part of the sound (Jeremy, 2026-10-29): stays unsaved and out of Settings |
| Octave, mod wheel, pitch bend | Instrument state | Not saved; stays out of Settings |
| Algorithm, operators, LFO, pitch EG, feedback | The work | Already in the voice and the link |

## Proposed tree

General
- Appearance: Theme (chapters only; the synth stays dark), Motion,
  Tips on hover

Synth
- Display: Screen glitch, Z X hint, Note names, Computer keys
- Keyboard: Key velocity, Wheel
- MIDI: MIDI in, Input, Channel, Bend range, Velocity curve, Last
  velocity (read only)

Learn
- No section yet (Theme, Motion and Tips are app-wide), so the group is
  not shown until it has one. A chapter's gear opens General.

## Work to do

### Reverb becomes part of the sound
- [x] Take Reverb, Decay, Mix, Tone and Pre-delay out of `Settings` and
      into the voice (the lab's patch), so a voice edit, a preset and a
      link all carry them. The Reverb tab stays where it is, editing the
      voice instead of a setting.
- [x] Give every preset a reverb, off in both banks to start (Jeremy,
      2026-10-29); a reverb edit marks the name EDITED.
- [x] Add the reverb to the share link (a new parameter, validated and
      clamped in `soundFromParams`; a link without it is reverb off).
- [x] Reverb changes, an edit's or a preset's, are heard at once, tails
      and all: there is one plate for every note.

### Model and storage
- [x] Split `fmlab.settings` into one key per section:
      `fmlab.general.appearance`, `fmlab.synth.display`,
      `fmlab.synth.keyboard`, `fmlab.synth.midi`.
- [x] Move the theme into `fmlab.general.appearance`; update the boot
      script in `index.html` to read it there.
- [x] One parser per section, every field checked, defaults on anything
      missing or invalid. No migration of the old keys (no users yet).
- [x] Report a failed save once, quietly: a console warning
      (`settingsSaveFailed` for the dialog's one-off line, in the dialog
      PR), never blocking the dialog from closing.
- [x] Name settings `fmlab.<page>.<section>.<setting>` in code and docs
      (`settingName`).

### Dialog
- [ ] Replace the two tabs with a tree on the left (▸/▾ group heads,
      sections under them, selected section filled) and a framed pane on
      the right headed `Group › Section`, each field a row, label left,
      control right. Keep the synth's look (chassis plastic, VFD glass,
      push keys, silkscreen).
- [ ] Phone width: a group picker and a sideways-scrolling strip of that
      group's sections above the pane; the heading stays.
- [ ] Full-word labels; reuse the app's own controls (the line's ‹ value ›
      and its drop-down, knobs, push keys).
- [ ] Hide sections with nothing to choose.

### Staging
- [ ] Changes inside the dialog are staged; OK saves and closes, Apply
      saves and stays, Cancel discards. Esc and Close are Cancel, with no
      prompt.
- [ ] Apply disabled until a staged value differs from the saved one, and
      again after pressing it.
- [ ] Saving updates the page at once (settings store set on OK / Apply
      only).
- [ ] The dialog stays modal: nothing behind it changes while it is open.
      Check the note keys still playing while it is open: they do not
      change a setting, so they can stay.

### Reset
- [ ] Double click on a field's label resets it to its default (staged);
      a long press does the same on touch; the label's tip says
      "Double-click to reset". The control itself never resets on double
      click. No reset-all button.

### Shortcuts write the same value
- [x] The MIDI key and the chapters' theme switch read and write the same saved values the
      dialog shows; no second copy.

### Entry points
- [ ] Synth: the Settings key opens the dialog at Synth, expanded, first
      section selected; other groups collapsed.
- [ ] The gear is the last page-level action: move the Learn key left of
      Settings.
- [ ] Chapters: add a gear to the masthead that opens the dialog at
      General.
- [ ] Make Motion and Tips on hover act on the chapters as well as the
      synth (`motionReduced()`, the terms' tips).

### Docs
- [ ] Update `CLAUDE.md` (settings.ts, the Settings panel, storage keys)
      and the design spec.

## Decisions (Jeremy, 2026-10-29)

- Reverb is part of the sound: the voice, its presets and the share link.
  Every preset starts with it off.
- Volume is neither a preference nor part of the sound: unsaved, out of
  Settings.
- The Learn key moves left of Settings, so the gear is the last
  page-level action.
- The chapters get a gear that opens the dialog at General.
- Motion and Tips on hover are app-wide (General › Appearance): the
  chapters' animations and term tips follow them too.
