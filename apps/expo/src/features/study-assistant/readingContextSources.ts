import { normalizeStrongRouteIdentity } from '~features/lexique/strongRouteIdentity'
import {
  parsePublicStrongCode,
  resolvePublicStrongContext,
} from '~features/lexique/publicStrongRoutes'
import {
  parseStrongDetailRouteParams,
  type StrongDetailRouteContext,
} from '~features/lexique/strongDetailRoutes'
import verseToReference from '~helpers/verseToReference'
import type { TabItem } from '~state/tabs'
import type { ReadingContext } from './conversations'
import {
  bibleContext,
  commentaryCollectionContext,
  commentaryContext,
  dictionaryContext,
  naveContext,
  wordContext,
} from './resourceContext'

type PublishedContexts = Record<string, { scope: string; path: string; context: ReadingContext }>

const fromWord = (data: StrongDetailRouteContext) => {
  let identity
  try {
    identity = normalizeStrongRouteIdentity(data)
  } catch {
    return null
  }
  return wordContext(
    data.clickedWord || data.strongReference?.Mot,
    identity?.code,
    data.bibleVersion,
    data.book && data.bibleChapter && data.bibleVerse
      ? verseToReference(`${data.book}-${data.bibleChapter}-${data.bibleVerse}`)
      : undefined
  )
}

/** The context of the active tab (reader) and of the route opened over it (panel). */
export function resolveReadingContexts({
  tab,
  pathname,
  params,
  registry,
}: {
  tab: TabItem | undefined
  pathname: string
  params: Parameters<typeof parseStrongDetailRouteParams>[0]
  registry: PublishedContexts
}): { reader: ReadingContext | null; panel: ReadingContext | null } {
  const entries = Object.values(registry)
  const publishedReader = entries.find(e => e.scope === `tab:${tab?.id}`)?.context
  const reader =
    publishedReader ||
    (tab?.type === 'strong'
      ? fromWord(tab.data)
      : tab?.type === 'bible'
        ? bibleContext(tab)
        : tab?.type === 'dictionary'
          ? dictionaryContext(tab.data)
          : tab?.type === 'nave'
            ? naveContext(tab.data)
            : tab?.type === 'commentary'
              ? commentaryCollectionContext(tab.data.verse)
              : tab?.type === 'commentary-resource'
                ? commentaryContext(tab.data)
                : null)
  const scalar = (value: unknown) => (typeof value === 'string' ? value : undefined)
  let panel = entries.find(e => e.scope === 'panel' && e.path === pathname)?.context || null
  if (!panel && pathname.startsWith('/strong')) {
    const { context } = parseStrongDetailRouteParams(params)
    // A public address (`/strong/h25`) carries the entry in its path, not in its parameters,
    // as the screen itself reads it (PublicStrongRouteScreen).
    const identity = parsePublicStrongCode(scalar(params.code))
    panel = fromWord(identity ? resolvePublicStrongContext(identity, context) : context)
  }
  if (!panel && ['/commentary-entry', '/commentary-chapter'].includes(pathname))
    panel = commentaryContext({
      projectionId: scalar(params.projectionId),
      book: scalar(params.book),
      chapter: scalar(params.chapter),
      sectionId: scalar(params.sectionId),
    })
  return { reader, panel }
}
