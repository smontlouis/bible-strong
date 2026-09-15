import { useLocalSearchParams } from 'expo-router'
import LexiqueScreen from '~features/lexique/LexiqueScreen'

const LexiqueRoute = () => {
  const params = useLocalSearchParams<{ mode?: string; tabId?: string; lexicalLanguage?: string }>()

  const lexicalLanguage =
    params.lexicalLanguage === 'hebrew' || params.lexicalLanguage === 'greek'
      ? params.lexicalLanguage
      : undefined
  return (
    <LexiqueScreen
      key={lexicalLanguage ?? 'all'}
      initialLexicalLanguage={lexicalLanguage}
      isNewTabSelection={params.mode === 'newTab'}
      newTabId={params.tabId}
    />
  )
}

export default LexiqueRoute
