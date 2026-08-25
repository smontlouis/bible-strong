import { useOpenNote } from '~features/notes/useOpenNote'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getOpenableAction, type OpenableStudyObject } from './openableStudyObjects'
import { useSelector } from 'react-redux'
import { selectWordAnnotations } from '~redux/selectors/bible'

export const useOpenStudyObject = () => {
  const pushRouteOnce = usePushRouteOnce()
  const openNote = useOpenNote()
  const wordAnnotations = useSelector(selectWordAnnotations)

  return (object: OpenableStudyObject) => {
    const action = getOpenableAction(object, { wordAnnotations })

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
