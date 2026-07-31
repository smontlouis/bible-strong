import { linkifyStrongEditorialBibleReferences } from '../strongEditorialHtml'

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (value: string) => value },
  getLanguage: () => 'fr',
}))

describe('Strong editorial HTML', () => {
  it('turns explicit Bible references in text nodes into internal links', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        '<p>Pierre rencontre Jésus en Jean 1:40-42 puis repart.</p>'
      )
    ).toBe(
      '<p>Pierre rencontre Jésus en <a href="bible://John.1.40-John.1.42">Jean 1:40-42</a> puis repart.</p>'
    )
  })

  it('replaces compact references with human-friendly labels', () => {
    expect(
      linkifyStrongEditorialBibleReferences('<p>Voir Rom.12:10 et 1Th.4:9.</p>', '#2563eb')
    ).toBe(
      '<p>Voir <a href="bible://Rom.12.10" style="color: #2563eb">Romains 12:10</a> et <a href="bible://1Thess.4.9" style="color: #2563eb">1 Thessaloniciens 4:9</a>.</p>'
    )
  })

  it('detects French and English reference conventions in the same Strong text', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        '<p>Rom.12:10, 1Th.4:9, Heb.13:1, 1Pe.1:22, 2Pe.1:7.</p>'
      )
    ).toBe(
      '<p><a href="bible://Rom.12.10">Romains 12:10</a>, <a href="bible://1Thess.4.9">1 Thessaloniciens 4:9</a>, <a href="bible://Heb.13.1">Hébreux 13:1</a>, <a href="bible://1Pet.1.22">1 Pierre 1:22</a>, <a href="bible://2Pet.1.7">2 Pierre 1:7</a>.</p>'
    )
  })

  it('links legacy French references from Strong entity descriptions without changing books', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        '<p>1Ro.1 ; 2 etc. ; 2Ro.8.19 ; Esr.3.10 ; Can.4.4 ; Ézé.34.23 ; Osé.3.5</p>'
      )
    ).toBe(
      '<p><a href="bible://1Kgs.1">1 Rois 1</a> ; <a href="bible://1Kgs.2">1 Rois 2</a> etc. ; <a href="bible://2Kgs.8.19">2 Rois 8:19</a> ; <a href="bible://Ezra.3.10">Esdras 3:10</a> ; <a href="bible://Song.4.4">Cantique des Cantiques 4:4</a> ; <a href="bible://Ezek.34.23">Ézéchiel 34:23</a> ; <a href="bible://Hos.3.5">Osée 3:5</a></p>'
    )
  })

  it('keeps the longest bilingual match before applying language priority', () => {
    expect(linkifyStrongEditorialBibleReferences('<p>See 1 John 3:2.</p>')).toBe(
      '<p>See <a href="bible://1John.3.2">1 Jean 3:2</a>.</p>'
    )
  })

  it('does not rewrite references already inside an anchor', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        '<p><a href="https://example.com">Jean 1:40</a> et Matthieu 4:18</p>'
      )
    ).toBe(
      '<p><a href="https://example.com">Jean 1:40</a> et <a href="bible://Matt.4.18">Matthieu 4:18</a></p>'
    )
  })

  it('preserves entity copy wrapped in legacy reference tags', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        'In <ref="Galatians 1:13-14">Galatians 1:13-14</ref>, Paul refers to his former way of life in Judaism.'
      )
    ).toBe(
      'In <a href="bible://Gal.1.13-Gal.1.14">Galates 1:13-14</a>, Paul refers to his former way of life in Judaism.'
    )
  })

  it('preserves dictionary copy wrapped in single-quoted legacy reference tags', () => {
    expect(linkifyStrongEditorialBibleReferences("before <ref='Eph.2.4'>Eph.2:4</ref> after")).toBe(
      'before <a href="bible://Eph.2.4">Éphésiens 2:4</a> after'
    )
  })

  it('converts legacy dictionary levels to renderable blocks', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        '<Level1><b>A</b></Level1><Level2><b>A.1</b></Level2><Level3>A.1.a</Level3><Level4>note</Level4>'
      )
    ).toBe('<div><b>A</b></div><div><b>A.1</b></div><div>A.1.a</div><div>note</div>')
  })

  it('converts legacy related-entry sections to renderable blocks', () => {
    expect(linkifyStrongEditorialBibleReferences('<re><i>SYN.</i>: καλός</re>')).toBe(
      '<div><i>SYN.</i>: καλός</div>'
    )
  })

  it('converts legacy inline dictionary tags to renderable spans', () => {
    expect(
      linkifyStrongEditorialBibleReferences(
        '<note>variant</note><date>500 BC</date><author>Homer</author><def>meaning</def><corr>corrected</corr>'
      )
    ).toBe(
      '<span>variant</span><span>500 BC</span><span>Homer</span><span>meaning</span><span>corrected</span>'
    )
  })

  it('converts legacy dictionary line breaks without swallowing subsequent copy', () => {
    expect(linkifyStrongEditorialBibleReferences('before<lb />after')).toBe('before<br />after')
  })

  it('restores Strong codes encoded as legacy HTML tags', () => {
    expect(linkifyStrongEditorialBibleReferences('called Jerusalem <H3389> after')).toBe(
      'called Jerusalem H3389 after'
    )
  })

  it('preserves standard HTML headings', () => {
    expect(linkifyStrongEditorialBibleReferences('<h1>Heading</h1>')).toBe('<h1>Heading</h1>')
  })

  it('repairs legacy strong tags without swallowing subsequent copy', () => {
    expect(
      linkifyStrongEditorialBibleReferences('before <strong="H7676">Sabbath</strong> after')
    ).toBe('before <strong>Sabbath</strong> after')
  })

  it('repairs the malformed Teraphim emphasis tag', () => {
    expect(
      linkifyStrongEditorialBibleReferences('before <s trong="H8655">Teraphim</strong> after')
    ).toBe('before <strong>Teraphim</strong> after')
  })
})
