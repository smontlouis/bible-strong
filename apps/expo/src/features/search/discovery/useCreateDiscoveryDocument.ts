import { useRouter } from 'expo-router'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectIsLogged } from '~redux/selectors/user'
import { updateStudy } from '~redux/modules/user'
import generateUUID from '~helpers/generateUUID'
import type { TabItem } from '~state/tabs'

export function useCreateDiscoveryDocument(onSelect: (tab: TabItem) => void, onDone?: () => void) {
  const router = useRouter()
  const dispatch = useDispatch()
  const isLogged = useSelector(selectIsLogged)
  const { t } = useTranslation()
  return {
    canCreateStudy: isLogged,
    createNote: () => {
      onDone?.()
      router.push('/note')
    },
    createStudy: () => {
      if (!isLogged) return
      const id = generateUUID()
      const title = t('Document sans titre')
      dispatch(
        updateStudy({ id, title, content: null, created_at: Date.now(), modified_at: Date.now() })
      )
      onSelect({
        id: generateUUID(),
        type: 'study',
        title,
        isRemovable: true,
        data: { studyId: id },
      })
    },
  }
}
