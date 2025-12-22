import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView } from 'react-native'

import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import FilterModal from '~common/FilterModal'
import ColorFilterModal from '~common/ColorFilterModal'
import TagsFilterModal from '~common/TagsFilterModal'
import Container from '~common/ui/Container'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import TouchableCircle from '~features/bible/TouchableCircle'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { wp } from '~helpers/utils'
import { useHighlightFilters } from '~helpers/useHighlightFilters'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import type { RootState } from '~redux/modules/reducer'
import { selectHighlightsObj, makeColorsSelector } from '~redux/selectors/user'
import {
  changeHighlightColor,
  type CustomColor,
  type Highlight,
  type HighlightsObj,
  removeHighlight,
} from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import VersesList from './VersesList'
import type { TagsObj, Verse, VerseIds } from '~common/types'

const MIN_ITEM_WIDTH = 40

export type GroupedHighlights = {
  date: number
  color: string
  highlightsObj: Verse[]
  stringIds: VerseIds
  tags: TagsObj
}[]

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
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = useMemo(() => makeColorsSelector(), [])
  const colors = useSelector((state: RootState) => selectColors(state, currentTheme))
  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? []
  )
  const [, setMultipleTagsItem] = useAtom(multipleTagsModalAtom)

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
  const [changeColorData, setChangeColorData] = useState<VerseIds | null>(null)
  const { ref: settingsRef, open: openSettings, close: closeSettings } = useBottomSheetModal()
  const {
    ref: colorChangeRef,
    open: openColorChange,
    close: closeColorChange,
  } = useBottomSheetModal()

  useEffect(() => {
    if (settingsData) openSettings()
  }, [settingsData, openSettings])

  useEffect(() => {
    if (changeColorData) openColorChange()
  }, [changeColorData, openColorChange])

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

  // Dynamic width for color circles
  const screenWidth = wp(100, 500)
  const colorItemCount = 5 + customHighlightColors.length
  const colorItemWidth = Math.max(screenWidth / colorItemCount, MIN_ITEM_WIDTH)

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

  const handleColorChange = (color: string) => {
    if (changeColorData) {
      dispatch(changeHighlightColor(changeColorData, color))
    }
    closeColorChange()
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
      {groupedHighlights.length ? (
        <VersesList setSettings={setSettingsData} groupedHighlights={groupedHighlights} />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore rien surligné...")}
        />
      )}

      {/* Settings modal */}
      <Modal.Body ref={settingsRef} enableDynamicSizing>
        <Modal.Item
          onPress={() => {
            if (settingsData?.stringIds) {
              setChangeColorData(settingsData.stringIds)
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

      {/* Color change modal */}
      <Modal.Body
        ref={colorChangeRef}
        onModalClose={() => setChangeColorData(null)}
        enableDynamicSizing
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
          }}
        >
          <Box width={colorItemWidth} height={60} center>
            <TouchableCircle color={colors.color1} onPress={() => handleColorChange('color1')} />
          </Box>
          <Box width={colorItemWidth} height={60} center>
            <TouchableCircle color={colors.color2} onPress={() => handleColorChange('color2')} />
          </Box>
          <Box width={colorItemWidth} height={60} center>
            <TouchableCircle color={colors.color3} onPress={() => handleColorChange('color3')} />
          </Box>
          <Box width={colorItemWidth} height={60} center>
            <TouchableCircle color={colors.color4} onPress={() => handleColorChange('color4')} />
          </Box>
          <Box width={colorItemWidth} height={60} center>
            <TouchableCircle color={colors.color5} onPress={() => handleColorChange('color5')} />
          </Box>
          {customHighlightColors.map((customColor: CustomColor) => (
            <Box key={customColor.id} width={colorItemWidth} height={60} center>
              <TouchableCircle
                color={customColor.hex}
                onPress={() => handleColorChange(customColor.id)}
              />
            </Box>
          ))}
        </ScrollView>
      </Modal.Body>
    </Container>
  )
}

export default HighlightsScreen
