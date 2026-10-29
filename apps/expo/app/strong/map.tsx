import { useLocalSearchParams } from 'expo-router'

import BiblicalMapScreen from '~features/lexique/biblicalMap/BiblicalMapScreen'
import { IS_FORM_SHEET } from '~helpers/constants'

// The map of the places of the Bible: `focus` opens it on a place, `places` (unique names,
// comma-separated) brings forward the places of a chapter.
const BiblicalMapRoute = () => {
  const params = useLocalSearchParams<{ focus?: string; places?: string; title?: string }>()
  return (
    <BiblicalMapScreen
      focus={params.focus || undefined}
      placeNames={params.places ? params.places.split(',').filter(Boolean) : undefined}
      title={params.title || undefined}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default BiblicalMapRoute
