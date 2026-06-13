import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BibleTab, BibleTabActions } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import { Verse } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { localBibleContentAccess } from '~features/resources/bibleContentAccess'
import generateUUID from '~helpers/generateUUID'
import { useQuery } from '~helpers/react-query-lite'

interface VerseSheetProps {
  sheetRef: React.RefObject<SheetRef | null>
  bookSelectorRef: React.RefObject<SheetRef | null>
  actions?: BibleTabActions
  data?: BibleTab['data']
}

export const tempSelectedBookAtom = atom<Book | null>(null)
export const tempSelectedChapterAtom = atom<number | null>(null)

const VerseSheet = ({ sheetRef, bookSelectorRef, actions, data }: VerseSheetProps) => {
  const { width: windowWidth } = useWindowDimensions()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const openInNewTab = useOpenInNewTab()
  const tempSelectedBook = useAtomValue(tempSelectedBookAtom)
  const tempSelectedChapter = useAtomValue(tempSelectedChapterAtom)

  const ITEM_WIDTH = 40
  const ITEM_GAP = 10
  const MAX_WIDTH = Math.min(500, windowWidth)
  const PADDING = 10

  const { selectedVersion: version } = data || {}
  const { setTempSelectedVerse, validateTempSelected } = actions || {}

  const { data: bibleChapterResult } = useQuery({
    queryKey: [
      'bible',
      version || '',
      tempSelectedBook?.Numero.toString() || '',
      tempSelectedChapter?.toString() || '',
    ],
    queryFn: () =>
      localBibleContentAccess.loadChapter({
        book: tempSelectedBook?.Numero || 1,
        chapter: tempSelectedChapter || 1,
        version: version || 'LSG',
      }),
    enabled: !!tempSelectedBook && !!tempSelectedChapter && !!version,
  })

  const verses = bibleChapterResult?.data

  const handleSelect = (verse: Verse) => {
    setTempSelectedVerse?.(Number(verse.Verset))
    validateTempSelected?.()
    sheetRef.current?.dismiss()
    bookSelectorRef.current?.dismiss()
  }

  const handleLongPress = (verse: Verse) => {
    sheetRef.current?.dismiss()
    bookSelectorRef.current?.dismiss()

    if (!tempSelectedBook || !tempSelectedChapter || !data) {
      return
    }
    setTimeout(() => {
      openInNewTab(
        {
          id: `bible-${generateUUID()}`,
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
    <Sheet
      ref={sheetRef}
      snapPoints={[0.5]}
      stackBehavior="push"
      header={<SheetHeader title={t('goToVerse')} centerTitle />}
    >
      <SheetScrollView
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
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
              }}
            >
              <Text textAlign="center">{verse.Verset}</Text>
            </Box>
          </TouchableBox>
        ))}
      </SheetScrollView>
    </Sheet>
  )
}

export default VerseSheet
