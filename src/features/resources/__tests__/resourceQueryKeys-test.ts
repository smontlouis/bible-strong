import { resourceQueryKeys } from '~helpers/resourceQueryKeys'

describe('resourceQueryKeys', () => {
  it('identifies Bible chapter content only from the domain request', () => {
    const request = {
      book: 1,
      chapter: 1,
      version: 'LSG',
      strongMode: 'visible' as const,
      interlinearLocale: 'fr' as const,
    }

    expect(resourceQueryKeys.bibleChapter(request)).toEqual([
      'resource',
      'bible-content',
      'chapter',
      request,
    ])
  })

  it('groups every Bible content query under one invalidation seam', () => {
    expect(resourceQueryKeys.bibleContent()).toEqual(['resource', 'bible-content'])
    expect(resourceQueryKeys.bibleVersion('LSG')).toEqual([
      'resource',
      'bible-content',
      'version',
      'LSG',
    ])
  })

  it('identifies offline database availability without exposing a storage path', () => {
    expect(resourceQueryKeys.offlineDatabaseAvailability('NAVE', 'en')).toEqual([
      'resource',
      'offline-database',
      'availability',
      'NAVE',
      'en',
    ])
  })
})
