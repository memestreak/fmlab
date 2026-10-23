# Editing the tutorial text

How to reword the fmlab sections.

## Where the words are

| What | File |
| --- | --- |
| Section names, groups and their order | `src/chapters/outline.ts` (rename here and the Contents panel, the ‹ › arrows and Previous / Next all follow) |
| A section's text | one file each in `src/chapters/`: `singleSine.ts` (A single sine), `vibrato.ts`, `modulationIndex.ts`, `bessel.ts` (Sidebands and Bessel functions), `ratio.ts`, `envelope.ts`, `operators.ts` (Operators and algorithms), `fmVsPm.ts`, `dx7Voice.ts` |
| The landing page | `src/chapters/landing.ts` |
| Glossary terms: name, one-line definition, formula | `src/chapters/terms.ts` |

Each section file exports one object. The parts you'll edit:

- `body`: the lesson, a list of paragraphs. Each backtick string is one paragraph.
- `maths`: the "The maths" panels, each a `title` and its own `body` list.
- `figures`: the caption under each figure, keyed by figure (`waveform`, `spectrum`, ...); the key order doesn't set the numbering.
- `presets` (some sections): each button's `label` and `hint`.
- `steps` (Operators and algorithms only): the parts the section is built up in, each with a `label` (its button), a `title` (its heading) and its own `body`.
- `labels` (some sections): a slider's name where the section calls it something else.

## Syntax

Every paragraph is a JavaScript template string: text between backticks. Inside it, write HTML.

```ts
body: [
  `First paragraph. Line breaks inside the backticks don't matter;
   it renders as one paragraph.`,
  `Second paragraph, with <strong>bold</strong> and <em>italics</em>.`,
],
```

- **Emphasis:** `<strong>` for bold, `<em>` for italics. Use `<strong>` for a button's name, as in "press <strong>Make the carrier vanish</strong>".
- **Subscripts and variables:** `J<sub>0</sub>`, `<var>f</var><sub>c</sub>`.
- **A formula on its own line** (maths panels only): `` `<p class="formula">…</p>` `` as its own list item.
- **Helpers:** these are written as `${...}`, inside the backticks.
  - `${sectionLink('ratio')}` links to another section by its id, as "Carrier and modulator ratio"; a second argument changes the words. The ids are in `outline.ts`. Never write a section's number.
  - `${define('bessel')}` marks the place a term is first defined: bold, with a tip and a link to the glossary. Pass a second argument to change the wording: `${define('bessel', 'Bessel functions')}`.
  - `${use('index')}` marks a later mention of a term that is already defined.
  - `define` and `use` both take the text to show as a second argument, for example `${use('algorithm', 'algorithms')}` for a plural.
  - `formula('bessel')` is the term's formula from `terms.ts`, as a line of its own. It goes in its section's maths panel as a list item by itself, not inside backticks: `` body: [`…`, formula('bessel'), `…`] ``.
  - `${wikipedia('Bessel_function', 'Bessel function')}` adds an outside link, marked ↗. Use it only for proper nouns in the lesson text, or where a formula appears in the maths panels.
- **Backticks and `${`** are special inside these strings. To show a literal backtick, write `` \` ``.

A real example, from `bessel.ts`:

```ts
`Fig. 2 is the map. Each curve gives the height of one pair of
 sidebands at every index: J<sub>1</sub> the first pair, ...
 These curves are ${define('bessel', 'Bessel functions')}, named
 after the astronomer who studied them in 1824.`,
```

## Rules the tests check

`npm test` fails if you break these:

- A term must be in `terms.ts` first. Its entry names the section that defines it (`section`), and its `match` pattern is how the tests find it in the text.
- It is defined (`define`) exactly once, in that section's lesson (not a caption or a maths panel), at its first mention there.
- No section before that one mentions it at all, in its lesson, maths or captions, even without `use`.
- A term with a formula has `formula(id)` in its section's maths.
- A paragraph introduces at most one term, and two sentences running never each define one.

The other conventions (not tested):

- The lesson text is plain language for musicians. Formulas go in the maths panels.
- Never write a section's number in its text. Link to it by name with `sectionLink`.
- Figures are numbered from 1 in the order the page shows them, counting only those the section has. Keep "Fig. 1" and "Fig. 2" in the text in step with the page.

## Preview and check

```bash
npm run dev        # then open http://localhost:5173/#/sidebands (any section's id)
npm test           # the term-order rules above
npm run lint
npm run typecheck
```

The dev server reloads the page as you save.

## Getting edits onto the site

Push a branch and open a pull request; CI runs lint, tests, build and typecheck, and Cloudflare Pages posts a preview.
