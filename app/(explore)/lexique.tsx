import { useLocalSearchParams } from 'expo-router'
import LexiqueScreen from '~features/lexique/LexiqueScreen'

const LexiqueRoute = () => {
  const params = useLocalSearchParams<{ mode?: string; tabId?: string }>()

  return (
    <LexiqueScreen
      isFormSheet
      isNewTabSelection={params.mode === 'newTab'}
      newTabId={params.tabId}
    />
  )
}

export default LexiqueRoute
