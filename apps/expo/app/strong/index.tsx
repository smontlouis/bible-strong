import StrongMainScreen from '~features/lexique/StrongMainScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const StrongRoute = () => {
  const route = useStrongRoute('index')

  return (
    <LegacyPublicRouteRedirect pathname="/strong">
      <StrongMainScreen key={route.identity} context={route.context} isFormSheet={IS_FORM_SHEET} />
    </LegacyPublicRouteRedirect>
  )
}

export default StrongRoute
