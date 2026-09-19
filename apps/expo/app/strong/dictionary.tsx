import StrongDictionaryRouteScreen from '~features/lexique/StrongDictionaryRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const StrongDictionaryRoute = () => {
  const route = useStrongRoute('dictionary')

  return (
    <LegacyPublicRouteRedirect pathname="/strong/dictionary">
      <StrongDictionaryRouteScreen
        key={route.identity}
        context={route.context}
        isFormSheet={IS_FORM_SHEET}
      />
    </LegacyPublicRouteRedirect>
  )
}

export default StrongDictionaryRoute
