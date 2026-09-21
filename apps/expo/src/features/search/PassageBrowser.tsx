import { useTranslation } from 'react-i18next'
import { Keyboard } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { usePassageBrowser, type PassageBrowserProps } from './usePassageBrowser'

export default function PassageBrowser({
  version,
  onSelect,
  requireVerse = false,
  onNavigate,
}: PassageBrowserProps & { onNavigate: () => void }) {
  const { t } = useTranslation()
  const {
    books,
    book,
    chapters,
    verses,
    selectedChapter,
    setSelectedChapter,
    setSelectedBook,
    chapterResult,
  } = usePassageBrowser(version)

  if (!book) {
    return (
      <Box>
        {books.map(item => (
          <TouchableBox
            key={item.Numero}
            className="flex-row items-center justify-between px-5 py-4 border-b border-light-grey"
            accessibilityRole="button"
            onPress={() => {
              Keyboard.dismiss()
              setSelectedBook(item.Numero)
              onNavigate()
            }}
          >
            <Text>{t(item.Nom)}</Text>
            <FeatherIcon name="chevron-right" size={18} />
          </TouchableBox>
        ))}
      </Box>
    )
  }

  return (
    <Box>
      <TouchableBox
        className="flex-row items-center gap-3 px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel={t(selectedChapter ? 'Chapitres' : 'Livres')}
        onPress={() => {
          if (selectedChapter) setSelectedChapter(null)
          else setSelectedBook(null)
          onNavigate()
        }}
      >
        <FeatherIcon name="arrow-left" size={20} />
        <Text className="font-bold">
          {t(book.Nom)}
          {selectedChapter ? ` ${selectedChapter}` : ''}
        </Text>
      </TouchableBox>
      <Box className="flex-row flex-wrap gap-2 px-5 pb-8">
        {(selectedChapter ? verses : chapters).map(number => (
          <TouchableBox
            key={number}
            className="h-12 w-12 items-center justify-center rounded-md bg-opacity5"
            accessibilityRole="button"
            accessibilityLabel={`${t(book.Nom)}${selectedChapter ? ` ${selectedChapter}, ${t('Verset')}` : `, ${t('Chapitre')}`} ${number}`}
            onPress={() => {
              if (selectedChapter) onSelect(chapterResult(selectedChapter, number))
              else if (requireVerse) {
                setSelectedChapter(number)
                onNavigate()
              } else onSelect(chapterResult(number))
            }}
          >
            <Text>{number}</Text>
          </TouchableBox>
        ))}
      </Box>
    </Box>
  )
}
