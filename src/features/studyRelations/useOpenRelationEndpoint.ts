import { useRouter } from 'expo-router'
import books from '~assets/bible_versions/books-desc'
import { useOpenNote } from '~features/notes/useOpenNote'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import type { RelationEndpoint } from './domain'

export const useOpenRelationEndpoint = () => {
  const router = useRouter()
  const openNote = useOpenNote()

  return (endpoint: RelationEndpoint) => {
    switch (endpoint.type) {
      case 'verse': {
        const [bookNumber, chapter, verse] = endpoint.verseKeys[0].split('-').map(Number)
        router.push({
          pathname: '/bible-view',
          params: {
            contextDisplayMode: 'focused',
            book: JSON.stringify(books[bookNumber - 1]),
            chapter: String(chapter),
            verse: String(verse),
            focusVerses: JSON.stringify(endpoint.verseKeys.map(key => Number(key.split('-')[2]))),
          },
        })
        break
      }
      case 'note':
        openNote({ noteId: endpoint.noteId })
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
      case 'nave':
        router.push({
          pathname: '/nave-detail',
          params: {
            name_lower: endpoint.nameLower,
            name: endpoint.labelFallback || endpoint.nameLower,
          },
        })
        break
      case 'dictionary':
        router.push({
          pathname: '/dictionnary-detail',
          params: { word: endpoint.word },
        })
        break
      case 'externalLink': {
        if (!endpoint.linkId) {
          toast.error(i18n.t('Lien introuvable'))
          break
        }
        router.push({
          pathname: '/link',
          params: { linkId: endpoint.linkId },
        })
        break
      }
      case 'word':
        break
    }
  }
}
