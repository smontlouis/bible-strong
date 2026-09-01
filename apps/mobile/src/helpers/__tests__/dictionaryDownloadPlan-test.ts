import {
  createDictionaryDirectoryDownloadItem,
  createDictionaryDownloadPlan,
} from '../downloadItemFactory'

jest.mock('~helpers/databaseTypes', () => ({ isSharedDB: () => false }))
jest.mock('~helpers/bibleVersions', () => ({ versions: {} }))
jest.mock('~helpers/databases', () => ({
  databases: () => ({}),
  getCommentaryDbPath: () => '/documents/commentary.sqlite',
  getDbPath: () => '/documents/database.sqlite',
  getDictionaryDbPath: (work: string) => `/documents/${work}.sqlite`,
  getDictionaryDirectoryDbPath: () => '/documents/dictionary-directory.sqlite',
}))
jest.mock('~helpers/mobileResourceCatalog', () => ({
  getMobileResourceCatalogEntry: (id: string) => ({
    id,
    url: `https://example.test/${id}.zip`,
    entry: id === 'dictionary-directory' ? 'dictionary-directory.sqlite' : 'dictionnaire.sqlite',
    entries: {},
    archiveSha256: 'a'.repeat(64),
    archiveBytes: 100,
  }),
}))
jest.mock('~helpers/strongBiblePublications', () => ({
  getStrongBiblePublication: jest.fn(),
  isStrongCapableBibleVersion: () => false,
}))
jest.mock('~helpers/interlinearBiblePublications', () => ({
  BHG_INTERLINEAR_PUBLICATION: {},
  isInterlinearCapableBibleVersion: () => false,
}))
jest.mock('~helpers/strongLexiconDownloadItems', () => ({
  createStrongLexiconModuleDownloadItem: jest.fn(),
  createStrongLexiconModuleDownloadPlan: jest.fn(),
}))

describe('dictionary download plan', () => {
  it('installs the shared Directory before the selected dictionary', () => {
    const plan = createDictionaryDownloadPlan({
      kind: 'dictionary',
      work: 'westphal',
      resourceId: 'WESTPHAL',
      language: 'fr',
    })

    expect(plan.map(item => item.id)).toEqual([
      'dictionary-directory',
      'dictionary:westphal:WESTPHAL:fr',
    ])
    expect(plan[1]?.dependsOnId).toBe('dictionary-directory')
  })

  it('uses one language-neutral shared Offline copy', () => {
    expect(createDictionaryDirectoryDownloadItem()).toEqual(
      expect.objectContaining({
        id: 'dictionary-directory',
        type: 'dictionary-directory',
        archiveEntry: 'dictionary-directory.sqlite',
      })
    )
  })

  it('does not download the shared Directory again when it is installed', () => {
    expect(
      createDictionaryDownloadPlan(
        {
          kind: 'dictionary',
          work: 'bost',
          resourceId: 'BOST',
          language: 'fr',
        },
        true
      ).map(item => item.id)
    ).toEqual(['dictionary:bost:BOST:fr'])
  })
})
