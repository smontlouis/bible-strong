import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { serializeNoteVerseKeys } from './routeParams'

type OpenNoteParams = {
  noteId?: string | null
  verseKeys?: string[]
}

export const useOpenNote = () => {
  const pushRouteOnce = usePushRouteOnce()

  return ({ noteId, verseKeys }: OpenNoteParams = {}) => {
    pushRouteOnce({
      pathname: '/note',
      params: {
        ...(noteId ? { noteId } : {}),
        ...(verseKeys?.length ? { verseKeys: serializeNoteVerseKeys(verseKeys) } : {}),
      },
    })
  }
}
