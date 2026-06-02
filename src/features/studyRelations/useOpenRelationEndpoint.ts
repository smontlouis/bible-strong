import books from '~assets/bible_versions/books-desc'
import { useOpenNote } from '~features/notes/useOpenNote'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { RelationEndpoint } from './domain'

export const useOpenRelationEndpoint = () => {
  const pushRouteOnce = usePushRouteOnce()
  const openNote = useOpenNote()

  return (endpoint: RelationEndpoint) => {
    switch (endpoint.type) {
      case 'verse': {
        const [bookNumber, chapter, verse] = endpoint.verseKeys[0].split('-').map(Number)
        const focusVerses = endpoint.verseKeys
          .filter(key => {
            const [keyBook, keyChapter] = key.split('-').map(Number)
            return keyBook === bookNumber && keyChapter === chapter
          })
          .map(key => Number(key.split('-')[2]))
        pushRouteOnce({
          pathname: '/bible-view',
          params: {
            contextDisplayMode: 'focused',
            book: JSON.stringify(books[bookNumber - 1]),
            chapter: String(chapter),
            verse: String(verse),
            focusVerses: JSON.stringify(focusVerses),
          },
        })
        break
      }
      case 'note':
        openNote({ noteId: endpoint.noteId })
        break
      case 'study':
        pushRouteOnce({
          pathname: '/edit-study',
          params: { studyId: endpoint.studyId },
        })
        break
      case 'strong':
        pushRouteOnce({
          pathname: '/strong',
          params: {
            book: endpoint.language === 'hebrew' ? '1' : '40',
            reference: endpoint.code,
          },
        })
        break
      case 'nave':
        pushRouteOnce({
          pathname: '/nave-detail',
          params: {
            name_lower: endpoint.nameLower,
            name: endpoint.labelFallback || endpoint.nameLower,
          },
        })
        break
      case 'dictionary':
        pushRouteOnce({
          pathname: '/dictionnary-detail',
          params: { word: endpoint.word },
        })
        break
      case 'externalLink': {
        if (!endpoint.linkId) {
          toast.error(i18n.t('Lien introuvable'))
          break
        }
        pushRouteOnce({
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
