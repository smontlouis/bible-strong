import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BibleTab, BibleTabActions } from 'src/state/tabs'
import { Verse } from '~common/types'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import loadBibleChapter from '~helpers/loadBibleChapter'
import { useQuery } from '~helpers/react-query-lite'

interface VerseBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheet>
  bookSelectorRef: React.RefObject<BottomSheet>
  actions?: BibleTabActions
  data?: BibleTab['data']
}

const VerseBottomSheet = ({
  bottomSheetRef,
  bookSelectorRef,
  actions,
  data,
}: VerseBottomSheetProps) => {
  const { width: windowWidth } = useWindowDimensions()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const openInNewTab = useOpenInNewTab()

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const ITEM_WIDTH = 40
  const ITEM_GAP = 10
  const MAX_WIDTH = Math.min(500, windowWidth)
  const PADDING = 10

  const {
    selectedVersion: version,
    selectedBook: book,
    selectedChapter: chapter,
  } = data || {}
  const { setTempSelectedVerse, validateTempSelected } = actions || {}

  const { data: verses } = useQuery({
    queryKey: [
      'bible',
      version || '',
      book?.Numero.toString() || '',
      chapter?.toString() || '',
    ],
    queryFn: () =>
      loadBibleChapter(book?.Numero, chapter, version) as Promise<Verse[]>,
    enabled: !!book && !!chapter && !!version,
  })

  const handleSelect = useCallback(
    (verse: Verse) => {
      setTempSelectedVerse?.(Number(verse.Verset))
      validateTempSelected?.()
      bottomSheetRef.current?.close()
      bookSelectorRef.current?.close()
    },
    [setTempSelectedVerse, validateTempSelected]
  )

  const availableWidth = MAX_WIDTH - PADDING * 2
  const itemsPerRow = Math.floor(availableWidth / (ITEM_WIDTH + ITEM_GAP))

  const totalItemsWidth =
    itemsPerRow * ITEM_WIDTH + (itemsPerRow - 1) * ITEM_GAP

  const horizontalMargin = (MAX_WIDTH - totalItemsWidth) / 2

  return (
    <BottomSheet
      key={key}
      ref={bottomSheetRef}
      snapPoints={['50%']}
      index={-1}
      topInset={insets.top}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      {...bottomSheetStyles}
    >
      <Box width="100%" alignSelf="center">
        <Box px={10} py={10} borderBottomWidth={1} borderColor="border">
          <Text fontWeight="bold">{t('goToVerse')}</Text>
        </Box>
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingVertical: 10,
            paddingHorizontal: horizontalMargin,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: ITEM_GAP,
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {verses?.map((verse, index) => (
            <TouchableBox
              key={index}
              backgroundColor="opacity5"
              borderRadius={3}
              w={ITEM_WIDTH}
              h={40}
              alignItems="center"
              justifyContent="center"
              onPress={() => handleSelect(verse)}
            >
              <Text>{verse.Verset}</Text>
            </TouchableBox>
          ))}
        </BottomSheetScrollView>
      </Box>
    </BottomSheet>
  )
}

export default VerseBottomSheet
