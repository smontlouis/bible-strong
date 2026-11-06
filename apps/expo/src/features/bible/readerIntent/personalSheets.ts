import { createVerseEndpoint } from '~features/studyRelations/domain'
import { getEntityRelationsRoute } from '~features/studyRelations/routeParams'
import { getWordAnnotationText } from '~redux/modules/user/wordAnnotationRanges'
import type { PersonalSheetIntent, ReaderRule } from './types'
import type { Reader, ReaderSnapshot, ReaderWorld } from './world'

type PersonalSheetContext = { reader: Reader; snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const decodeVerseIds = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter(isText) : undefined

export const decodePersonalSheetIntent = (value: unknown): PersonalSheetIntent | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'open-highlight-tags': {
      const verseIds = decodeVerseIds(value.verseIds)
      return verseIds ? { kind: value.kind, verseIds } : undefined
    }
    case 'open-annotation-tags':
      return isText(value.annotationId)
        ? { kind: value.kind, annotationId: value.annotationId }
        : undefined
    case 'open-bookmark':
      return isText(value.bookmarkId)
        ? { kind: value.kind, bookmarkId: value.bookmarkId }
        : undefined
    case 'open-verse-tags':
    case 'open-cross-version-annotations':
    case 'open-verse-relations':
      return isText(value.verseKey) ? { kind: value.kind, verseKey: value.verseKey } : undefined
    default:
      return undefined
  }
}

const findBookmark = ({ bookmarks }: ReaderSnapshot, bookmarkId: string) =>
  Object.values(bookmarks).find(bookmark => bookmark.id === bookmarkId)

/** The version an intent names, when it names one. */
const getNamedVersion = (intent: PersonalSheetIntent, snapshot: ReaderSnapshot) =>
  intent.kind === 'open-bookmark' ? findBookmark(snapshot, intent.bookmarkId)?.version : undefined

/**
 * Every sheet of this family shows personal Bible data (ADR-0030): none opens while the reader
 * hides it, and none for a version shown only in interlinear presentations.
 */
export const getPersonalSheetRefusal = (
  intent: PersonalSheetIntent,
  { snapshot }: Pick<PersonalSheetContext, 'snapshot'>
): ReaderRule | undefined => {
  if (snapshot.hidesPersonalData) return 'personal-data'
  const version = getNamedVersion(intent, snapshot)
  if (version && snapshot.interlinearReadingVersions.includes(version)) {
    return 'interlinear-column'
  }
  return undefined
}

export const applyPersonalSheetIntent = (
  intent: PersonalSheetIntent,
  { reader, snapshot, world }: PersonalSheetContext
) => {
  switch (intent.kind) {
    case 'open-highlight-tags':
      world.openTags({
        mode: 'select',
        entity: 'highlights',
        ids: Object.fromEntries(intent.verseIds.map(verseId => [verseId, true as const])),
      })
      return
    case 'open-annotation-tags': {
      const shown = snapshot.wordAnnotations[intent.annotationId]
      if (!shown) return
      // The page's copy carries no words: the sheet is named after the stored annotation
      const stored = world.getState().user.bible.wordAnnotations[intent.annotationId]
      world.openTags({
        mode: 'select',
        id: intent.annotationId,
        entity: 'wordAnnotations',
        title: getWordAnnotationText(stored ?? shown),
      })
      return
    }
    case 'open-verse-tags':
      reader.surface({ kind: 'verse-tags', verseKey: intent.verseKey })
      return
    case 'open-bookmark': {
      const bookmark = findBookmark(snapshot, intent.bookmarkId)
      if (bookmark) reader.surface({ kind: 'bookmark', bookmark })
      return
    }
    case 'open-cross-version-annotations': {
      const versions = snapshot.wordAnnotationsInOtherVersions[intent.verseKey]
      if (versions?.length) {
        reader.surface({ kind: 'cross-version-annotations', verseKey: intent.verseKey, versions })
      }
      return
    }
    case 'open-verse-relations': {
      // The Relations of the verse in the main version, whatever column it was touched in
      const { selectedVersion } = world.store.get(snapshot.tabAtom).data
      world.navigate(
        getEntityRelationsRoute(createVerseEndpoint([intent.verseKey], undefined, selectedVersion))
      )
      return
    }
  }
}
