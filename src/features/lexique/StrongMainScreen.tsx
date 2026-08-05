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
      const versesResult = await resources.lexiconBible.loadFoundVersesByBook(request)
      return {
        verses: versesResult.status === 'available' ? versesResult.verses : [],
        version:
          versesResult.status === 'available'
            ? versesResult.provenance.versionId
            : currentStrongBibleVersionId,
      }
    },
    enabled: Boolean(entry),
    networkMode: 'always',
    placeholderData: previousData => previousData,
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
    if (!entry || historyDataUpdatedAtRef.current === entryQuery.dataUpdatedAt) return
    historyDataUpdatedAtRef.current = entryQuery.dataUpdatedAt
    addHistory({
      Hebreu: entry.language === 'hebrew' ? entry.original : '',
      Grec: entry.language === 'greek' ? entry.original : '',
      Mot: entry.gloss,
      book: entry.language === 'hebrew' ? 1 : 40,
      reference: entry.stepCode,
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
  const concordanceVersion = concordanceQuery.data?.version
  const lemmaStats =
    lemmaStatsQuery.data?.status === 'available' &&
    lemmaStatsQuery.data.provenance.versionId === concordanceVersion
      ? lemmaStatsQuery.data.lemmas
      : []
  const concordanceTotalCount =
    concordanceTotalQuery.data?.status === 'available' &&
    concordanceTotalQuery.data.provenance.versionId === concordanceVersion
      ? concordanceTotalQuery.data.counts.reduce(
          (total, current) => total + Number(current.versesCountByBook),
          0
        )
      : 0
  const concordanceCount =
    selectedLemmaId == null
      ? concordanceTotalCount
      : (lemmaStats.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount ?? 0)
  const passageMedia = entry
    ? getPassageMediaForStrong({ strongCode: entry.stepCode, language: resourceLanguage })
    : []
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
          resourcesAvailability={entry.modules.resources}
          entitiesAvailability={entry.modules.entities}
          concordanceCount={concordanceCount}
          concordanceTotalCount={concordanceTotalCount}
          concordanceVersion={concordanceQuery.data?.version ?? currentStrongBibleVersionId}
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
          onOpenEntityProfile={routeNavigation.openEntity}
          onOpenEntityRelation={routeNavigation.openEntityRelation}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongMainScreen
