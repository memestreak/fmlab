import { readFileSync } from 'node:fs';
import { FACTORY_CREDIT } from '../../ui/chapterView';

const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const masthead = html.slice(html.indexOf('<header class="masthead">'), html.indexOf('</header>'));
const instrument = html.slice(html.indexOf('<section id="instrument"'));

describe('the sandbox\'s masthead', () => {
  it('holds the presets and Volume, where the sandbox puts them, beside Contents and the glossary', () => {
    expect(masthead).toContain('id="inst-dx7-presets"');
    expect(masthead).toContain('id="inst-tools"');
    expect(masthead).toContain('id="contents-open"');
    expect(masthead).toContain('href="#/glossary"');
    // The logo is the way home: its word is the link's name, its stripes
    // are drawn and hidden from screen readers.
    expect(masthead).toMatch(/<a href="#\/"><span class="logo-word">fmlab<\/span><span class="logo-bars" aria-hidden="true">/);
    // The presets are a group named for screen readers.
    expect(masthead).toMatch(/role="group" aria-labelledby="inst-presets-title"/);
    expect(masthead).toMatch(/id="inst-presets-title" class="visually-hidden">Presets</);
  });

  it('leaves the instrument its hidden title, and no title bar of its own', () => {
    expect(instrument).toMatch(/id="inst-title" class="inst-title visually-hidden"/);
    expect(instrument).not.toContain('inst-bar');
  });

  it('credits the factory voices in the menu, not on the page', () => {
    expect(FACTORY_CREDIT).toBe('DX7 factory voices © Yamaha');
    expect(html).not.toContain('© Yamaha</p>');
  });
});
