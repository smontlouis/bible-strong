import { produce } from 'immer'
import React, { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useAtom } from 'jotai/react'

import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'

import BibleViewer from './BibleViewer'

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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const deepmerge = require('@fastify/deepmerge')()

interface BibleTabScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  isFormSheet?: boolean
  isInTab?: boolean
  initialAnnotationId?: string
}

const BibleTabScreen = ({
  bibleAtom,
  isFormSheet,
  isInTab = true,
  initialAnnotationId,
}: BibleTabScreenProps) => {
  const [bible, setBible] = useAtom(bibleAtom)
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

  const settings = useMemo(
    () =>
      produce(rawSettings, draftState => {
        draftState.colors.default = deepmerge(defaultColors, draftState.colors.default || {})
        draftState.colors.dark = deepmerge(darkColors, draftState.colors.dark || {})
        draftState.colors.black = deepmerge(blackColors, draftState.colors.black || {})
        draftState.colors.sepia = deepmerge(sepiaColors, draftState.colors.sepia || {})
        draftState.colors.mauve = deepmerge(mauveColors, draftState.colors.mauve || {})
        draftState.colors.nature = deepmerge(natureColors, draftState.colors.nature || {})
        draftState.colors.night = deepmerge(nightColors, draftState.colors.night || {})
        draftState.colors.sunset = deepmerge(sunsetColors, draftState.colors.sunset || {})

        draftState.theme = currentTheme
        draftState.fontFamily = fontFamily
      }),
    [rawSettings, fontFamily, currentTheme]
  )

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

  if (!entityReference && resolvedResourceSelectionKey !== resourceSelectionKey) {
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
      <Box flex>
        <BiblePartialReferenceNotice verseKeys={missingVerseKeys} />
        {bibleContent}
      </Box>
    ) : (
      bibleContent
    )

  if (isFormSheet) {
    return (
      <BookSelectorSheetProvider>
        <LocalUnifiedTagsModalProvider>{content}</LocalUnifiedTagsModalProvider>
      </BookSelectorSheetProvider>
    )
  }

  return content
}

export default BibleTabScreen
