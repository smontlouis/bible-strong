import StrongRelatedRouteScreen from '~features/lexique/StrongRelatedRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const StrongRelatedRoute = () => {
  const route = useStrongRoute('related')

  return (
    <LegacyPublicRouteRedirect pathname="/strong/related">
      <StrongRelatedRouteScreen
        key={route.identity}
        context={route.context}
        isFormSheet={IS_FORM_SHEET}
      />
    </LegacyPublicRouteRedirect>
  )
}

export default StrongRelatedRoute
