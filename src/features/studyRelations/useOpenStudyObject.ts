import { useOpenNote } from '~features/notes/useOpenNote'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getOpenableAction, type OpenableStudyObject } from './openableStudyObjects'

export const useOpenStudyObject = () => {
  const pushRouteOnce = usePushRouteOnce()
  const openNote = useOpenNote()

  return (object: OpenableStudyObject) => {
    const action = getOpenableAction(object)

    switch (action.type) {
      case 'route':
        pushRouteOnce({
          pathname: action.pathname,
          params: action.params,
        })
        break
      case 'note':
        openNote({ noteId: action.noteId })
        break
      case 'toast':
        toast.error(i18n.t(action.messageKey))
        break
      case 'none':
        break
    }
  }
}
