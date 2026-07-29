import { linkifyStrongEditorialBibleReferences } from '../strongEditorialHtml'

jest.mock('~i18n', () => ({
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
