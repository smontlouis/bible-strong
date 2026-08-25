import type { Link } from '~redux/modules/user'
import { normalizeRelation } from '../domain'
import {
  addExternalLinkSystemRelations,
  groupVerseKeysByChapter,
  refreshExternalLinkSystemRelations,
  removeExternalLinkSystemRelations,
} from '../systemRelationLifecycle'

jest.mock('~assets/bible_versions/books-desc', () => [
  { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  { Numero: 65, Nom: 'Jude', Chapitres: 1 },
])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
}))

const createLink = (overrides: Partial<Link> = {}): Link => ({
  id: 'link-1',
  url: 'https://example.com',
  linkType: 'website',
  date: 1,
  ...overrides,
})

describe('systemRelationLifecycle', () => {
  it('groups Verse keys by chapter', () => {
    expect(groupVerseKeysByChapter(['1-1-1', '1-1-2', '1-2-1', '65-1-1'])).toEqual([
      ['1-1-1', '1-1-2'],
      ['1-2-1'],
      ['65-1-1'],
    ])
  })

  it('adds external Link System relations per chapter group', () => {
    const relations = addExternalLinkSystemRelations({
      linkKey: 'link-1',
      link: createLink(),
      verseKeys: ['1-1-1', '1-1-2', '1-2-1'],
    })

    expect(Object.values(relations).map(relation => relation.endpointKeys)).toEqual([
      ['externalLink:link-1', 'verse:1-1-1/1-1-2'],
      ['externalLink:link-1', 'verse:1-2-1'],
    ])
  })

  it('copies the Link source version to Verse endpoints', () => {
    const relations = addExternalLinkSystemRelations({
      linkKey: 'link-1',
      link: createLink({ version: 'VUL' }),
      verseKeys: ['67-1-1'],
    })

    expect(
      Object.values(relations)[0].endpoints.find(endpoint => endpoint.type === 'verse')
    ).toMatchObject({ verseKeys: ['67-1-1'], version: 'VUL' })
  })

  it('refreshes external Link endpoint labels without changing the Verse endpoint', () => {
    const relations = addExternalLinkSystemRelations({
      linkKey: 'link-1',
      link: createLink({ customTitle: 'Old title' }),
      verseKeys: ['1-1-1'],
    })

    const refreshed = refreshExternalLinkSystemRelations({
      relations,
      linkKey: 'link-1',
      link: createLink({ customTitle: 'New title' }),
      updatedAt: 42,
    })

    const relation = Object.values(refreshed)[0]
    const linkEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'externalLink')
    const verseEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'verse')

    expect(linkEndpoint).toMatchObject({ labelFallback: 'New title' })
    expect(verseEndpoint).toMatchObject({ verseKeys: ['1-1-1'] })
    expect(relation.updatedAt).toBe(42)
  })

  it('removes only matching external Link System relations', () => {
    const linkRelations = addExternalLinkSystemRelations({
      linkKey: 'link-1',
      link: createLink(),
      verseKeys: ['1-1-1'],
    })
    const otherLinkRelations = addExternalLinkSystemRelations({
      relations: linkRelations,
      linkKey: 'link-2',
      link: createLink({ id: 'link-2', url: 'https://example.org' }),
      verseKeys: ['1-1-2'],
    })
    const manualRelation = normalizeRelation({
      id: 'manual-relation',
      kind: 'manual',
      type: 'linked',
      direction: 'none',
      endpoints: [
        { type: 'verse', verseKeys: ['1-1-1'] },
        { type: 'verse', verseKeys: ['1-1-3'] },
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    const relations = removeExternalLinkSystemRelations(
      { ...otherLinkRelations, [manualRelation.id]: manualRelation },
      'link-1'
    )

    expect(Object.values(relations).map(relation => relation.id)).toEqual([
      Object.values(otherLinkRelations).find(relation =>
        relation.endpointKeys.includes('externalLink:link-2')
      )?.id,
      'manual-relation',
    ])
  })
})
