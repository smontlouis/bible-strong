import { useLocalSearchParams } from 'expo-router'
import StudiesScreen from '~features/studies/StudiesScreen'

const StudiesRoute = () => {
  const params = useLocalSearchParams<{ mode?: string; tabId?: string }>()

  return (
    <StudiesScreen
      isFormSheet
      isNewTabSelection={params.mode === 'newTab'}
      newTabId={params.tabId}
    />
  )
}

export default StudiesRoute
