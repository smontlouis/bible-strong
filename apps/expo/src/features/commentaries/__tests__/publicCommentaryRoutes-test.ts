import { buildPublicCommentaryPath, parsePublicCommentaryRoute } from '../publicCommentaryRoutes'

describe('public commentary routes', () => {
  it('builds a chapter and compact deterministic section path', () => {
    expect(
      buildPublicCommentaryPath({ resourceId: 'barnes', language: 'fr', book: 43, chapter: 3 })
    ).toBe('/commentary/fr/barnes/john/3')
    expect(
      buildPublicCommentaryPath({
        resourceId: 'barnes',
        language: 'fr',
        book: 43,
        chapter: 3,
        sectionId: 'barnes-fr-43-3-16-18',
      })
    ).toBe('/commentary/fr/barnes/john/3/16-18')
  })

  it('restores the full section identity from the public route', () => {
    expect(
      parsePublicCommentaryRoute({
        language: 'fr',
        resource: 'barnes',
        book: 'john',
        chapter: '3',
        section: '16-18',
      })
    ).toEqual({
      resourceId: 'barnes',
      language: 'fr',
      book: 43,
      chapter: 3,
      sectionId: 'barnes-fr-43-3-16-18',
    })
  })

  it('rejects unsupported projections and book identities', () => {
    expect(
      parsePublicCommentaryRoute({
        language: 'fr',
        resource: 'unknown',
        book: 'john',
        chapter: '3',
      })
    ).toBeUndefined()
    expect(
      parsePublicCommentaryRoute({
        language: 'fr',
        resource: 'barnes',
        book: 'unknown',
        chapter: '3',
      })
    ).toBeUndefined()
  })
})
