import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import { BibleTab, useBibleTabActions } from 'src/state/tabs'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useQuery } from '@tanstack/react-query'
import { bibleChapterQueryOptions } from '~features/resources/resourceQueries'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'

type VerseSelectorPopupProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  children: React.ReactNode
  coverage?: BibleVersionCoverage
  preferCoverage?: boolean
}

export const VerseSelectorPopup = ({
  bibleAtom,
  children,
  coverage,
  preferCoverage = false,
}: VerseSelectorPopupProps) => {
  const { t } = useTranslation()
  const { width: windowWidth } = useWindowDimensions()
  const sheetRef = useRef<SheetRef>(null)
  const resources = useResourceAccess()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)

  const {
    data: { selectedVersion: version, selectedBook: book, selectedChapter: chapter },
  } = bible

  const { data: verses } = useQuery({
    ...bibleChapterQueryOptions({ book: book.Numero, chapter, version }, resources),
    enabled: !preferCoverage,
  })
  const verseCount = getChapterVerseCountFromCoverage(coverage, book.Numero, chapter)
  const verseNumbers = verseCount
    ? Array.from({ length: verseCount }, (_, index) => index + 1)
    : verses?.success
      ? verses.data.verses.map(verse => Number(verse.Verset))
      : []

  const ITEM_WIDTH = 40
  const ITEM_GAP = 10
  const MAX_WIDTH = Math.min(500, windowWidth)
  const PADDING = 10
  const availableWidth = MAX_WIDTH - PADDING * 2
  const itemsPerRow = Math.max(1, Math.floor(availableWidth / (ITEM_WIDTH + ITEM_GAP)))
  const totalItemsWidth = itemsPerRow * ITEM_WIDTH + (itemsPerRow - 1) * ITEM_GAP
  const horizontalMargin = (MAX_WIDTH - totalItemsWidth) / 2

  const handleSelect = (verse: number) => {
    actions.setSelectedVerse(verse)
    sheetRef.current?.dismiss()
  }

  return (
    <>
      <TouchableBox
        center
        height="100%"
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.chooseVerse')}
      >
        {children}
      </TouchableBox>
      <Sheet ref={sheetRef} header={<SheetHeader title={t('goToVerse')} centerTitle />}>
        <SheetScrollView
          contentContainerStyle={{
            paddingTop: 10,
            paddingHorizontal: horizontalMargin,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: ITEM_GAP,
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {verseNumbers.length ? (
            verseNumbers.map(verse => (
              <TouchableBox
                key={String(verse)}
                backgroundColor="opacity5"
                borderRadius={3}
                w={ITEM_WIDTH}
                h={40}
                alignItems="center"
                justifyContent="center"
                onPress={() => handleSelect(verse)}
                accessibilityRole="button"
                accessibilityLabel={`${t('Verset')} ${verse}`}
                accessibilityState={{ selected: verse === bible.data.selectedVerse }}
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
                  <Text textAlign="center">{verse}</Text>
                </Box>
              </TouchableBox>
            ))
          ) : (
            <Box py={20} width="100%" center>
              <Text color="grey">{t('Chargement...')}</Text>
            </Box>
          )}
        </SheetScrollView>
      </Sheet>
    </>
  )
}
