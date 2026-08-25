import type { BibleChapterRequest } from './bibleContentAccess'
import type { ResourceAccessRegistry } from './resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { BibleLoadingError } from '~helpers/bibleErrors'

export const retryResourceQuery = (failureCount: number, error: unknown) =>
  error instanceof BibleLoadingError &&
  error.type === 'RESOURCE_TEMPORARY_UNAVAILABLE' &&
  failureCount < 2

export const bibleChapterQueryOptions = (
  request: BibleChapterRequest,
  resources: Pick<ResourceAccessRegistry, 'bibleContent'>
) => ({
  queryKey: resourceQueryKeys.bibleChapter(request),
  queryFn: async () => {
    const result = await resources.bibleContent.loadChapter(request)
    if (!result.success && result.error.type === 'RESOURCE_TEMPORARY_UNAVAILABLE') {
      throw new BibleLoadingError(
        result.error.type,
        result.error.version,
        result.error.book,
        result.error.chapter
      )
    }
    return result
  },
  networkMode: 'always' as const,
  retry: retryResourceQuery,
  staleTime: Infinity,
})

export const loadBibleVerseTexts = async (
  resources: Pick<ResourceAccessRegistry, 'bibleContent'>,
  version: string,
  verseKeys: string[],
  shouldCancel?: () => boolean
): Promise<Record<string, string>> => {
  return resources.bibleContent.loadVerseTexts({ version, verseKeys, shouldCancel })
}
