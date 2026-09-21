import { Command } from 'cmdk'
import { useTranslation } from 'react-i18next'
import { usePassageBrowser, type PassageBrowserProps } from '~features/search/usePassageBrowser'

export default function PassageBrowser({ version, onSelect }: PassageBrowserProps) {
  const { t } = useTranslation()
  const { books, book, chapters, setSelectedBook, chapterResult } = usePassageBrowser(version)
  return (
    <Command.Group heading={book ? t(book.Nom) : t('Livres')}>
      {book ? (
        <>
          <Command.Item value="passage-books" onSelect={() => setSelectedBook(null)}>
            ← {t('Livres')}
          </Command.Item>
          {chapters.map(chapter => (
            <Command.Item
              key={`${book.Numero}:${chapter}`}
              value={`chapter:${book.Numero}:${chapter}`}
              onSelect={() => onSelect(chapterResult(chapter))}
            >
              {t(book.Nom)} {chapter}
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
