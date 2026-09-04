import {
  findDirectoryItemForArticle,
  groupDictionaryPassageEntries,
  pickPreferredDictionarySource,
} from '../dictionaryExperience'

const source = (
  work: string,
  language: 'fr' | 'en',
  id: number,
  word: string,
  correspondenceId?: string
) => ({
  resource: { kind: 'dictionary' as const, work, language, revision: 'r1' },
  resourceId: work.toUpperCase(),
  title: work,
  abbreviation: work,
  id,
  word,
  normalizedWord: word.toLocaleLowerCase(),
  evidenceKind: 'source-citation' as const,
  ...(correspondenceId ? { correspondenceId } : {}),
})

describe('dictionary experience', () => {
  it('groups passage anchors by correspondence without merging exact sources', () => {
    const entries = [
      source('westphal', 'fr', 1, 'Nébucadnetsar', 'nebuchadnezzar'),
      source('isbe', 'en', 2, 'Nebuchadnezzar', 'nebuchadnezzar'),
      source('bost', 'fr', 3, 'Babylone'),
    ]

    const concepts = groupDictionaryPassageEntries(entries, 'fr')

    expect(concepts).toHaveLength(2)
    expect(concepts.find(item => item.correspondenceId === 'nebuchadnezzar')).toMatchObject({
      label: 'Nébucadnetsar',
      sources: expect.arrayContaining([
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ id: 2 }),
      ]),
    })
  })

  it('prefers the requested language while keeping selection deterministic', () => {
    const sources = [source('isbe', 'en', 2, 'Aaron'), source('westphal', 'fr', 1, 'Aaron')]

    expect(pickPreferredDictionarySource(sources, 'fr')?.resource.work).toBe('westphal')
    expect(pickPreferredDictionarySource(sources, 'en')?.resource.work).toBe('isbe')
  })

  it('does not confuse unrelated entries when the correspondence id is absent', () => {
    const unrelated = {
      key: 'aaronites',
      label: 'Aaronites',
      normalizedLabel: 'aaronites',
      sources: [source('westphal', 'fr', 12, 'Aaronites')],
    }
    const aaron = {
      key: 'aaron',
      label: 'Aaron',
      normalizedLabel: 'aaron',
      sources: [source('westphal', 'fr', 13, 'Aaron')],
    }

    expect(
      findDirectoryItemForArticle([unrelated, aaron], {
        work: 'westphal',
        language: 'fr',
        word: 'Aaron',
      })
    ).toBe(aaron)
  })
})
