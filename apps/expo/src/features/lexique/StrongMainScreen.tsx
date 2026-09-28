import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import type { Verse } from '~common/types'
import { getPassageMediaForStrong } from '~features/bible/passageMedia'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import { historyAtom } from '~state/app'
import { resolveStrongBibleVersionId } from './resolveStrongBibleVersionId'
import StrongDetailMainPage from './StrongDetailMainPage'
import StrongEntryRouteScaffold from './StrongEntryRouteScaffold'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { createStrongDetailRoute } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import { useStrongReadingTypography } from './useStrongReadingTypography'
import { useStrongRouteNavigation } from './useStrongRouteNavigation'

interface StrongMainScreenProps {
  context: StrongDetailRouteContext
  hasBackButton?: boolean
  isFormSheet?: boolean
  onBack?: () => void
  onTitleChange?: (title: string) => void
}

const StrongMainScreen = ({
  context,
  hasBackButton,
  isFormSheet = false,
  onBack,
  onTitleChange,
}: StrongMainScreenProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const activeContext = context
  const entryState = useStrongEntryRoute(activeContext)
  const {
    resources,
    identity,
    coreAvailability,
    entry,
    languageState: { language: resourceLanguage },
  } = entryState
  const navigationKey = identity ? `${identity.kind}:${identity.code}` : 'unknown'
  const [lemmaSelection, setLemmaSelection] = useState<{
    navigationKey: string
    lemmaId?: number
  }>({ navigationKey })
  const selectedLemmaId =
    lemmaSelection.navigationKey === navigationKey ? lemmaSelection.lemmaId : undefined
  const routeNavigation = useStrongRouteNavigation(activeContext)
  const addHistory = useSetAtom(historyAtom)
  const { t } = useTranslation()
  const recordedHistoryReferenceRef = useRef<string | undefined>(undefined)
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const readingTypography = useStrongReadingTypography()
  const currentStrongBibleVersionId = resolveStrongBibleVersionId(
    activeContext,
    defaultStrongBibleVersionId
  )
  const concordanceRequest = {
    currentVersionId: currentStrongBibleVersionId,
    defaultVersionId: defaultStrongBibleVersionId,
    preferredInterlinearLocale: resourceLanguage,
    book: entry?.language === 'hebrew' ? 1 : 40,
    reference: entry?.stepCode,
  }
  const concordanceQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleConcordancePreview({
      ...concordanceRequest,
      lexemeId: selectedLemmaId,
    }),
    queryFn: async () => {
      const request = {
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.stepCode,
        limit: 3,
        allBooks: true,
        lexemeId: selectedLemmaId,
      }
      return resources.lexiconBible.loadFoundVersesByBook(request)
    },
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const concordanceTotalQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleCounts(concordanceRequest),
    queryFn: () =>
      resources.lexiconBible.loadCountsByBook({
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.stepCode,
        allBooks: true,
      }),
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const lemmaStatsQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleLemmaStats(concordanceRequest),
    queryFn: () =>
      resources.lexiconBible.loadLemmaStats({
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.stepCode,
      }),
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const contextVerseQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleVerse({
      currentVersionId: currentStrongBibleVersionId,
      defaultVersionId: defaultStrongBibleVersionId,
      preferredInterlinearLocale: resourceLanguage,
      book: activeContext.book,
      chapter: activeContext.bibleChapter,
      verse: activeContext.bibleVerse,
    }),
    queryFn: () =>
      resources.lexiconBible.loadVerse({
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: activeContext.book!,
        chapter: activeContext.bibleChapter!,
        verse: activeContext.bibleVerse!,
      }),
    enabled: Boolean(
      activeContext.bibleVersion &&
      activeContext.book &&
      activeContext.bibleChapter &&
      activeContext.bibleVerse
    ),
    networkMode: 'always',
  })
  const contextMorphologiesQuery = useQuery({
    queryKey: [
      'strong-detail',
      'context-morphologies',
      resourceLanguage,
      activeContext.morphologyCodes,
    ],
    queryFn: () =>
      resources.strongLexicon.loadMorphologies(
        activeContext.morphologyCodes ?? [],
        resourceLanguage
      ),
    enabled: Boolean(
      activeContext.morphologyCodes?.length && coreAvailability.data?.status === 'available'
    ),
    networkMode: 'always',
  })
  useEffect(() => {
    if (!entry || recordedHistoryReferenceRef.current === entry.stepCode) return
    recordedHistoryReferenceRef.current = entry.stepCode
    addHistory({
      Hebreu: entry.language === 'hebrew' ? entry.original : '',
      Grec: entry.language === 'greek' ? entry.original : '',
      Mot: entry.gloss,
      book: entry.language === 'hebrew' ? 1 : 40,
      reference: entry.stepCode,
      date: Date.now(),
      type: 'strong',
    })
  }, [addHistory, entry])

  useEffect(() => {
    if (entry) onTitleChange?.(`${entry.stepCode} · ${entry.gloss}`)
  }, [entry, onTitleChange])

  const openConcordanceVerse = (verse: Verse, version?: string) => {
    const resolvedVersion = version ?? concordanceVersion
    routeNavigation.openConcordanceVerse(verse, resolvedVersion)
  }

  const contextVerse =
    contextVerseQuery.data?.status === 'available' ? contextVerseQuery.data.verse : undefined
  const contextReference =
    activeContext.book && activeContext.bibleChapter && activeContext.bibleVerse
      ? verseToReference({
          bookNum: activeContext.book,
          chapterNum: activeContext.bibleChapter,
          verses: [activeContext.bibleVerse],
        })
      : undefined
  const countsResult = concordanceTotalQuery.data
  const previewResult = concordanceQuery.data
  const availableCounts =
    countsResult?.status === 'available'
      ? { counts: countsResult.counts, provenance: countsResult.provenance }
      : undefined
  const availablePreview =
    previewResult?.status === 'available'
      ? { verses: previewResult.verses, provenance: previewResult.provenance }
      : undefined
  const concordanceVersion =
    availableCounts?.provenance.versionId ??
    availablePreview?.provenance.versionId ??
    currentStrongBibleVersionId
  const previewMatchesVersion = availablePreview?.provenance.versionId === concordanceVersion
  const concordanceError = Boolean(
    concordanceQuery.isError ||
    concordanceTotalQuery.isError ||
    (concordanceQuery.data && !availablePreview) ||
    (concordanceTotalQuery.data && !availableCounts) ||
    (availablePreview && !previewMatchesVersion)
  )
  const concordanceLoading = concordanceQuery.isPending || concordanceTotalQuery.isPending
  const retryConcordance = () => {
    void concordanceQuery.refetch()
    void concordanceTotalQuery.refetch()
    void lemmaStatsQuery.refetch()
  }
  const lemmaStats =
    lemmaStatsQuery.data?.status === 'available' &&
    lemmaStatsQuery.data.provenance.versionId === concordanceVersion
      ? lemmaStatsQuery.data.lemmas
      : []
  const concordanceTotalCount = availableCounts?.counts.reduce(
    (total, current) => total + Number(current.versesCountByBook),
    0
  )
  const concordanceCount =
    selectedLemmaId == null
      ? concordanceTotalCount
      : lemmaStats.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount
  const passageMedia = entry
    ? getPassageMediaForStrong({ strongCode: entry.stepCode, language: resourceLanguage })
    : []
  return (
    <StrongEntryRouteScaffold
      context={activeContext}
      entryState={entryState}
      hasBackButton={hasBackButton}
      isFormSheet={isFormSheet}
      onBack={onBack}
      showEntryMenu
      subTitle={
        entry
          ? `${t(entry.language === 'greek' ? 'Grec' : 'Hébreu')} · ${entry.stepCode}`
          : undefined
      }
      title={t('strongDetail.title')}
    >
      {entry && (
        <StrongDetailMainPage
          entry={entry}
          passageMedia={passageMedia}
          contextVerse={contextVerse}
          contextReference={contextReference}
          contextVersion={
            contextVerseQuery.data?.status === 'available'
              ? contextVerseQuery.data.provenance.versionId
              : activeContext.bibleVersion
          }
          clickedWord={activeContext.clickedWord}
          contextMorphologies={contextMorphologiesQuery.data}
          concordanceCount={concordanceCount}
          concordanceTotalCount={concordanceTotalCount}
          concordanceVersion={concordanceVersion}
          concordanceVerses={previewMatchesVersion ? (availablePreview?.verses ?? []) : []}
          concordanceLoading={concordanceLoading}
          concordanceError={concordanceError}
          concordanceRetrying={concordanceQuery.isFetching || concordanceTotalQuery.isFetching}
          onRetryConcordance={retryConcordance}
          lemmaStats={lemmaStats}
          selectedLemmaId={selectedLemmaId}
          readingTypography={readingTypography}
          onSelectLemma={lemmaId => setLemmaSelection({ navigationKey, lemmaId })}
          onOpenPage={page =>
            pushRouteOnce(
              createStrongDetailRoute(page, activeContext, {
                entityKey: page === 'entity' ? entry.entity?.uniqueName : undefined,
              })
            )
          }
          onOpenStrong={routeNavigation.openStrong}
          onOpenBibleReference={routeNavigation.openBibleReference}
          onOpenConcordanceVerse={openConcordanceVerse}
          onOpenEntityProfile={routeNavigation.openEntity}
          onOpenEntityRelation={routeNavigation.openEntityRelation}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongMainScreen
