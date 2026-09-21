import { Command } from 'cmdk'
import { useTranslation } from 'react-i18next'
import { usePassageBrowser, type PassageBrowserProps } from '~features/search/usePassageBrowser'

export default function PassageBrowser({
  version,
  onSelect,
  requireVerse = false,
}: PassageBrowserProps) {
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
  return (
    <Command.Group
      heading={book ? `${t(book.Nom)}${selectedChapter ? ` ${selectedChapter}` : ''}` : t('Livres')}
    >
      {book ? (
        <>
          <Command.Item
            value="passage-books"
            onSelect={() => (selectedChapter ? setSelectedChapter(null) : setSelectedBook(null))}
          >
            ← {t(selectedChapter ? 'Chapitres' : 'Livres')}
          </Command.Item>
          {(selectedChapter ? verses : chapters).map(number => (
            <Command.Item
              key={`${book.Numero}:${selectedChapter ?? 0}:${number}`}
              value={`passage:${book.Numero}:${selectedChapter ?? 0}:${number}`}
              onSelect={() => {
                if (selectedChapter) onSelect(chapterResult(selectedChapter, number))
                else if (requireVerse) setSelectedChapter(number)
                else onSelect(chapterResult(number))
              }}
            >
              {t(book.Nom)} {selectedChapter ? `${selectedChapter}:` : ''}
              {number}
            </Command.Item>
          ))}
        </>
      ) : (
        books.map(item => (
          <Command.Item
            key={item.Numero}
            value={`book:${item.Numero}`}
            onSelect={() => setSelectedBook(item.Numero)}
          >
            {t(item.Nom)}
          </Command.Item>
        ))
      )}
    </Command.Group>
  )
}
