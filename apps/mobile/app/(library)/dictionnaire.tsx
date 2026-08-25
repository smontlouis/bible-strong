import { useLocalSearchParams } from 'expo-router'
import DictionaryScreen from '~features/dictionnary/DictionaryScreen'

const DictionaryRoute = () => {
  const params = useLocalSearchParams<{ mode?: string; tabId?: string }>()

  return <DictionaryScreen isNewTabSelection={params.mode === 'newTab'} newTabId={params.tabId} />
}

export default DictionaryRoute
