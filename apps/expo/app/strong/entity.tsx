import StrongEntityRouteScreen from '~features/lexique/StrongEntityRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const StrongEntityRoute = () => {
  const route = useStrongRoute('entity')

  return (
    <LegacyPublicRouteRedirect pathname="/strong/entity">
      <StrongEntityRouteScreen
        key={route.identity}
        context={route.context}
        entityKey={route.entityKey}
        isFormSheet={IS_FORM_SHEET}
      />
    </LegacyPublicRouteRedirect>
  )
}

export default StrongEntityRoute
