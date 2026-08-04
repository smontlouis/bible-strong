import type { BibleChapterRequest } from './bibleContentAccess'
import type { ResourceAccessRegistry } from './resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'

export const bibleChapterQueryOptions = (
  request: BibleChapterRequest,
  resources: Pick<ResourceAccessRegistry, 'bibleContent'>
) => ({
  queryKey: resourceQueryKeys.bibleChapter(request),
  queryFn: () => resources.bibleContent.loadChapter(request),
  networkMode: 'always' as const,
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
