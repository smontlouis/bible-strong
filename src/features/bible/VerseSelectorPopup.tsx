import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { FlatList } from 'react-native'
import { BibleTab, useBibleTabActions } from 'src/state/tabs'
import { usePopOver } from '~common/PopOverContext'
import { Verse } from '~common/types'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import loadBibleChapter from '~helpers/loadBibleChapter'
import { useQuery } from '~helpers/react-query-lite'

export const VerseSelectorPopup = ({
  bibleAtom,
}: {
  bibleAtom: PrimitiveAtom<BibleTab>
}) => {
  const { t } = useTranslation()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const { onClose } = usePopOver()

  const {
    data: {
      selectedVersion: version,
      selectedBook: book,
      selectedChapter: chapter,
      selectedVerse: verse,
    },
  } = bible

  const { setSelectedVerse } = actions

  const handleSelect = (v: Verse) => {
    setSelectedVerse(Number(v.Verset))
    onClose()
  }

  const { data: verses } = useQuery({
    queryKey: ['bible', version, book.Numero.toString(), chapter.toString()],
    queryFn: () =>
      loadBibleChapter(book.Numero, chapter, version) as Promise<Verse[]>,
  })

  const renderItem = ({ item }: { item: Verse[] }) => (
    <HStack gap={10} mb={10}>
      {item.map(verse => (
        <TouchableBox
          key={verse.Verset}
          backgroundColor="opacity5"
          borderRadius={3}
          w={40}
          h={40}
          alignItems="center"
          justifyContent="center"
          onPress={() => handleSelect(verse)}
        >
          <Text>{verse.Verset}</Text>
        </TouchableBox>
      ))}
    </HStack>
  )

  const groupedVerses = verses
    ? Array.from({ length: Math.ceil(verses.length / 5) }, (_, i) =>
        verses.slice(i * 5, (i + 1) * 5)
      )
    : []

  return (
    <Box width={260} maxHeight={300}>
      <Box px={10} py={10} borderBottomWidth={1} borderColor="border">
        <Text fontWeight="bold">{t('goToVerse')}</Text>
      </Box>
      <FlatList
        data={groupedVerses}
        renderItem={renderItem}
        keyExtractor={(item, index) => `group-${index}`}
        contentContainerStyle={{ padding: 10 }}
        showsVerticalScrollIndicator={false}
      />
    </Box>
  )
}
