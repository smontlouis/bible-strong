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
import { useQuery } from '~helpers/react-query-lite'

type VerseSelectorPopupProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  children: React.ReactNode
}

export const VerseSelectorPopup = ({ bibleAtom, children }: VerseSelectorPopupProps) => {
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
    queryKey: ['bible', version, book.Numero.toString(), chapter.toString()],
    queryFn: () => resources.bibleContent.loadChapter({ book: book.Numero, chapter, version }),
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
    sheetRef.current?.dismiss()
  }

  return (
    <>
      <TouchableBox center height="100%" onPress={() => sheetRef.current?.present()}>
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
        </SheetScrollView>
      </Sheet>
    </>
  )
}
