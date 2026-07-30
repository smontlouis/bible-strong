import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import type { Verse } from '~common/types'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import { historyAtom } from '~state/app'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
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
  isFormSheet?: boolean
  onBack?: () => void
  onTitleChange?: (title: string) => void
}

const StrongMainScreen = ({
  context,
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
    entryQuery,
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
  const historyDataUpdatedAtRef = useRef(0)
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const readingTypography = useStrongReadingTypography()
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const currentStrongBibleVersionId = resolveStrongBibleVersionId(
    activeContext,
    defaultStrongBibleVersionId
  )
  const concordanceSourceKey = `${navigationKey}:${currentStrongBibleVersionId}:${defaultStrongBibleVersionId}:${resourceLanguage}:${downloadCompletionSignal}`
  const [concordanceFallbackSource, setConcordanceFallbackSource] = useState<{
    key: string
    versionId?: StrongBibleVersionId
  }>({ key: concordanceSourceKey })
  const concordanceStrongBibleVersionId =
    concordanceFallbackSource.key === concordanceSourceKey && concordanceFallbackSource.versionId
      ? concordanceFallbackSource.versionId
      : currentStrongBibleVersionId
  const concordanceQuery = useQuery({
    queryKey: [
      'strong-detail',
      'concordance-preview',
      concordanceStrongBibleVersionId,
      defaultStrongBibleVersionId,
      resourceLanguage,
      downloadCompletionSignal,
      entry?.selectedIdentity,
      selectedLemmaId,
    ],
    queryFn: async () => {
      const request = {
        currentVersionId: concordanceStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.selectedIdentity.code,
        limit: 3,
        offset: 0,
        allBooks: true,
        lexemeId: selectedLemmaId,
      }
      const versesResult = await resources.lexiconBible.loadFoundVersesByBook(request)
      return {
        verses: versesResult.status === 'available' ? versesResult.verses : [],
        version:
          versesResult.status === 'available'
            ? versesResult.provenance.versionId
            : concordanceStrongBibleVersionId,
      }
    },
    enabled: Boolean(entry),
    networkMode: 'always',
    placeholderData: previousData => previousData,
  })
  const concordanceTotalQuery = useQuery({
    queryKey: [
      'strong-detail',
      'concordance-total',
      concordanceStrongBibleVersionId,
      defaultStrongBibleVersionId,
      resourceLanguage,
      downloadCompletionSignal,
      entry?.selectedIdentity,
    ],
    queryFn: () =>
      resources.lexiconBible.loadCountsByBook({
        currentVersionId: concordanceStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.selectedIdentity.code,
        allBooks: true,
      }),
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const lemmaStatsQuery = useQuery({
    queryKey: [
      'strong-detail',
      'lemma-stats',
      concordanceStrongBibleVersionId,
      defaultStrongBibleVersionId,
      resourceLanguage,
      downloadCompletionSignal,
      entry?.selectedIdentity,
    ],
    queryFn: () =>
      resources.lexiconBible.loadLemmaStats({
        currentVersionId: concordanceStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        preferredInterlinearLocale: resourceLanguage,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.selectedIdentity.code,
      }),
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const contextVerseQuery = useQuery({
    queryKey: [
      'strong-detail',
      'verse-context',
      currentStrongBibleVersionId,
      defaultStrongBibleVersionId,
      resourceLanguage,
      downloadCompletionSignal,
      activeContext.book,
      activeContext.bibleChapter,
      activeContext.bibleVerse,
    ],
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
  const resolvedConcordanceFallbackVersionId = [
    concordanceQuery.isPlaceholderData ? undefined : concordanceQuery.data?.version,
    concordanceTotalQuery.data?.status === 'available'
      ? concordanceTotalQuery.data.provenance.versionId
      : undefined,
    lemmaStatsQuery.data?.status === 'available'
      ? lemmaStatsQuery.data.provenance.versionId
      : undefined,
  ].find((versionId): versionId is StrongBibleVersionId =>
    Boolean(versionId && versionId !== 'BHG' && isStrongCapableBibleVersion(versionId))
  )
  useEffect(() => {
    if (
      currentStrongBibleVersionId === 'BHG' &&
      concordanceStrongBibleVersionId === 'BHG' &&
      resolvedConcordanceFallbackVersionId
    ) {
      setConcordanceFallbackSource({
        key: concordanceSourceKey,
        versionId: resolvedConcordanceFallbackVersionId,
      })
    }
  }, [
    concordanceSourceKey,
    concordanceStrongBibleVersionId,
    currentStrongBibleVersionId,
    resolvedConcordanceFallbackVersionId,
  ])
  useEffect(() => {
    if (!entry || historyDataUpdatedAtRef.current === entryQuery.dataUpdatedAt) return
    historyDataUpdatedAtRef.current = entryQuery.dataUpdatedAt
    addHistory({
      Hebreu: entry.language === 'hebrew' ? entry.original : '',
      Grec: entry.language === 'greek' ? entry.original : '',
      Mot: entry.gloss,
      book: entry.language === 'hebrew' ? 1 : 40,
      reference: entry.selectedIdentity.code,
      date: Date.now(),
      type: 'strong',
    })
  }, [addHistory, entry, entryQuery.dataUpdatedAt])

  useEffect(() => {
    if (entry) onTitleChange?.(`${entry.stepCode} · ${entry.gloss}`)
  }, [entry, onTitleChange])

  const openConcordanceVerse = (verse: Verse, version?: string) => {
    const resolvedVersion = version ?? concordanceQuery.data?.version
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
  const lemmaStats = lemmaStatsQuery.data?.status === 'available' ? lemmaStatsQuery.data.lemmas : []
  const concordanceTotalCount =
    concordanceTotalQuery.data?.status === 'available'
      ? concordanceTotalQuery.data.counts.reduce(
          (total, current) => total + Number(current.versesCountByBook),
          0
        )
      : 0
  const concordanceCount =
    selectedLemmaId == null
      ? concordanceTotalCount
      : (lemmaStats.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount ?? 0)
  return (
    <StrongEntryRouteScaffold
      context={activeContext}
      entryState={entryState}
      fontSize={19}
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
          contextVerse={contextVerse}
          contextReference={contextReference}
          contextVersion={
            contextVerseQuery.data?.status === 'available'
              ? contextVerseQuery.data.provenance.versionId
              : activeContext.bibleVersion
          }
          clickedWord={activeContext.clickedWord}
          contextMorphologies={contextMorphologiesQuery.data}
          resourcesAvailability={entry.modules.resources}
          entitiesAvailability={entry.modules.entities}
          concordanceCount={concordanceCount}
          concordanceTotalCount={concordanceTotalCount}
          concordanceVersion={concordanceQuery.data?.version ?? concordanceStrongBibleVersionId}
          concordanceVerses={concordanceQuery.data?.verses ?? []}
          concordanceLoading={concordanceQuery.isPending}
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
          onOpenEntityRelation={routeNavigation.openEntityRelation}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongMainScreen
