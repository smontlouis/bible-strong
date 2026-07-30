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
})
