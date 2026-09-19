import { produce } from 'immer'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Book } from '~assets/bible_versions/books-desc'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'
import { useLocalSearchParams } from 'expo-router'
import { atom } from 'jotai/vanilla'
import {
  BibleContextDisplayMode,
  BibleTab,
  getDefaultBibleTab,
  VersionCode,
} from '../../state/tabs'
import { StudyNavigateBibleType } from '~common/types'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import BibleTabScreen from './BibleTabScreen'
import { IS_FORM_SHEET } from '~helpers/constants'
import {
  getBibleLocationVerseKeys,
  resolveBibleVerses,
  shouldShowBibleReferenceUnavailable,
} from '~helpers/bibleVerseResolver'
import Box from '~common/ui/Box'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import type { StrongMode } from '~helpers/strongBiblePublications'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { selectBibleReferenceVersion } from '~helpers/bibleReferenceVersion'
import {
  BiblePartialReferenceNotice,
  BibleReferenceUnavailable,
} from './BibleReferenceAvailability'
import type { BibleRouteNavigationAdapter } from '~state/bibleRouteNavigation'
export type BibleRouteInput = {
  focusVerses?: number[]
  isSelectionMode?: string
  contextDisplayMode?: BibleContextDisplayMode
  book?: Book | number
  chapter?: number
  verse?: number
  version: string
  strongMode?: StrongMode
  interlinearLocale?: ResourceLanguage
  annotationId?: string
}

type BibleScreenContentProps = BibleRouteInput

type BibleScreenContentRouteProps = BibleScreenContentProps & {
  routeNavigation?: BibleRouteNavigationAdapter
}

const BibleScreenContent = ({
  focusVerses,
  isSelectionMode,
  contextDisplayMode,
  book,
  chapter,
  verse,
  version,
  strongMode,
  interlinearLocale,
  annotationId,
  routeNavigation,
}: BibleScreenContentRouteProps) => {
  const initialValues = produce(getDefaultBibleTab(version as VersionCode), draft => {
    draft.id = `bible-${generateUUID()}`
    if (book)
      draft.data.selectedBook = Number.isInteger(book)
        ? getBook(book as number) || getBook(1)!
        : (book as Book)

    if (chapter) draft.data.selectedChapter = chapter
    if (verse !== undefined) draft.data.selectedVerse = verse
    if (focusVerses) draft.data.focusVerses = focusVerses
    if (isSelectionMode) draft.data.isSelectionMode = isSelectionMode as StudyNavigateBibleType
    if (contextDisplayMode) {
      draft.data.contextDisplayMode = contextDisplayMode
    }
    if (strongMode) draft.data.strongMode = strongMode
    if (interlinearLocale) draft.data.interlinearLocale = interlinearLocale
  })

  // Always create an on-the-fly atom for this screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bibleAtom = useMemo(() => atom<BibleTab>(initialValues), [])

  return (
    <BibleTabScreen
      bibleAtom={bibleAtom}
      isFormSheet={IS_FORM_SHEET}
      isInTab={false}
      initialAnnotationId={annotationId}
      routeNavigation={routeNavigation}
    />
  )
}

export const BibleRouteScreen = ({
  input,
  routeNavigation,
}: {
  input: BibleRouteInput
  routeNavigation?: BibleRouteNavigationAdapter
}) => {
  const {
    focusVerses,
    isSelectionMode,
    contextDisplayMode,
    book,
    chapter,
    verse,
    version: requestedVersion,
    strongMode,
    interlinearLocale,
    annotationId,
  } = input
  const defaultVersion = useDefaultBibleVersion()
  const resources = useResourceAccess()
  const bookNumber = typeof book === 'number' ? book : book?.Numero
  const requestedVerseKeys = getBibleLocationVerseKeys({
    book: bookNumber,
    chapter,
    verse,
    focusVerses,
  })
  const requestedVerseKeysSignature = requestedVerseKeys.join('|')
  const shouldResolveVersion = Boolean(bookNumber && chapter)
  const resolutionQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.bibleVerseSelection(
        requestedVersion || defaultVersion,
        requestedVerseKeys
      ),
      'screen-resolution',
      requestedVerseKeysSignature,
    ],
    queryFn: async () => {
      const referenceVersion = await selectBibleReferenceVersion(
        requestedVersion || defaultVersion,
        bookNumber ? [bookNumber] : [],
        resources.bibleContent
      )
      return resolveBibleVerses(
        {
          verseKeys: requestedVerseKeys,
          preferredVersion: referenceVersion,
          defaultVersion,
        },
        {
          loadVerseTexts: (version, verseKeys) =>
            resources.bibleContent.loadVerseTexts({ version, verseKeys }),
        }
      )
    },
    enabled: shouldResolveVersion,
    staleTime: Infinity,
  })
  const resolvedVersion = resolutionQuery.data?.version || requestedVersion || defaultVersion
  const resolutionStatus = shouldResolveVersion
    ? resolutionQuery.isError
      ? 'reference-only'
      : (resolutionQuery.data?.status ?? 'resolved')
    : 'resolved'
  const missingVerseKeys = resolutionQuery.isError
    ? requestedVerseKeys
    : (resolutionQuery.data?.missingVerseKeys ?? [])
  const isResolvingVersion = shouldResolveVersion && resolutionQuery.isPending
  const routeIdentity = JSON.stringify([
    resolvedVersion,
    bookNumber,
    chapter,
    verse,
    focusVerses,
    contextDisplayMode,
    strongMode,
    interlinearLocale,
    annotationId,
  ])

  if (isResolvingVersion) return null
  if (shouldShowBibleReferenceUnavailable(resolutionStatus)) {
    return <BibleReferenceUnavailable verseKeys={requestedVerseKeys} />
  }

  const content = (
    <BibleScreenContent
      key={routeIdentity}
      focusVerses={focusVerses}
      isSelectionMode={isSelectionMode}
      contextDisplayMode={contextDisplayMode}
      book={book}
      chapter={chapter}
      verse={verse}
      version={resolvedVersion}
      strongMode={strongMode}
      interlinearLocale={interlinearLocale}
      annotationId={annotationId}
      routeNavigation={routeNavigation}
    />
  )

  if (resolutionStatus === 'partial') {
    return (
      <Box className="overflow-hidden border-continuous flex-[1]">
        <BiblePartialReferenceNotice verseKeys={missingVerseKeys} />
        {content}
      </Box>
    )
  }

  return content
}

const parseJson = <T,>(value: string | undefined): T | undefined => {
  if (!value) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

const BibleScreen = () => {
  const params = useLocalSearchParams<{
    focusVerses?: string
    contextDisplayMode?: BibleContextDisplayMode
    isSelectionMode?: string
    isReadOnly?: string
    book?: string
    chapter?: string
    verse?: string
    version?: string
    strongMode?: StrongMode
    annotationId?: string
  }>()

  // Parse params from URL strings
  const focusVerses = parseJson<number[]>(params.focusVerses)
  const isSelectionMode = params.isSelectionMode || undefined
  const contextDisplayMode =
    params.contextDisplayMode || (params.isReadOnly === 'true' ? 'focused' : undefined)
  const book = parseJson<Book | number>(params.book)
  const chapter = params.chapter ? Number(params.chapter) : undefined
  const verse = params.verse ? Number(params.verse) : undefined
  const requestedVersion = params.version || undefined
  const strongMode = params.strongMode
  const annotationId = params.annotationId

  return (
    <BibleRouteScreen
      input={{
        focusVerses,
        isSelectionMode,
        contextDisplayMode,
        book,
        chapter,
        verse,
        version: requestedVersion || '',
        strongMode,
        annotationId,
      }}
    />
  )
}

export default BibleScreen
