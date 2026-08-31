/* eslint-disable import/first */

jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))

import { commentaryHrefToOsis, parseCommentaryResourceParams } from '../commentaryResourceParams'

describe('commentary resource params', () => {
  it('parses a supported commentary projection and passage', () => {
    expect(
      parseCommentaryResourceParams({ projectionId: 'barnes:fr', book: '41', chapter: '1' })
    ).toMatchObject({
      projection: { projectionId: 'barnes:fr', resourceId: 'barnes', language: 'fr' },
      book: 41,
      chapter: 1,
    })
  })

  it('rejects invalid resource passage params', () => {
    expect(
      parseCommentaryResourceParams({ projectionId: 'unknown:fr', book: '41', chapter: '1' })
    ).toBeUndefined()
    expect(
      parseCommentaryResourceParams({ projectionId: 'barnes:fr', book: '0', chapter: '1' })
    ).toBeUndefined()
  })

  it('normalizes internal BCV hrefs and rejects external links', () => {
    expect(commentaryHrefToOsis('bible://Matt.3.13-Matt.3.17')).toBe('Matt.3.13-Matt.3.17')
    expect(commentaryHrefToOsis('/Matt_3.13-Matt_3.17')).toBe('Matt.3.13-Matt.3.17')
    expect(commentaryHrefToOsis('https://example.com')).toBeUndefined()
    expect(commentaryHrefToOsis('#index')).toBeUndefined()
  })
})
