import { useLocalSearchParams } from 'expo-router'
import NaveScreen from '~features/nave/NaveScreen'

const NaveRoute = () => {
  const params = useLocalSearchParams<{ mode?: string; tabId?: string }>()

  return <NaveScreen isNewTabSelection={params.mode === 'newTab'} newTabId={params.tabId} />
}

export default NaveRoute
