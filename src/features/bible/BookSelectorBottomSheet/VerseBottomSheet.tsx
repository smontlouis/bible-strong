import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BibleTab, BibleTabActions } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import { Verse } from '~common/types'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import loadBibleChapter from '~helpers/loadBibleChapter'
import { useQuery } from '~helpers/react-query-lite'

interface VerseBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheet>
  bookSelectorRef: React.RefObject<BottomSheet>
  actions?: BibleTabActions
  data?: BibleTab['data']
}

export const tempSelectedBookAtom = atom<Book | null>(null)
export const tempSelectedChapterAtom = atom<number | null>(null)

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
  const tempSelectedBook = useAtomValue(tempSelectedBookAtom)
  const tempSelectedChapter = useAtomValue(tempSelectedChapterAtom)

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const ITEM_WIDTH = 40
  const ITEM_GAP = 10
  const MAX_WIDTH = Math.min(500, windowWidth)
  const PADDING = 10

  const { selectedVersion: version } = data || {}
  const { setTempSelectedVerse, validateTempSelected } = actions || {}

  const { data: verses } = useQuery({
    queryKey: [
      'bible',
      version || '',
      tempSelectedBook?.Numero.toString() || '',
      tempSelectedChapter?.toString() || '',
    ],
    queryFn: () =>
      loadBibleChapter(tempSelectedBook?.Numero, tempSelectedChapter, version) as Promise<Verse[]>,
    enabled: !!tempSelectedBook && !!tempSelectedChapter && !!version,
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

  const handleLongPress = (verse: Verse) => {
    bottomSheetRef.current?.close()
    bookSelectorRef.current?.close()

    if (!tempSelectedBook || !tempSelectedChapter || !data) {
      return
    }
    setTimeout(() => {
      openInNewTab(
        {
          id: `bible-${Date.now()}`,
          title: t('tabs.new'),
          isRemovable: true,
          type: 'bible',
          data: {
            ...data,
            selectionMode: data?.selectionMode || 'list',
            selectedBook: tempSelectedBook,
            selectedChapter: tempSelectedChapter,
            selectedVerse: Number(verse.Verset),
          },
        },
        { autoRedirect: true }
      )
    }, 300)
  }

  const availableWidth = MAX_WIDTH - PADDING * 2
  const itemsPerRow = Math.floor(availableWidth / (ITEM_WIDTH + ITEM_GAP))

  const totalItemsWidth = itemsPerRow * ITEM_WIDTH + (itemsPerRow - 1) * ITEM_GAP

  const horizontalMargin = (MAX_WIDTH - totalItemsWidth) / 2

  return (
    <BottomSheet
      key={key}
      ref={bottomSheetRef}
      index={-1}
      topInset={insets.top}
      snapPoints={['50%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      {...bottomSheetStyles}
    >
      <BottomSheetView>
        <Box px={10} py={10} borderBottomWidth={1} borderColor="border">
          <Text fontWeight="bold" textAlign="center">
            {t('goToVerse')}
          </Text>
        </Box>
      </BottomSheetView>
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: insets.bottom,
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
            onLongPress={() => handleLongPress(verse)}
          >
            <Text>{verse.Verset}</Text>
          </TouchableBox>
        ))}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default VerseBottomSheet
