import StrongConcordanceRouteScreen from '~features/lexique/StrongConcordanceRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const StrongConcordanceRoute = () => {
  const route = useStrongRoute('concordance')

  return (
    <LegacyPublicRouteRedirect pathname="/strong/concordance">
      <StrongConcordanceRouteScreen
        key={route.identity}
        context={route.context}
        isFormSheet={IS_FORM_SHEET}
      />
    </LegacyPublicRouteRedirect>
  )
}

export default StrongConcordanceRoute
