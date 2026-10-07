import { describe, expect, it } from 'vitest'
import { renderBibleText } from './bibleLayout'

type Verse = Parameters<typeof renderBibleText>[0][number]
type Layout = Verse['presentation']['layout'][number]

const verse = (
  number: number,
  text: string,
  presentation: Partial<Verse['presentation']> = {}
): Verse =>
  ({
    number,
    text,
    presentation: { startTags: [], layout: [], notes: [], headings: [], ...presentation },
  }) as Verse

const event = (
  offset: number,
  order: number,
  type: Layout['type'],
  tag: string,
  attributes?: Record<string, string>
): Layout => ({ offset, order, type, tag, ...(attributes ? { attributes } : {}) })

const options = {
  verseHref: (number: number) => `/v/${number}`,
  verseLabel: (number: number) => `Verse ${number}`,
  includeHeadings: true,
}

const number = (value: number) =>
  `<a id="v${value}" class="bible-verse-number" href="/v/${value}" aria-label="Verse ${value}">${value}</a>`

/** Every opened element is closed, in order. */
const isWellFormed = (html: string): boolean => {
  const stack: string[] = []
  for (const match of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/gu)) {
    if (match[1] === '/') {
      if (stack.pop() !== match[2]) return false
    } else stack.push(match[2] ?? '')
  }
  return stack.length === 0
}

describe('renderBibleText', () => {
  it('gives each verse its own paragraph when the version has no paragraph marks', () => {
    const { html } = renderBibleText([verse(1, 'Au commencement'), verse(2, 'La terre')], options)
    expect(html).toBe(
      `<p class="bible-p bible-p--verse">${number(1)}Au commencement</p>` +
        `<p class="bible-p bible-p--verse">${number(2)}La terre</p>`
    )
  })

  it('keeps words of Jesus open across verses and reopens them in each paragraph', () => {
    const { html } = renderBibleText(
      [
        verse(1, 'Il dit : Venez', { layout: [event(9, 0, 'open', 'wj')] }),
        verse(2, 'et voyez. Ils vinrent', { layout: [event(9, 0, 'close', 'wj')] }),
      ],
      options
    )
    expect(html).toBe(
      `<p class="bible-p bible-p--verse">${number(1)}Il dit : <span class="bible-wj">Venez</span></p>` +
        `<p class="bible-p bible-p--verse">${number(2)}<span class="bible-wj">et voyez.</span> Ils vinrent</p>`
    )
    expect(isWellFormed(html)).toBe(true)
  })

  it('flows several verses in one paragraph and starts a new one where marked', () => {
    const { html } = renderBibleText(
      [
        verse(1, 'Un.', { layout: [event(0, 0, 'open', 'p')] }),
        verse(2, 'Deux.', { layout: [event(5, 0, 'close', 'p')] }),
        verse(3, 'Trois.', { layout: [event(0, 0, 'open', 'p'), event(6, 1, 'close', 'p')] }),
      ],
      options
    )
    expect(html).toBe(
      `<p class="bible-p">${number(1)}Un. ${number(2)}Deux.</p><p class="bible-p">${number(3)}Trois.</p>`
    )
  })

  it('renders poetry as stanzas and lines, from tags or from milestones', () => {
    const tagged = renderBibleText(
      [
        verse(1, 'Ligne un, ligne deux', {
          layout: [
            event(0, 0, 'open', 'lg'),
            event(0, 1, 'open', 'l'),
            event(9, 2, 'close', 'l'),
            event(10, 3, 'open', 'l', { level: '2' }),
            event(20, 4, 'close', 'l'),
            event(20, 5, 'close', 'lg'),
          ],
        }),
      ],
      options
    )
    expect(tagged.html).toBe(
      `<div class="bible-lg"><span class="bible-l">${number(1)}Ligne un,</span>` +
        `<span class="bible-l bible-l--2">ligne deux</span></div>`
    )

    const milestones = renderBibleText(
      [
        verse(1, 'Ligne un', {
          layout: [
            event(0, 0, 'self', 'lg', { sid: 'a' }),
            event(0, 1, 'self', 'l', { sid: 'b', level: '1' }),
            event(8, 2, 'self', 'l', { eid: 'b', level: '1' }),
            event(8, 3, 'self', 'lg', { eid: 'a' }),
          ],
        }),
      ],
      options
    )
    expect(milestones.html).toBe(
      `<div class="bible-lg"><span class="bible-l">${number(1)}Ligne un</span></div>`
    )
  })

  it('continues the block and the formatting open before the first verse', () => {
    const { html } = renderBibleText(
      [verse(16, 'Car Dieu', { startTags: [{ tag: 'p' }, { tag: 'wj' }] })],
      { ...options, includeHeadings: false }
    )
    expect(html).toBe(`<p class="bible-p">${number(16)}<span class="bible-wj">Car Dieu</span></p>`)
  })

  it('prints section titles between paragraphs, unless a passage is quoted', () => {
    const titled = verse(1, 'Texte', {
      headings: [{ offset: 0, order: 0, kind: 'pericope', type: 'section', text: 'Titre', markup: '' }],
    })
    expect(renderBibleText([titled], options).html).toBe(
      `<h2 class="bible-heading bible-heading--section">Titre</h2><p class="bible-p bible-p--verse">${number(1)}Texte</p>`
    )
    expect(renderBibleText([titled], { ...options, includeHeadings: false }).html).toBe(
      `<p class="bible-p bible-p--verse">${number(1)}Texte</p>`
    )
  })

  it('numbers the notes and keeps their sanitized content apart', () => {
    const { html, notes } = renderBibleText(
      [
        verse(1, 'Le Verbe était', {
          notes: [
            { offset: 8, order: 0, kind: 'note', markup: '<note n="a"><i>ou :</i> la Parole<script>x</script></note>' },
          ],
        }),
      ],
      options
    )
    expect(html).toBe(
      `<p class="bible-p bible-p--verse">${number(1)}Le Verbe` +
        `<a id="note-ref-1" class="bible-note-ref" href="#note-1" data-note="1" role="doc-noteref" aria-label="Note 1">1</a> était</p>`
    )
    expect(notes).toEqual([{ id: 1, verse: 1, html: '<i>ou :</i> la Parolex' }])
  })

  it('links the cross-references of a note the page can resolve', () => {
    const { notes } = renderBibleText(
      [
        verse(1, 'Heureux', {
          notes: [
            {
              offset: 0,
              order: 0,
              kind: 'note',
              markup:
                '<note type="crossReference"><ref id="Mark.3.13" data-osis-tag="reference">Mark 3:13</ref>; <ref id="Tob.1.1">Tob 1:1</ref></note>',
            },
          ],
        }),
      ],
      {
        ...options,
        referenceHref: reference => (reference === 'Mark.3.13' ? '/bible/kjv/mark/3/13' : undefined),
      }
    )
    expect(notes[0]?.html).toBe('<a href="/bible/kjv/mark/3/13">Mark 3:13</a>; Tob 1:1')
  })

  it('prints a section title before the note it shares its position with', () => {
    const { html } = renderBibleText(
      [
        verse(1, 'Voyant la foule', {
          notes: [{ offset: 0, order: 0, kind: 'note', markup: '<note>Luc 6</note>' }],
          headings: [
            { offset: 0, order: 0, kind: 'pericope', type: 'section', text: 'Le sermon', markup: '' },
          ],
        }),
      ],
      options
    )
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('bible-verse-number'))
    expect(html.indexOf('bible-verse-number')).toBeLessThan(html.indexOf('bible-note-ref'))
  })

  it('prints markers after their word, inside the formatting open at that position', () => {
    const chip = (code: string) => `<a class="strong-ref" href="/strong/fr/${code}">${code}</a>`
    const { html } = renderBibleText(
      [
        verse(1, 'Jésus dit : Suis-moi', {
          layout: [event(12, 0, 'open', 'wj'), event(20, 1, 'close', 'wj')],
        }),
      ],
      {
        ...options,
        markersByVerse: new Map([
          [
            1,
            [
              { offset: 5, html: chip('g2424') },
              { offset: 20, html: chip('g190') },
            ],
          ],
        ]),
      }
    )
    expect(html).toBe(
      `<p class="bible-p bible-p--verse">${number(1)}Jésus${chip('g2424')} dit : ` +
        `<span class="bible-wj">Suis-moi${chip('g190')}</span></p>`
    )
    expect(isWellFormed(html)).toBe(true)
  })

  it('reads a block between two verses and starts a new paragraph after it', () => {
    const aside = (name: string) => `<div class="aside">${name}</div>`
    const { html } = renderBibleText(
      [
        verse(1, 'Un.', { layout: [event(0, 0, 'open', 'p'), event(0, 1, 'open', 'wj')] }),
        verse(2, 'Deux.', { layout: [event(5, 0, 'close', 'wj'), event(5, 1, 'close', 'p')] }),
      ],
      { ...options, blocksAfterVerse: new Map([[0, aside('intro')], [1, aside('one')], [2, aside('two')]]) }
    )
    expect(html).toBe(
      `${aside('intro')}<p class="bible-p">${number(1)}<span class="bible-wj">Un.</span></p>${aside('one')}` +
        `<p class="bible-p">${number(2)}<span class="bible-wj">Deux.</span></p>${aside('two')}`
    )
    expect(isWellFormed(html)).toBe(true)
  })

  it('goes on with a stanza interrupted by a block', () => {
    const aside = '<div class="aside">comment</div>'
    const { html } = renderBibleText(
      [
        verse(1, 'Ligne une', {
          layout: [event(0, 0, 'open', 'lg'), event(0, 1, 'open', 'l'), event(9, 2, 'close', 'l')],
        }),
        verse(2, 'Ligne deux', {
          layout: [event(0, 0, 'open', 'l'), event(10, 1, 'close', 'l'), event(10, 2, 'close', 'lg')],
        }),
        verse(3, 'Prose.'),
      ],
      { ...options, blocksAfterVerse: new Map([[1, aside], [2, aside]]) }
    )
    expect(html).toBe(
      `<div class="bible-lg"><span class="bible-l">${number(1)}Ligne une</span></div>${aside}` +
        `<div class="bible-lg"><span class="bible-l">${number(2)}Ligne deux</span></div>${aside}` +
        `<p class="bible-p">${number(3)}Prose.</p>`
    )
    expect(isWellFormed(html)).toBe(true)
  })

  it('escapes the text and ignores layout it does not know', () => {
    const { html } = renderBibleText(
      [
        verse(1, 'a < b & c', {
          layout: [event(0, 0, 'open', 'span', { type: 'otPassage' }), event(9, 1, 'close', 'span')],
        }),
      ],
      options
    )
    expect(html).toBe(`<p class="bible-p bible-p--verse">${number(1)}a &lt; b &amp; c</p>`)
  })
})
