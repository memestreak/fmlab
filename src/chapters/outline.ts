// The guide's sequence and every name in it, in one place: the groups,
// and each section's address (#/index) and title. Rename or reorder here;
// the contents panel, the previous and next links, the glossary and the
// links between sections all follow. The sections' content is in their
// own files, joined to these names by `id` in index.ts.

export const OUTLINE = [
  {
    group: 'Basics',
    sections: [
      { id: 'sine', title: 'A single sine' },
      { id: 'vibrato', title: 'Vibrato becomes tone' },
    ],
  },
  {
    group: 'Two operators',
    sections: [
      { id: 'index', title: 'The modulation index' },
      { id: 'sidebands', title: 'Sidebands and Bessel functions' },
      { id: 'ratio', title: 'Carrier and modulator ratio' },
      { id: 'envelopes', title: 'Sounds that change over time' },
    ],
  },
  {
    group: 'The DX7',
    sections: [
      { id: 'algorithms', title: 'Operators and algorithms' },
      { id: 'fm-vs-pm', title: 'FM versus PM' },
      { id: 'dx7-voice', title: 'A DX7 voice' },
    ],
  },
  {
    group: 'Play',
    sections: [{ id: 'sandbox', title: 'Sandbox' }],
  },
] as const;

/** A section of the guide, by its address. */
export type SectionId = (typeof OUTLINE)[number]['sections'][number]['id'];

/** The sections in reading order. */
export const SECTION_IDS: readonly SectionId[] = OUTLINE.flatMap(g =>
  g.sections.map(s => s.id),
);

/** The landing view's id: not a section, at "#/". */
export const LANDING = 'landing';

/** The glossary's id: not in the sequence, at "#/glossary". */
export const GLOSSARY = 'glossary';

/** Anything the page can show: a section, the landing view or the glossary. */
export type ViewId = SectionId | typeof LANDING | typeof GLOSSARY;

const entry = (id: SectionId) => {
  for (const { group, sections } of OUTLINE) {
    const section = sections.find(s => s.id === id);
    if (section) return { group, title: section.title };
  }
  throw new Error(`No section ${id}`);
};

/** A section's title. */
export function titleOf(id: SectionId): string {
  return entry(id).title;
}

/** The group a section is in. */
export function groupOf(id: SectionId): string {
  return entry(id).group;
}

/** Where a section comes in the sequence, from 0. */
export function orderOf(id: SectionId): number {
  return SECTION_IDS.indexOf(id);
}

/** A link to a section from the text, by its title unless `text` is given. */
export function sectionLink(id: SectionId, text: string = titleOf(id)): string {
  return `<a href="#/${id}">${text}</a>`;
}
