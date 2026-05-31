import { BottomSheetModal, BottomSheetScrollView } from '~common/bottom-sheet'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BibleTab, useBibleTabActions } from 'src/state/tabs'
import { ContainerComponent } from '~common/Modal'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import loadBibleChapter from '~helpers/loadBibleChapter'
import { useQuery } from '~helpers/react-query-lite'

type VerseSelectorPopupProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  children: React.ReactNode
}

export const VerseSelectorPopup = ({ bibleAtom, children }: VerseSelectorPopupProps) => {
  const { t } = useTranslation()
  const { width: windowWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const bottomSheetRef = useRef<BottomSheetModal>(null)
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const {
    data: { selectedVersion: version, selectedBook: book, selectedChapter: chapter },
  } = bible

  const { data: verses } = useQuery({
    queryKey: ['bible', version, book.Numero.toString(), chapter.toString()],
    queryFn: () => loadBibleChapter(book.Numero, chapter, version),
  })

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
    bottomSheetRef.current?.dismiss()
  }

  return (
    <>
      <TouchableBox center height="100%" onPress={() => bottomSheetRef.current?.present()}>
        {children}
      </TouchableBox>
      <BottomSheetModal
        key={key}
        ref={bottomSheetRef}
        topInset={insets.top}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        containerComponent={ContainerComponent}
        activeOffsetY={[-20, 20]}
        stackBehavior="push"
        {...bottomSheetStyles}
      >
        <Box px={10} py={10} borderBottomWidth={1} borderColor="border">
          <Text fontWeight="bold" textAlign="center">
            {t('goToVerse')}
          </Text>
        </Box>
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
          {verses?.data?.length ? (
            verses.data.map((verse, index) => (
              <TouchableBox
                key={index}
                backgroundColor="opacity5"
                borderRadius={3}
                w={ITEM_WIDTH}
                h={40}
                alignItems="center"
                justifyContent="center"
                onPress={() => handleSelect(Number(verse.Verset))}
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
            ))
          ) : (
            <Box py={20} width="100%" center>
              <Text color="grey">{t('Chargement...')}</Text>
            </Box>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  )
}
