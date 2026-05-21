import { useRouter } from 'expo-router'
import books from '~assets/bible_versions/books-desc'
import generateUUID from '~helpers/generateUUID'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import type { RelationEndpoint } from './domain'
import { getEndpointFallbackLabel } from './domain'

export const useOpenRelationEndpoint = () => {
  const router = useRouter()
  const openInNewTab = useOpenInNewTab()

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
        openInNewTab(
          {
            id: `notes-${generateUUID()}`,
            title: endpoint.label || 'Note',
            type: 'notes',
            isRemovable: true,
            data: { noteId: endpoint.noteId },
          },
          { autoRedirect: true }
        )
        break
      case 'study':
        router.push({
          pathname: '/edit-study',
          params: { studyId: endpoint.studyId },
        })
        break
      case 'strong':
        openInNewTab(
          {
            id: `strong-${generateUUID()}`,
            title: getEndpointFallbackLabel(endpoint),
            type: 'strong',
            isRemovable: true,
            data: {
              reference: endpoint.code,
            },
          },
          { autoRedirect: true }
        )
        break
    }
  }
}
