import { useLocalSearchParams } from 'expo-router'
import BibleVerseNotesScreen from '~features/bible/BibleVerseNotesScreen'

const BibleVerseNotesRoute = () => {
  const params = useLocalSearchParams<{ mode?: string; tabId?: string }>()

  return (
    <BibleVerseNotesScreen isNewTabSelection={params.mode === 'newTab'} newTabId={params.tabId} />
  )
}

export default BibleVerseNotesRoute
