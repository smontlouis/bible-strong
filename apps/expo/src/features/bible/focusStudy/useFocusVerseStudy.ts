import {
  crossReferenceVerses,
  MAIN_BIBLE_VERSIONS,
  VERSE_STUDY_LIMITS,
  verseDictionaryEntries,
  verseKey as toVerseKey,
} from '@bible-strong/resource-domain/verse-study'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { useSelector } from 'react-redux'
import {
  getDefaultCommentarySelection,
  parseCommentaryProjectionId,
} from '~features/commentaries/commentarySelection'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'
import { versions as bibleVersions } from '~helpers/bibleVersions'
import getVersesContent from '~helpers/getVersesContent'
import { localQueryOptions, staticResourceQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { getStrongBibleFallbackPriority } from '~helpers/strongBiblePublications'
import useConnection from '~helpers/useConnection'
import verseToReference from '~helpers/verseToReference'
import { getLanguage } from '~i18n'
import { selectCompareVersions } from '~redux/selectors/user'
import type { RootState } from '~redux/modules/reducer'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { VersionCode } from '~state/tabs'
import { getStrongWordOccurrences } from '../strongResourceCardContext'
import type { FocusVerseStudy } from './focusVerseStudyTypes'

const limits = VERSE_STUDY_LIMITS.focus
// The original Bible is read beside the verse, as the verse page quotes it (ADR-0088).
const ORIGINAL_VERSION_ID = 'BHG'

const versionName = (versionId: string) => {
  const version = bibleVersions[versionId]
  if (!version) return versionId
  const name = getLanguage() === 'en' ? (version.name_en ?? version.name) : version.name
  return `${name} (${versionId})`
}

/**
 * Everything the reader shows under the studied verse of a focus: each section is read through
 * the resource access of its study card, offline copy first, and keeps that card's query key
 * when they read the same thing, so the card opens on what is already loaded.
 */
export const useFocusVerseStudy = ({
  enabled,
  verseKey,
  studyVerses,
  version,
}: {
  enabled: boolean
  verseKey: string
  studyVerses: number[]
  version: VersionCode
}): FocusVerseStudy | undefined => {
  const resources = useResourceAccess()
  const queryClient = useQueryClient()
  const isConnected = useConnection()
  const languages = useAtomValue(resourcesLanguageAtom)
  const compareVersions = useSelector(selectCompareVersions)
  const defaultStrongVersion = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const selectedCommentaries = useSelector(
    (state: RootState) => state.user.bible.settings.commentarySelection
  )
  const [book, chapter, verse] = verseKey.split('-').map(Number)
  const self = { book, chapter, verse }
  const loadTexts = (versionId: string, verseKeys: string[]) =>
    loadBibleVerseTexts(resources, versionId, verseKeys)

  // The versions the reader compares in; without any, the best-known ones of the language.
  const isOtherVersion = (versionId: string) =>
    versionId !== version && versionId !== ORIGINAL_VERSION_ID
  const comparedVersions = compareVersions.filter(isOtherVersion)
  const otherVersions = (
    comparedVersions.length
      ? comparedVersions
      : MAIN_BIBLE_VERSIONS[getLanguage() === 'en' ? 'en' : 'fr'].filter(isOtherVersion)
  ).slice(0, limits.otherVersions)
  const versionQueries = useQueries({
    queries: otherVersions.map((versionId, position) => ({
      queryKey: resourceQueryKeys.bibleVerseSelection(versionId, [verseKey]),
      queryFn: () =>
        getVersesContent({
          verses: { [verseKey]: true },
          version: versionId,
          position,
          loadVerseTexts: loadTexts,
        }),
      enabled,
      networkMode: 'always' as const,
      staleTime: Infinity,
    })),
  })
  const originalQuery = useQuery({
    queryKey: [...resourceQueryKeys.bibleVerseSelection(ORIGINAL_VERSION_ID, [verseKey]), 'text'],
    queryFn: async () => (await loadTexts(ORIGINAL_VERSION_ID, [verseKey]))[verseKey] ?? '',
    enabled,
    retry: false,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })

  const strongLanguage = languages.STRONG
  const lexiconRequest = {
    currentVersionId: version,
    defaultVersionId: defaultStrongVersion,
    preferredInterlinearLocale: strongLanguage,
    fallbackVersionIds: getStrongBibleFallbackPriority(version),
    book,
    chapter,
    verse,
  }
  const wordsQuery = useQuery({
    queryKey: ['focus-study', 'words', verseKey, version, defaultStrongVersion, strongLanguage],
    queryFn: async () => {
      const result = await resources.lexiconBible.loadVerseBase(lexiconRequest)
      if (result.status !== 'available') return { words: [], count: 0 }
      const occurrences = getStrongWordOccurrences(result.verse)
      const identities = [
        ...new Map(
          occurrences.map(occurrence => [
            `${occurrence.identity.kind}:${occurrence.identity.code}`,
            occurrence.identity,
          ])
        ).values(),
      ]
      const shown = identities.slice(0, limits.words)
      const cards = shown.length
        ? await resources.strongLexicon.loadEntryCards(shown, strongLanguage)
        : []
      const words = shown.flatMap(identity => {
        const card = cards.find(
          candidate =>
            candidate.selectedIdentity.kind === identity.kind &&
            candidate.selectedIdentity.code === identity.code
        )
        if (!card?.original) return []
        const occurrence = occurrences.find(
          candidate =>
            candidate.identity.kind === identity.kind && candidate.identity.code === identity.code
        )
        return [
          {
            word: occurrence?.clickedWord,
            original: card.original,
            transliteration: card.transliteration ?? undefined,
            gloss: card.gloss ?? undefined,
            // Shown as the verse page shows it: G846, not G0846.
            label: (card.classicStrong ?? card.stepCode).replace(/^([GH])0+(?=\d)/u, '$1'),
            identityKind: identity.kind,
            identityCode: identity.code,
          },
        ]
      })
      return { words, count: identities.length }
    },
    enabled,
    retry: false,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })

  const referencesQuery = useQuery({
    queryKey: resourceQueryKeys.bibleReferences(verseKey),
    queryFn: () => resources.bibleReading.loadTresorReferences(verseKey),
    enabled,
    retry: false,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const referenceVerses = crossReferenceVerses(referencesQuery.data ?? [], self)
  const shownReferences = referenceVerses.slice(0, limits.crossReferences).map(toVerseKey)
  // The passages are read in one request; each also fills the cache of the references card.
  const referenceTextsQuery = useQuery({
    queryKey: ['focus-study', 'reference-texts', version, shownReferences.join(',')],
    queryFn: async () => {
      const texts = await loadTexts(version, shownReferences)
      const contents = await Promise.all(
        shownReferences.map(async reference => {
          if (!texts[reference]) return [reference, ''] as const
          const content = await getVersesContent({
            verses: reference,
            version,
            loadVerseTexts: async () => ({ [reference]: texts[reference] }),
          })
          queryClient.setQueryData(
            resourceQueryKeys.bibleVerseSelection(version, [reference]),
            content
          )
          return [reference, content.content] as const
        })
      )
      return Object.fromEntries(contents)
    },
    enabled: enabled && shownReferences.length > 0,
    networkMode: 'always',
    retry: false,
    staleTime: Infinity,
  })

  const commentarySelection = selectedCommentaries.length
    ? selectedCommentaries
    : getDefaultCommentarySelection()
  const commentaryResources = commentarySelection.flatMap(projectionId => {
    const projection = parseCommentaryProjectionId(projectionId)
    return projection ? [{ resourceId: projection.resourceId, language: projection.language }] : []
  })
  // One small read of the excerpts on this verse, not the whole chapter of every commentary.
  const commentariesQuery = useQuery({
    queryKey: ['focus-study', 'commentaries', verseKey, commentarySelection.join(',')],
    queryFn: async () =>
      (await resources.commentary.loadVerseExcerpts?.({
        verseKey,
        resources: commentaryResources,
      })) ?? [],
    enabled: enabled && commentaryResources.length > 0,
    networkMode: 'always',
    retry: false,
    ...staticResourceQueryOptions,
  })
  const commented = commentariesQuery.data

  const naveQuery = useQuery({
    queryKey: ['nave', verseKey, languages.NAVE, isConnected],
    queryFn: () => resources.nave.loadByVerse(verseKey, languages.NAVE),
    enabled,
    retry: false,
    ...staticResourceQueryOptions,
  })

  const dictionaryQuery = useQuery({
    queryKey: ['dictionary-passage-entries', verseKey, languages.DICTIONNAIRE],
    queryFn: () => resources.dictionary.discoverPassageEntries(verseKey, languages.DICTIONNAIRE),
    enabled,
    retry: false,
    ...localQueryOptions,
    ...staticResourceQueryOptions,
  })

  if (!enabled) return undefined
  // A section that failed shows nothing, like one without content.
  const failedOrEmpty = <T>(query: { isError: boolean }, value: T[] | undefined) =>
    query.isError ? [] : value

  const versionsReady = versionQueries.every(query => !query.isPending)
  const referencesReady =
    !referencesQuery.isPending && (shownReferences.length === 0 || !referenceTextsQuery.isPending)

  return {
    verseKey,
    studyVerses,
    versionsCompared: comparedVersions.length > 0,
    versions: versionsReady
      ? versionQueries.flatMap((query, index) =>
          query.data?.content
            ? [
                {
                  versionId: otherVersions[index],
                  name: versionName(otherVersions[index]),
                  text: query.data.content,
                },
              ]
            : []
        )
      : undefined,
    original: originalQuery.data || undefined,
    words: failedOrEmpty(wordsQuery, wordsQuery.data?.words),
    wordCount: wordsQuery.data?.count ?? 0,
    references: referencesQuery.isError
      ? []
      : referencesReady
        ? shownReferences.flatMap(reference => {
            const text = referenceTextsQuery.data?.[reference]
            return text ? [{ verseKey: reference, title: verseToReference([reference]), text }] : []
          })
        : undefined,
    referenceCount: referenceVerses.length,
    commentaries: commentariesQuery.isError
      ? []
      : commentaryResources.length === 0
        ? []
        : commented?.slice(0, limits.commentaries).map(excerpt => ({
            title: excerpt.title,
            verses:
              excerpt.rangeStartVerse === excerpt.rangeEndVerse
                ? `v. ${excerpt.rangeStartVerse}`
                : `v. ${excerpt.rangeStartVerse}-${excerpt.rangeEndVerse}`,
            text: excerpt.preview,
          })),
    commentaryCount: commented?.length ?? 0,
    topics: naveQuery.isError
      ? []
      : naveQuery.data &&
        (naveQuery.data[0] ?? []).map(topic => ({
          name: topic.name,
          nameLower: topic.normalizedName,
        })),
    dictionary: dictionaryQuery.isError
      ? []
      : dictionaryQuery.data &&
        verseDictionaryEntries(dictionaryQuery.data, limits.dictionaryWords).map(entry => ({
          word: entry.word,
          entryId: entry.id,
          work: entry.resource.work,
          resourceId: entry.resourceId,
          title: entry.title,
          language: entry.resource.language,
          correspondenceId: entry.correspondenceId,
        })),
  }
}
