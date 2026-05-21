import { useRouter } from 'expo-router'
import books from '~assets/bible_versions/books-desc'
import type { RelationEndpoint } from './domain'

export const useOpenRelationEndpoint = () => {
  const router = useRouter()

  return (endpoint: RelationEndpoint) => {
    switch (endpoint.type) {
      case 'verse': {
        const [bookNumber, chapter, verse] = endpoint.verseKeys[0].split('-').map(Number)
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: JSON.stringify(books[bookNumber - 1]),
            chapter: String(chapter),
            verse: String(verse),
            focusVerses: JSON.stringify(endpoint.verseKeys.map(key => Number(key.split('-')[2]))),
          },
        })
        break
      }
      case 'note':
        router.push({
          pathname: '/note',
          params: { noteId: endpoint.noteId },
        })
        break
      case 'study':
        router.push({
          pathname: '/edit-study',
          params: { studyId: endpoint.studyId },
        })
        break
      case 'strong':
        router.push({
          pathname: '/strong',
          params: {
            book: endpoint.language === 'hebrew' ? '1' : '40',
            reference: endpoint.code,
          },
        })
        break
    }
  }
}
