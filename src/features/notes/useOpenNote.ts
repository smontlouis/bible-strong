import { useRouter } from 'expo-router'
import { serializeNoteVerseKeys } from './routeParams'

type OpenNoteParams = {
  noteId?: string | null
  verseKeys?: string[]
}

export const useOpenNote = () => {
  const router = useRouter()

  return ({ noteId, verseKeys }: OpenNoteParams = {}) => {
    router.push({
      pathname: '/note',
      params: {
        ...(noteId ? { noteId } : {}),
        ...(verseKeys?.length ? { verseKeys: serializeNoteVerseKeys(verseKeys) } : {}),
      },
    })
  }
}
