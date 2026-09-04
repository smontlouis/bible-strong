import {
  getCanonicalBibleNoteLabel,
  getCanonicalBibleNotePlainText,
  parseCanonicalBibleNoteMarkup,
} from '../canonicalBibleNotes'

describe('canonicalBibleNotes', () => {
  it('parses the supported V3 note markup without interpreting arbitrary HTML', () => {
    const nodes = parseCanonicalBibleNoteMarkup(
      '<note n="c"><i>héb. : </i>âme<i>, voir <ref id="Gen.1.21">v. 21</ref>.</i></note>'
    )

    expect(nodes).toEqual([
      {
        kind: 'element',
        tag: 'i',
        attributes: {},
        children: [{ kind: 'text', text: 'héb. : ' }],
      },
      { kind: 'text', text: 'âme' },
      {
        kind: 'element',
        tag: 'i',
        attributes: {},
        children: [
          { kind: 'text', text: ', voir ' },
          {
            kind: 'element',
            tag: 'ref',
            attributes: { id: 'Gen.1.21' },
            children: [{ kind: 'text', text: 'v. 21' }],
          },
          { kind: 'text', text: '.' },
        ],
      },
    ])
    expect(getCanonicalBibleNoteLabel('<note n="c">Texte</note>')).toBe('c')
    expect(getCanonicalBibleNotePlainText(nodes)).toBe('héb. : âme, voir v. 21.')
  })

  it('supports divine names, small caps, superscripts, and XML entities', () => {
    const nodes = parseCanonicalBibleNoteMarkup(
      '<note n="a"><divineName>Éternel</divineName> &amp; <small-caps>Dieu</small-caps> 50<sup>e</sup></note>'
    )

    expect(getCanonicalBibleNotePlainText(nodes)).toBe('Éternel & Dieu 50e')
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'element', tag: 'divineName' }),
        expect.objectContaining({ kind: 'element', tag: 'small-caps' }),
        expect.objectContaining({ kind: 'element', tag: 'sup' }),
      ])
    )
  })

  it('normalizes relative OSIS ranges carried by reference tags', () => {
    const nodes = parseCanonicalBibleNoteMarkup(
      '<note n="a">voir <ref id="Rom.8.1-11">Romains 8.1-11</ref></note>'
    )

    expect(nodes).toEqual([
      { kind: 'text', text: 'voir ' },
      {
        kind: 'element',
        tag: 'ref',
        attributes: { id: 'Rom.8.1-Rom.8.11' },
        children: [{ kind: 'text', text: 'Romains 8.1-11' }],
      },
    ])
  })

  it('normalizes V4 space-separated OSIS references into one navigable reference list', () => {
    const nodes = parseCanonicalBibleNoteMarkup(
      '<note n="a"><ref id="Ps.33.6 Acts.14.15 Heb.11.3">references</ref></note>'
    )

    expect(nodes).toEqual([
      {
        kind: 'element',
        tag: 'ref',
        attributes: { id: 'Ps.33.6,Acts.14.15,Heb.11.3' },
        children: [{ kind: 'text', text: 'references' }],
      },
    ])
  })
})
