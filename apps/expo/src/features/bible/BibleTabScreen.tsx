import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { bibleContext } from '~features/study-assistant/resourceContext'
import { produce } from 'immer'
import React, { useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useAtom } from 'jotai/react'
import BibleViewer from './BibleViewer'
import { toBibleReaderSettings } from './bibleReaderSettings'
import { PrimitiveAtom } from 'jotai/vanilla'
import { RootState } from '~redux/modules/reducer'
import { BibleTab, VersionCode } from '../../state/tabs'
import { LocalUnifiedTagsModalProvider } from '~common/UnifiedTagsModalProvider'
import { BookSelectorSheetProvider } from './BookSelectorSheet/BookSelectorSheetProvider'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import Box from '~common/ui/Box'
import { useResolvedBibleVerses, verseStringToObject } from '~features/resources/useBibleVerses'
import {
  BiblePartialReferenceNotice,
  BibleReferenceUnavailable,
} from './BibleReferenceAvailability'
import { resolveBibleTabResources } from '~helpers/bibleTabResourceResolution'
import {
  BibleRouteNavigationProvider,
  type BibleRouteNavigationAdapter,
} from '~state/bibleRouteNavigation'

interface BibleTabScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  isFormSheet?: boolean
  isInTab?: boolean
  initialAnnotationId?: string
  routeNavigation?: BibleRouteNavigationAdapter
}

const BibleTabScreen = ({
  bibleAtom,
  isFormSheet,
  isInTab = true,
  initialAnnotationId,
  routeNavigation,
}: BibleTabScreenProps) => {
  const [bible, setBible] = useAtom(bibleAtom)
  useAssistantResourceContext(isInTab ? `tab:${bible.id}` : 'panel', bibleContext(bible))
  const selectedVersion = bible.data.selectedVersion
  const strongMode = bible.data.strongMode
  const interlinearMode = bible.data.interlinearMode
  const interlinearLocale = bible.data.interlinearLocale
  const parallelVersions = bible.data.parallelVersions
  const selectedBook = bible.data.selectedBook
  const selectedChapter = bible.data.selectedChapter
  const selectedVerse = bible.data.selectedVerse
  const resourceSelectionKey = `${selectedVersion}:${parallelVersions.join(',')}`
  const entityReference = bible.data.entityReference
  const entityVerseKeys = entityReference?.verseKeys || []
  const {
    version: resolvedEntityVersion,
    status: entityResolutionStatus,
    missingVerseKeys,
    isLoading: isResolvingEntity,
  } = useResolvedBibleVerses(
    verseStringToObject(entityVerseKeys),
    entityReference?.preferredVersion
  )

  const rawSettings = useSelector((state: RootState) => state.user.bible.settings)
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { theme: currentTheme } = useCurrentThemeSelector()

  const parallelVersionsKey = parallelVersions.join(',')
  const resourceResolutionQuery = useQuery({
    queryKey: [
      'bible-tab-resource-resolution',
      selectedVersion,
      strongMode,
      interlinearMode,
      interlinearLocale,
      parallelVersionsKey,
      selectedBook.Numero,
      selectedChapter,
      selectedVerse,
    ],
    queryFn: () =>
      resolveBibleTabResources({
        selectedVersion,
        strongMode,
        interlinearMode,
        interlinearLocale,
        parallelVersions,
        selectedBook,
        selectedChapter,
        selectedVerse,
      }),
    enabled: !entityReference,
    placeholderData: keepPreviousData,
  })
  const resolvedData = resourceResolutionQuery.data
  const resolvedResourceSelectionKey = resourceResolutionQuery.isError
    ? resourceSelectionKey
    : resolvedData
      ? `${resolvedData.selectedVersion}:${resolvedData.parallelVersions.join(',')}`
      : undefined

  useEffect(() => {
    if (entityReference || resourceResolutionQuery.isPlaceholderData || !resolvedData) return

    const selectionChanged =
      resolvedData.selectedVersion !== selectedVersion ||
      resolvedData.strongMode !== strongMode ||
      resolvedData.interlinearMode !== interlinearMode ||
      resolvedData.interlinearLocale !== interlinearLocale ||
      resolvedData.parallelVersions.join(',') !== parallelVersionsKey ||
      resolvedData.selectedBook.Numero !== selectedBook.Numero ||
      resolvedData.selectedChapter !== selectedChapter ||
      resolvedData.selectedVerse !== selectedVerse
    if (selectionChanged) {
      setBible(
        produce(draft => {
          if (
            draft.data.selectedVersion !== selectedVersion ||
            draft.data.parallelVersions.join(',') !== parallelVersionsKey
          ) {
            return
          }

          draft.data.selectedVersion = resolvedData.selectedVersion
          draft.data.strongMode = resolvedData.strongMode
          draft.data.interlinearMode = resolvedData.interlinearMode
          draft.data.interlinearLocale = resolvedData.interlinearLocale
          draft.data.parallelVersions = resolvedData.parallelVersions
          draft.data.selectedBook = resolvedData.selectedBook
          draft.data.selectedChapter = resolvedData.selectedChapter
          draft.data.selectedVerse = resolvedData.selectedVerse
          draft.data.temp = {
            selectedBook: resolvedData.selectedBook,
            selectedChapter: resolvedData.selectedChapter,
            selectedVerse: resolvedData.selectedVerse,
          }
        })
      )
    }
  }, [
    entityReference,
    interlinearLocale,
    interlinearMode,
    parallelVersionsKey,
    resolvedData,
    resourceResolutionQuery.isPlaceholderData,
    selectedBook.Numero,
    selectedChapter,
    selectedVerse,
    selectedVersion,
    setBible,
    strongMode,
  ])

  const settings = toBibleReaderSettings(rawSettings, currentTheme, fontFamily)

  useEffect(() => {
    if (!entityReference || !resolvedEntityVersion) return
    if (isResolvingEntity) return
    if (bible.data.selectedVersion === resolvedEntityVersion) return

    setBible(
      produce(draft => {
        draft.data.selectedVersion = resolvedEntityVersion as VersionCode
      })
    )
  }, [
    bible.data.selectedVersion,
    entityReference,
    isResolvingEntity,
    resolvedEntityVersion,
    setBible,
  ])

  if (
    entityReference &&
    (isResolvingEntity ||
      (resolvedEntityVersion && bible.data.selectedVersion !== resolvedEntityVersion))
  ) {
    return null
  }

  // Only the first resolution holds the reader back: a change of version keeps it on screen, so
  // that the page does not blank and the reader stays on the same verse.
  if (
    !entityReference &&
    !resourceResolutionQuery.isPlaceholderData &&
    resolvedResourceSelectionKey !== resourceSelectionKey
  ) {
    return null
  }

  if (entityReference && entityResolutionStatus === 'reference-only') {
    return <BibleReferenceUnavailable verseKeys={entityVerseKeys} />
  }

  const bibleContent = (
    <BibleViewer
      settings={settings}
      bibleAtom={bibleAtom}
      isFormSheet={isFormSheet}
      isInTab={isInTab}
      initialAnnotationId={initialAnnotationId}
    />
  )
  const content =
    entityReference && entityResolutionStatus === 'partial' ? (
      <Box className="overflow-hidden border-continuous flex-[1]">
        <BiblePartialReferenceNotice verseKeys={missingVerseKeys} />
        {bibleContent}
      </Box>
    ) : (
      bibleContent
    )

  const wrappedContent = isFormSheet ? (
    <BookSelectorSheetProvider>
      <LocalUnifiedTagsModalProvider>{content}</LocalUnifiedTagsModalProvider>
    </BookSelectorSheetProvider>
  ) : (
    content
  )

  return (
    <BibleRouteNavigationProvider adapter={routeNavigation}>
      {wrappedContent}
    </BibleRouteNavigationProvider>
  )
}

export default BibleTabScreen
