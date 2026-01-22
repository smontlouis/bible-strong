import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView } from 'react-native'

import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import FilterModal from '~common/FilterModal'
import ColorFilterModal from '~common/ColorFilterModal'
import TagsFilterModal from '~common/TagsFilterModal'
import Container from '~common/ui/Container'
import Modal from '~common/Modal'
import { useHighlightFilters } from '~helpers/useHighlightFilters'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import type { RootState } from '~redux/modules/reducer'
import { selectHighlightsObj } from '~redux/selectors/user'
import { makeAllWordAnnotationsSelector, type GroupedWordAnnotation } from '~redux/selectors/bible'
import {
  changeHighlightColor,
  type Highlight,
  type HighlightsObj,
  removeHighlight,
} from '~redux/modules/user'
import {
  removeWordAnnotationAction,
  changeWordAnnotationColor,
} from '~redux/modules/user/wordAnnotations'
import { multipleTagsModalAtom, colorChangeModalAtom } from '../../state/app'
import VerseComponent from './Verse'
import AnnotationItem from './AnnotationItem'
import type { TagsObj, Verse, VerseIds } from '~common/types'

export type GroupedHighlightData = {
  date: number
  color: string
  highlightsObj: Verse[]
  stringIds: VerseIds
  tags: TagsObj
}

export type GroupedHighlights = GroupedHighlightData[]

type UnifiedHighlightItem =
  | { type: 'highlight'; data: GroupedHighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }

const filterByTag =
  (tagId: string, highlightsObj: HighlightsObj) =>
  ([vId]: [string, Highlight]) =>
    Boolean(highlightsObj[vId].tags && highlightsObj[vId].tags[tagId])

const groupHighlightsByDate = (arr: GroupedHighlights, highlightTuple: [string, Highlight]) => {
  const [highlightId, highlight] = highlightTuple
  const [Livre, Chapitre, Verset] = highlightId.split('-').map(Number)
  const formattedVerse = { Livre, Chapitre, Verset, Texte: '' }

  if (!arr.find(a => a.date === highlight.date)) {
    arr.push({
      date: highlight.date,
      color: highlight.color,
      highlightsObj: [],
      stringIds: {},
      tags: {},
    })
  }

  const dateInArray = arr.find(a => a.date === highlight.date)
  if (dateInArray) {
    dateInArray.stringIds[highlightId] = true
    dateInArray.highlightsObj.push(formattedVerse)
    dateInArray.highlightsObj.sort((a, b) => Number(a.Verset) - Number(b.Verset))
    dateInArray.tags = { ...dateInArray.tags, ...highlight.tags }
  }

  arr.sort((a, b) => Number(b.date) - Number(a.date))
  return arr
}

const HighlightsScreen = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const highlightsObj = useSelector(selectHighlightsObj)
  const [, setMultipleTagsItem] = useAtom(multipleTagsModalAtom)
  const setColorChangeModal = useSetAtom(colorChangeModalAtom)

  // Word annotations selector
  const selectAllWordAnnotations = makeAllWordAnnotationsSelector()
  const wordAnnotations = useSelector((state: RootState) => selectAllWordAnnotations(state))

  // Filters hook - encapsulates all filter logic
  const {
    filters,
    setColorFilter,
    setTagFilter,
    resetFilters,
    filterLabel,
    colorInfo,
    selectedTag,
    activeFiltersCount,
    mainModalRef,
    colorModalRef,
    tagsModalRef,
    openMainModal,
    openColorFromMain,
    openTagsFromMain,
  } = useHighlightFilters()

  // Settings modal (for highlight actions)
  const [settingsData, setSettingsData] = useState<{ stringIds: VerseIds } | null>(null)
  const { ref: settingsRef, open: openSettings, close: closeSettings } = useBottomSheetModal()

  // Annotation settings modal
  const [annotationSettingsData, setAnnotationSettingsData] =
    useState<GroupedWordAnnotation | null>(null)
  const {
    ref: annotationSettingsRef,
    open: openAnnotationSettings,
    close: closeAnnotationSettings,
  } = useBottomSheetModal()

  useEffect(() => {
    if (settingsData) openSettings()
  }, [settingsData, openSettings])

  useEffect(() => {
    if (annotationSettingsData) openAnnotationSettings()
  }, [annotationSettingsData, openAnnotationSettings])

  // Filter highlights
  const groupedHighlights = useMemo(() => {
    let highlights = Object.entries(highlightsObj)

    if (filters.colorId) {
      highlights = highlights.filter(([, h]) => h.color === filters.colorId)
    }
    if (filters.tagId) {
      highlights = highlights.filter(filterByTag(filters.tagId, highlightsObj))
    }

    return highlights
      .sort((a, b) => Number(b[1].date) - Number(a[1].date))
      .slice(0, 100)
      .reduce(groupHighlightsByDate, [])
  }, [filters, highlightsObj])

  // Create unified list of highlights and annotations sorted by date
  const unifiedItems = useMemo(() => {
    // Transform highlights to unified format
    const highlightItems: UnifiedHighlightItem[] = groupedHighlights.map(h => ({
      type: 'highlight' as const,
      data: h,
    }))

    // Filter and transform annotations to unified format
    let filteredAnnotations = wordAnnotations
    if (filters.colorId) {
      filteredAnnotations = filteredAnnotations.filter(a => a.color === filters.colorId)
    }
    const tagIdFilter = filters.tagId
    if (tagIdFilter) {
      filteredAnnotations = filteredAnnotations.filter(a => a.tags?.[tagIdFilter])
    }

    const annotationItems: UnifiedHighlightItem[] = filteredAnnotations.map(a => ({
      type: 'annotation' as const,
      data: a,
    }))

    // Combine and sort by date descending
    return [...highlightItems, ...annotationItems].sort(
      (a, b) => Number(b.data.date) - Number(a.data.date)
    )
  }, [groupedHighlights, wordAnnotations, filters])

  const handleDelete = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer cette surbrillance ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          if (settingsData?.stringIds) {
            dispatch(removeHighlight({ selectedVerses: settingsData.stringIds }))
          }
          setSettingsData(null)
          closeSettings()
        },
        style: 'destructive',
      },
    ])
  }

  const handleDeleteAnnotation = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer cette annotation ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          if (annotationSettingsData?.id) {
            dispatch(removeWordAnnotationAction(annotationSettingsData.id))
          }
          setAnnotationSettingsData(null)
          closeAnnotationSettings()
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <Container>
      {/* Header with filter button */}
      <FiltersHeader
        title={t('Surbrillances')}
        filterLabel={filterLabel}
        onFilterPress={openMainModal}
        hasBackButton
      />

      {/* Filter modals */}
      <FilterModal
        ref={mainModalRef}
        selectedColorId={filters.colorId}
        selectedColorName={colorInfo?.name}
        selectedColorHex={colorInfo?.hex}
        onColorPress={openColorFromMain}
        selectedTagName={selectedTag?.name}
        onTagPress={openTagsFromMain}
        onReset={resetFilters}
        hasActiveFilters={activeFiltersCount > 0}
      />

      <ColorFilterModal
        ref={colorModalRef}
        selectedColorId={filters.colorId}
        onSelect={colorId => {
          setColorFilter(colorId)
          colorModalRef.current?.dismiss()
        }}
      />

      <TagsFilterModal
        ref={tagsModalRef}
        selectedTag={selectedTag}
        onSelect={tag => {
          setTagFilter(tag)
          tagsModalRef.current?.dismiss()
        }}
      />

      {/* Content */}
      {unifiedItems.length ? (
        <ScrollView>
          {unifiedItems.map(item =>
            item.type === 'highlight' ? (
              <VerseComponent
                key={`highlight-${item.data.date}`}
                color={item.data.color}
                date={item.data.date}
                verseIds={item.data.highlightsObj}
                stringIds={item.data.stringIds}
                tags={item.data.tags}
                setSettings={setSettingsData}
              />
            ) : (
              <AnnotationItem
                key={`annotation-${item.data.id}`}
                item={item.data}
                onSettingsPress={setAnnotationSettingsData}
              />
            )
          )}
        </ScrollView>
      ) : (
        <Empty
          icon={require('~assets/images/empty-state-icons/highlight.svg')}
          message={t("Vous n'avez pas encore rien surligné...")}
        />
      )}

      {/* Settings modal */}
      <Modal.Body ref={settingsRef} enableDynamicSizing>
        <Modal.Item
          onPress={() => {
            if (settingsData?.stringIds) {
              const verseIds = settingsData.stringIds
              setColorChangeModal({
                onSelectColor: (colorId: string) => {
                  dispatch(changeHighlightColor(verseIds, colorId))
                },
              })
            }
          }}
        >
          {t('Changer la couleur')}
        </Modal.Item>
        <Modal.Item
          onPress={() => {
            if (settingsData?.stringIds) {
              setMultipleTagsItem({
                entity: 'highlights',
                ids: settingsData.stringIds,
              })
            }
          }}
        >
          {t('Éditer les tags')}
        </Modal.Item>
        <Modal.Item color="quart" onPress={handleDelete}>
          {t('Supprimer')}
        </Modal.Item>
      </Modal.Body>

      {/* Annotation settings modal */}
      <Modal.Body
        ref={annotationSettingsRef}
        onModalClose={() => setAnnotationSettingsData(null)}
        enableDynamicSizing
      >
        <Modal.Item
          onPress={() => {
            if (annotationSettingsData) {
              const annotationId = annotationSettingsData.id
              const annotationColor = annotationSettingsData.color
              setColorChangeModal({
                selectedColor: annotationColor,
                onSelectColor: (colorId: string) => {
                  dispatch(changeWordAnnotationColor(annotationId, colorId))
                },
              })
            }
          }}
        >
          {t('Changer la couleur')}
        </Modal.Item>
        <Modal.Item
          onPress={() => {
            if (annotationSettingsData) {
              setMultipleTagsItem({
                entity: 'wordAnnotations',
                id: annotationSettingsData.id,
              })
            }
          }}
        >
          {t('Éditer les tags')}
        </Modal.Item>
        <Modal.Item color="quart" onPress={handleDeleteAnnotation}>
          {t('Supprimer')}
        </Modal.Item>
      </Modal.Body>
    </Container>
  )
}

export default HighlightsScreen
