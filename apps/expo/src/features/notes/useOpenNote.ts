import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getNoteRoute } from './routeParams'

type OpenNoteParams = {
  noteId?: string | null
  verseKeys?: string[]
  version?: string
}

export const useOpenNote = () => {
  const pushRouteOnce = usePushRouteOnce()

  return (params: OpenNoteParams = {}) => {
    pushRouteOnce(getNoteRoute(params))
  }
}
